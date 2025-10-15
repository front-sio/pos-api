import axios from "axios";
import { Request, Response } from "express";
import { eq, sql, inArray } from "drizzle-orm";
import { db } from "../db/db";
import { accounts_productreturn } from "../db/schema/accounts_productreturn";

const SALES_SERVICE_URL = (process.env.SALES_SERVICE_URL || "http://localhost:3003").replace(/\/+$/, "");

/**
 * Helpers
 */
function toInt(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Math.trunc(v);
  if (typeof v === "string") return parseInt(v, 10) || 0;
  return 0;
}
function logError(where: string, err: any, extra?: any) {
  const status = err?.response?.status;
  const msg = err?.message || String(err);
  const code = err?.code; // ECONNREFUSED, ETIMEDOUT
  const errno = err?.errno;
  const details = err?.response?.data || err?.stack || err?.toString?.() || "no details";
  console.error(`[returnsService][${where}] ${msg}`, { status, code, errno, ...extra }, "\n", details);
}
function logInfo(msg: string, ctx?: any) {
  console.log(`[returnsService][info] ${msg}`, ctx ?? "");
}
function joinUrl(base: string, ...parts: Array<string | number>) {
  const b = base.replace(/\/+$/, "");
  const p = parts
    .map(String)
    .filter(Boolean)
    .map((s) => s.replace(/^\/+|\/+$/g, ""));
  return [b, ...p].join("/");
}

/**
 * GET /returns
 */
export async function getAllReturns(_req: Request, res: Response) {
  try {
    const rows = await db.select().from(accounts_productreturn).orderBy(accounts_productreturn.returned_at);
    res.json(rows);
  } catch (err: any) {
    logError("getAllReturns", err);
    res.status(500).json({ error: err.message || "Failed to fetch returns" });
  }
}

/**
 * GET /returns/:id
 */
export async function getReturnById(req: Request, res: Response) {
  try {
    const id = toInt(req.params.id);
    const rows = await db.select().from(accounts_productreturn).where(eq(accounts_productreturn.id, id));
    if (!rows.length) return res.status(404).json({ message: "Return not found" });
    res.json(rows[0]);
  } catch (err: any) {
    logError("getReturnById", err);
    res.status(500).json({ error: err.message || "Failed to fetch return" });
  }
}

/**
 * GET /returns/by-sale/:saleId
 * sales-service is independent:
 *  - Fetch sale header+items from sales-service at /sales/:id (fallback /:id)
 *  - If 404 => return []
 *  - Filter returns by saleitem_id IN (ids)
 */
export async function getReturnsBySaleId(req: Request, res: Response) {
  try {
    const saleId = toInt(req.params.saleId);
    if (!saleId || saleId <= 0) {
      return res.status(400).json({ error: "Invalid sale id" });
    }

    logInfo("getReturnsBySaleId: fetch sale header+items", { saleId, SALES_SERVICE_URL });

    let items: Array<{ id: number }> = [];
    try {
      const url = joinUrl(SALES_SERVICE_URL, "sales", saleId);
      const resp = await axios.get(url, { headers: { Accept: "application/json" }, timeout: 10_000 });
      items = (resp.data?.items || []) as Array<{ id: number }>;
      logInfo("getReturnsBySaleId: fetched items", { saleId, count: items.length });
    } catch (e: any) {
      if (e?.response?.status === 404) {
        logInfo("getReturnsBySaleId: sale not found => []", { saleId });
        return res.json([]);
      }
      logError("getReturnsBySaleId:sales-fetch", e, { saleId, SALES_SERVICE_URL });
      return res.status(502).json({ error: "Failed to fetch sale items from sales-service" });
    }

    const itemIds = items.map((x) => Number(x.id)).filter((v) => Number.isFinite(v));
    if (!itemIds.length) {
      return res.json([]);
    }

    const rows = await db
      .select({
        id: accounts_productreturn.id,
        saleitem_id: accounts_productreturn.saleitem_id,
        quantity_returned: accounts_productreturn.quantity_returned,
        reason: accounts_productreturn.reason,
        returned_at: accounts_productreturn.returned_at,
      })
      .from(accounts_productreturn)
      .where(inArray(accounts_productreturn.saleitem_id, itemIds));

    return res.json(rows);
  } catch (err: any) {
    logError("getReturnsBySaleId", err);
    res.status(500).json({ error: err.message || "Failed to fetch returns by sale" });
  }
}

/**
 * POST /returns
 * Body: { saleitem_id: number, quantity_returned: number, reason?: string }
 *
 * Simplified cross-service flow:
 *  - Directly ask sales-service to process the return (/sales/returns/process)
 *    (sales-service already ensures quantity_returned <= remaining quantity_sold)
 *  - On success, insert local return record.
 */
export async function createReturn(req: Request, res: Response) {
  try {
    const saleitem_id = toInt(req.body?.saleitem_id);
    const quantity_returned = toInt(req.body?.quantity_returned);
    const reason = req.body?.reason ? String(req.body.reason) : null;

    if (!saleitem_id || saleitem_id <= 0) {
      return res.status(400).json({ error: "saleitem_id is required" });
    }
    if (!quantity_returned || quantity_returned <= 0) {
      return res.status(400).json({ error: "quantity_returned must be > 0" });
    }

    // Directly mutate in sales-service (no pre-fetch of item)
    const processUrl = joinUrl(SALES_SERVICE_URL, "sales", "returns", "process");
    try {
      logInfo("createReturn: process in sales-service", { processUrl, saleitem_id, quantity_returned });
      await axios.post(
        processUrl,
        { saleitem_id, quantity_returned },
        { headers: { "Content-Type": "application/json", Accept: "application/json" }, timeout: 10_000 }
      );
    } catch (e: any) {
      logError("createReturn:process-return", e, { saleitem_id, quantity_returned, processUrl });
      const status = e?.response?.status || 502;
      const message = e?.response?.data?.error || "Failed to process return in sales-service";
      return res.status(status).json({ error: message });
    }

    // Record locally
    const [row] = await db
      .insert(accounts_productreturn)
      .values({ saleitem_id, quantity_returned, reason })
      .returning({
        id: accounts_productreturn.id,
        saleitem_id: accounts_productreturn.saleitem_id,
        quantity_returned: accounts_productreturn.quantity_returned,
        reason: accounts_productreturn.reason,
        returned_at: accounts_productreturn.returned_at,
      });

    return res.status(201).json({
      message: "Return recorded",
      return: row,
    });
  } catch (err: any) {
    logError("createReturn", err);
    const status = err?.response?.status || 500;
    res.status(status).json({ error: err?.response?.data?.error || err.message || "Failed to create return" });
  }
}