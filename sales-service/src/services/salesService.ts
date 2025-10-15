import { Request, Response } from "express";
import axios from "axios";
import { and, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "../db/db";
import { accounts_sale } from "../db/schema/accounts_sale";
import { accounts_saleitem } from "../db/schema/accounts_saleitem";
import { accounts_profittracker } from "../db/schema/accounts_profittracker";

const PRODUCTS_SERVICE_URL = process.env.PRODUCTS_SERVICE_URL || "http://localhost:3001";
const INVOICES_SERVICE_URL = process.env.INVOICES_SERVICE_URL || "http://localhost:3004";

const DISABLE_INVOICING = String(process.env.DISABLE_INVOICING || "").toLowerCase() === "true";
const ALLOW_MISSING_COST = (process.env.ALLOW_MISSING_COST_PRICE || "").toLowerCase() === "true";
const COST_FALLBACK_STRATEGY = (process.env.COST_FALLBACK_STRATEGY || "zero").toLowerCase();

type InvoiceStatusValue = "full" | "credited" | "unpaid";



type RawItem = {
  product_id?: number | string;
  quantity_sold?: number | string;
  quantity?: number | string;
  sale_price_per_quantity?: number | string;
  unit_price?: number | string;
  total_sale_price?: number | string;
  total_price?: number | string;
  has_discount?: boolean | string;
  discount_amount?: number | string;
  list_price?: number | string;
};

type NormalizedItem = {
  product_id: number;
  quantity_sold: number;
  sale_price_per_quantity: number;
  total_sale_price: number;
  has_discount: boolean;
  discount_amount: number;
  list_price: number;
};

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "bigint") return Number(v);
  return 0;
}
function toBoolean(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return false;
}
function asArray<T>(value: any): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  return [value as T];
}
function toDecimalString(n: number, digits = 2): string {
  return n.toFixed(digits);
}
function toDateOrNow(v: unknown): Date {
  if (!v) return new Date();
  try {
    if (v instanceof Date) return v;
    if (typeof v === "string" || typeof v === "number") {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d;
    }
  } catch {}
  return new Date();
}
function logError(where: string, err: any) {
  const msg = err?.message || String(err);
  const details = err?.response?.data || err?.stack || err?.toString?.() || "no details";
  console.error(`[salesService][${where}] ${msg}\n`, details);
}
function logWarn(message: string, context?: any) {
  console.warn(`[salesService][warn] ${message}`, context || "");
}

function computeInvoiceStatus(total_amount: number, paid_amount: number): InvoiceStatusValue {
  const total = Number.isFinite(total_amount) ? total_amount : 0;
  const paid = Number.isFinite(paid_amount) ? paid_amount : 0;

  if (paid <= 0) return "unpaid";
  if (paid >= total && total > 0) return "full";
  return "credited";
}

async function getLatestPurchasePrice(product_id: number): Promise<number | null> {
  try {
    const response = await axios.get(
      `${PRODUCTS_SERVICE_URL}/products/purchases/latest/${product_id}`,
      { headers: { Accept: "application/json" }, timeout: 10_000 }
    );
    const price = response.data?.price_per_quantity;
    return price !== undefined && price !== null ? Number(price) : null;
  } catch (error: any) {
    if (error.response && error.response.status === 404) return null;
    logError("getLatestPurchasePrice", error);
    throw error;
  }
}
async function getProductSellingPrice(product_id: number): Promise<number | null> {
  try {
    const response = await axios.get(
      `${PRODUCTS_SERVICE_URL}/products/${product_id}`,
      { headers: { Accept: "application/json" }, timeout: 10_000 }
    );
    const price = response.data?.price;
    if (price === undefined || price === null) return null;
    return Number(price);
  } catch (error: any) {
    logError("getProductSellingPrice", error);
    return null;
  }
}
function resolveEffectiveCost(maybeCost: number | null, item: NormalizedItem): number {
  if (maybeCost !== null) return maybeCost;
  if (!ALLOW_MISSING_COST) return NaN;
  if (COST_FALLBACK_STRATEGY === "unit_price") {
    logWarn("Missing cost; fallback to unit_price", { product_id: item.product_id });
    return item.sale_price_per_quantity;
  }
  logWarn("Missing cost; fallback to zero", { product_id: item.product_id });
  return 0;
}

async function normalizeItem(i: RawItem, index: number): Promise<NormalizedItem> {
  const product_id = toNumber(i.product_id);
  const quantity_sold = toNumber(i.quantity_sold ?? i.quantity);
  const explicitUnit = toNumber(i.sale_price_per_quantity ?? i.unit_price);
  const discount_amount = toNumber(i.discount_amount);
  let list_price = toNumber(i.list_price);
  if (!list_price || list_price <= 0) {
    const fetched = await getProductSellingPrice(product_id);
    list_price = fetched ?? 0;
  }

  let sale_price_per_quantity = explicitUnit;
  if (!sale_price_per_quantity && discount_amount > 0) {
    sale_price_per_quantity = Math.max(0, list_price - discount_amount);
  }
  if (!sale_price_per_quantity) sale_price_per_quantity = list_price;

  const total_sale_price = toNumber(
    i.total_sale_price ?? i.total_price ?? quantity_sold * sale_price_per_quantity
  );
  const has_discount = toBoolean(i.has_discount) || discount_amount > 0;

  if (!product_id || product_id <= 0) throw new Error(`items[${index}].product_id is required and must be > 0`);
  if (quantity_sold <= 0) throw new Error(`items[${index}].quantity_sold/quantity must be > 0`);
  if (sale_price_per_quantity < 0) throw new Error(`items[${index}].sale_price_per_quantity/unit_price must be >= 0`);
  if (total_sale_price < 0) throw new Error(`items[${index}].total_sale_price/total_price must be >= 0`);

  return {
    product_id,
    quantity_sold,
    sale_price_per_quantity,
    total_sale_price,
    has_discount,
    discount_amount,
    list_price,
  };
}

async function sellBatch(items: Array<{ product_id: number; quantity: number }>) {
  await axios.post(`${PRODUCTS_SERVICE_URL}/products/stock/sell-batch`, { items }, {
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    timeout: 10_000,
  });
}
async function restoreBatch(items: Array<{ product_id: number; quantity: number }>) {
  await axios.post(`${PRODUCTS_SERVICE_URL}/products/stock/restore-batch`, { items }, {
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    timeout: 10_000,
  });
}


async function createInvoiceWithOptionalPayment(params: {
  customer_id: number;
  total_amount: number;
  sale_id: number;
  paid_amount: number;
}) {
  if (DISABLE_INVOICING) return null;

  const { customer_id, total_amount, sale_id, paid_amount } = params;

  try {
    // Decide invoice status from frontend-provided payment vs computed total
    const status = computeInvoiceStatus(total_amount, paid_amount); // "full" | "credited" | "unpaid"

    // Create invoice with explicit status
    const createRes = await axios.post(
      `${INVOICES_SERVICE_URL}/invoices`,
      {
        customer_id,
        total_amount: total_amount.toFixed(2),
        status,                   // now one of: full, credited, unpaid
        sales: [sale_id],
      },
      {
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        timeout: 10_000,
      }
    );

    const invoice_id = createRes.data?.id;

    // If there is any payment from the frontend, post it as a payment record
    if (paid_amount > 0 && invoice_id) {
      try {
        await axios.post(
          `${INVOICES_SERVICE_URL}/invoices/${invoice_id}/payments`,
          { amount: paid_amount.toFixed(2) },
          { headers: { "Content-Type": "application/json", Accept: "application/json" }, timeout: 10_000 }
        );
      } catch (err) {
        logError("createInvoiceWithOptionalPayment:addPayment", err);
      }
    }

    return invoice_id ?? null;
  } catch (err) {
    logError("createInvoiceWithOptionalPayment", err);
    return null;
  }
}

/**
 * Recompute profit for a sale using latest cost.
 * NOTE: we accept either a db or a transaction "executor". Use 'any' to avoid Drizzle type mismatch
 * between NodePgDatabase and PgTransaction ($client is missing on transaction).
 */
async function recomputeProfitForSale(executor: any, saleId: number) {
  const items = await executor
    .select({
      product_id: accounts_saleitem.product_id,
      qty: sql<number>`COALESCE(${accounts_saleitem.quantity_sold}::numeric, 0)`,
      unit_price: sql<number>`COALESCE(${accounts_saleitem.sale_price_per_quantity}::numeric, 0)`,
    })
    .from(accounts_saleitem)
    .where(eq(accounts_saleitem.sale_id, saleId));

  let gross = 0;
  for (const it of items) {
    const cost = await getLatestPurchasePrice(Number(it.product_id));
    const effectiveCost = cost ?? 0;
    gross += (Number(it.unit_price) - effectiveCost) * Number(it.qty);
  }

  const existing = await executor.select().from(accounts_profittracker).where(eq(accounts_profittracker.sale_id, saleId));
  if (existing.length) {
    await executor
      .update(accounts_profittracker)
      .set({
        gross_profit: sql`${gross.toFixed(2)}`,
        net_profit: sql`${gross.toFixed(2)}`,
      })
      .where(eq(accounts_profittracker.sale_id, saleId));
  } else {
    await executor.insert(accounts_profittracker).values({
      sale_id: saleId,
      gross_profit: toDecimalString(gross, 2),
      net_profit: toDecimalString(gross, 2),
    });
  }
}

/**
 * GET /sales
 */
export async function getAllSales(_req: Request, res: Response) {
  try {
    const rows = await db
      .select({
        id: accounts_sale.id,
        customer_id: accounts_sale.customer_id,
        sold_at: accounts_sale.sold_at,
        total_amount: sql<string>`COALESCE(SUM(${accounts_saleitem.total_sale_price}::numeric), 0)`,
      })
      .from(accounts_sale)
      .leftJoin(accounts_saleitem, eq(accounts_sale.id, accounts_saleitem.sale_id))
      .groupBy(accounts_sale.id, accounts_sale.customer_id, accounts_sale.sold_at)
      .orderBy(accounts_sale.sold_at);
    res.json(rows);
  } catch (err: any) {
    logError("getAllSales", err);
    res.status(500).json({ error: err.message || "Failed to fetch sales" });
  }
}

/**
 * GET /sales/:id
 */
export async function getSaleById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const [header] = await db
      .select({
        id: accounts_sale.id,
        customer_id: accounts_sale.customer_id,
        sold_at: accounts_sale.sold_at,
        total_amount: sql<string>`COALESCE(SUM(${accounts_saleitem.total_sale_price}::numeric), 0)`,
      })
      .from(accounts_sale)
      .leftJoin(accounts_saleitem, eq(accounts_sale.id, accounts_saleitem.sale_id))
      .where(eq(accounts_sale.id, Number(id)))
      .groupBy(accounts_sale.id, accounts_sale.customer_id, accounts_sale.sold_at);

    if (!header) return res.status(404).json({ message: "Sale not found" });

    const items = await db.select().from(accounts_saleitem).where(eq(accounts_saleitem.sale_id, Number(id)));
    res.json({ ...header, items });
  } catch (err: any) {
    logError("getSaleById", err);
    res.status(500).json({ error: err.message || "Failed to fetch sale" });
  }
}

/**
 * GET /sales/items/all
 */
export async function getSaleItems(_req: Request, res: Response) {
  try {
    const saleItems = await db.select().from(accounts_saleitem);
    res.json(saleItems);
  } catch (err: any) {
    logError("getSaleItems", err);
    res.status(500).json({ error: err.message || "Failed to fetch sale items" });
  }
}

/**
 * GET /sales/items/:id
 */
export async function getSaleItemById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const rows = await db.select().from(accounts_saleitem).where(eq(accounts_saleitem.id, id));
    if (!rows.length) return res.status(404).json({ message: "Sale item not found" });
    res.json(rows[0]);
  } catch (err: any) {
    logError("getSaleItemById", err);
    res.status(500).json({ error: err.message || "Failed to fetch sale item" });
  }
}

/**
 * POST /sales
 */
export async function createSale(req: Request, res: Response) {
  try {
    const { customer_id, sold_at, paid_amount } = req.body;
    const paidAmountNum = toNumber(paid_amount);

    if (!customer_id || Number(customer_id) <= 0) {
      return res.status(400).json({ error: "customer_id is required" });
    }

    const rawItems: RawItem[] = asArray<RawItem>(req.body.items ?? req.body.sale_items ?? req.body.saleItems);
    if (!rawItems.length) {
      const [newSale] = await db
        .insert(accounts_sale)
        .values({ customer_id: Number(customer_id), sold_at: toDateOrNow(sold_at) })
        .returning({ id: accounts_sale.id });

      if (!DISABLE_INVOICING && paidAmountNum > 0) {
        createInvoiceWithOptionalPayment({
          customer_id: Number(customer_id),
          total_amount: 0,
          sale_id: Number(newSale.id),
          paid_amount: paidAmountNum,
        }).catch((err) => logError("invoiceNoItems", err));
      }
      return res.status(201).json({ id: newSale.id, message: "Sale created (no items provided)" });
    }

    const normalized = await Promise.all(rawItems.map((i, idx) => normalizeItem(i, idx)));
    const batch = normalized.map((n) => ({ product_id: n.product_id, quantity: n.quantity_sold }));

    try {
      await sellBatch(batch);
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (status === 409) {
        return res.status(409).json({ error: "Insufficient stock", details: data });
      }
      logError("sellBatch", err);
      return res.status(502).json({ error: "Stock service unavailable" });
    }

    try {
      const result = await db.transaction(async (tx) => {
        const [saleRow] = await tx
          .insert(accounts_sale)
          .values({ customer_id: Number(customer_id), sold_at: toDateOrNow(sold_at) })
          .returning({ id: accounts_sale.id });
        const saleId = Number(saleRow.id);

        let totalGrossProfit = 0;
        const alerts: Array<{ product_id: number; flag: "over_list" | "under_list"; unit_price: number; list_price: number }> = [];

        for (const item of normalized) {
          const costPriceRaw = await getLatestPurchasePrice(item.product_id);
          const effectiveCost = resolveEffectiveCost(costPriceRaw, item);
          if (Number.isNaN(effectiveCost)) {
            throw new Error(`No purchase record found for product ${item.product_id}`);
          }

          await tx.insert(accounts_saleitem).values({
            sale_id: saleId,
            product_id: item.product_id,
            quantity_sold: toDecimalString(item.quantity_sold, 2),
            sale_price_per_quantity: toDecimalString(item.sale_price_per_quantity, 2),
            total_sale_price: toDecimalString(item.total_sale_price, 2),
          });

          const grossProfit = (Number(item.sale_price_per_quantity) - Number(effectiveCost)) * Number(item.quantity_sold);
          totalGrossProfit += grossProfit;

          if (!item.has_discount && item.list_price > 0) {
            if (item.sale_price_per_quantity > item.list_price) {
              alerts.push({ product_id: item.product_id, flag: "over_list", unit_price: item.sale_price_per_quantity, list_price: item.list_price });
            } else if (item.sale_price_per_quantity < item.list_price) {
              alerts.push({ product_id: item.product_id, flag: "under_list", unit_price: item.sale_price_per_quantity, list_price: item.list_price });
            }
          }
        }

        await tx.insert(accounts_profittracker).values({
          sale_id: saleId,
          gross_profit: toDecimalString(totalGrossProfit, 2),
          net_profit: toDecimalString(totalGrossProfit, 2),
        });

        const [header] = await tx
          .select({
            id: accounts_sale.id,
            customer_id: accounts_sale.customer_id,
            sold_at: accounts_sale.sold_at,
            total_amount: sql<string>`COALESCE(SUM(${accounts_saleitem.total_sale_price}::numeric), 0)`,
          })
          .from(accounts_sale)
          .leftJoin(accounts_saleitem, eq(accounts_sale.id, accounts_saleitem.sale_id))
          .where(eq(accounts_sale.id, saleId))
          .groupBy(accounts_sale.id, accounts_sale.customer_id, accounts_sale.sold_at);

        const insertedItems = await tx.select().from(accounts_saleitem).where(eq(accounts_saleitem.sale_id, saleId));
        const totalAmountNum = Number(header.total_amount ?? 0);

        if (!DISABLE_INVOICING) {
          createInvoiceWithOptionalPayment({
            customer_id: Number(customer_id),
            total_amount: totalAmountNum,
            sale_id: saleId,
            paid_amount: paidAmountNum,
          }).catch((err) => logError("invoice", err));
        }

        return { ...header, items: insertedItems, alerts };
      });

      return res.status(201).json(result);
    } catch (dbErr: any) {
      try { await restoreBatch(batch); } catch (e) { logError("restoreBatch", e); }
      logError("createSale:db", dbErr);
      return res.status(500).json({ error: dbErr?.message || "Failed to create sale" });
    }
  } catch (err: any) {
    logError("createSale", err);
    return res.status(500).json({ error: err?.message || "Failed to create sale" });
  }
}

/**
 * POST /sales/:id/items
 * Body: { items: RawItem[] }
 * Adds new items to an existing sale: decrements stock, inserts items, recomputes profit, returns updated sale.
 */
export async function addSaleItems(req: Request, res: Response) {
  try {
    const saleId = Number(req.params.id);
    if (!saleId || saleId <= 0) {
      return res.status(400).json({ error: "Invalid sale id" });
    }
    const rawItems: RawItem[] = asArray<RawItem>(req.body.items ?? []);
    if (!rawItems.length) {
      return res.status(400).json({ error: "No items provided" });
    }

    const normalized = await Promise.all(rawItems.map((i, idx) => normalizeItem(i, idx)));
    const batch = normalized.map((n) => ({ product_id: n.product_id, quantity: n.quantity_sold }));

    // Decrement stock for added items
    try {
      await sellBatch(batch);
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (status === 409) {
        return res.status(409).json({ error: "Insufficient stock", details: data });
      }
      logError("addSaleItems:sellBatch", err);
      return res.status(502).json({ error: "Stock service unavailable" });
    }

    try {
      const result = await db.transaction(async (tx) => {
        let totalGrossProfitDelta = 0;

        for (const item of normalized) {
          const costPriceRaw = await getLatestPurchasePrice(item.product_id);
          const effectiveCost = resolveEffectiveCost(costPriceRaw, item);
          if (Number.isNaN(effectiveCost)) {
            throw new Error(`No purchase record found for product ${item.product_id}`);
          }

          await tx.insert(accounts_saleitem).values({
            sale_id: saleId,
            product_id: item.product_id,
            quantity_sold: toDecimalString(item.quantity_sold, 2),
            sale_price_per_quantity: toDecimalString(item.sale_price_per_quantity, 2),
            total_sale_price: toDecimalString(item.total_sale_price, 2),
          });

          const grossProfit = (item.sale_price_per_quantity - effectiveCost) * item.quantity_sold;
          totalGrossProfitDelta += grossProfit;
        }

        // Recompute profit for entire sale
        await recomputeProfitForSale(tx, saleId);

        // Return updated sale header + items
        const [header] = await tx
          .select({
            id: accounts_sale.id,
            customer_id: accounts_sale.customer_id,
            sold_at: accounts_sale.sold_at,
            total_amount: sql<string>`COALESCE(SUM(${accounts_saleitem.total_sale_price}::numeric), 0)`,
          })
          .from(accounts_sale)
          .leftJoin(accounts_saleitem, eq(accounts_sale.id, accounts_saleitem.sale_id))
          .where(eq(accounts_sale.id, saleId))
          .groupBy(accounts_sale.id, accounts_sale.customer_id, accounts_sale.sold_at);

        const items = await tx.select().from(accounts_saleitem).where(eq(accounts_saleitem.sale_id, saleId));

        return { ...header, items };
      });

      res.status(201).json(result);
    } catch (txErr: any) {
      // compensation: restore stock
      try { await restoreBatch(batch); } catch (e) { logError("addSaleItems:restoreBatch", e); }
      logError("addSaleItems:tx", txErr);
      return res.status(500).json({ error: txErr?.message || "Failed to add sale items" });
    }
  } catch (err: any) {
    logError("addSaleItems", err);
    return res.status(500).json({ error: err?.message || "Failed to add sale items" });
  }
}

/**
 * POST /sales/returns/process
 * Body: { saleitem_id: number, quantity_returned: number }
 * Called by returns-service to:
 *  - decrement saleitem quantity_sold and total_sale_price
 *  - restore stock in products-service
 *  - recompute sale profit
 */
export async function processReturn(req: Request, res: Response) {
  try {
    const saleitem_id = Number(req.body?.saleitem_id || 0);
    const quantity_returned = Number(req.body?.quantity_returned || 0);
    if (!saleitem_id || saleitem_id <= 0) {
      return res.status(400).json({ error: "saleitem_id is required" });
    }
    if (!quantity_returned || quantity_returned <= 0) {
      return res.status(400).json({ error: "quantity_returned must be > 0" });
    }

    const rows = await db.select().from(accounts_saleitem).where(eq(accounts_saleitem.id, saleitem_id));
    const saleItem = rows[0];
    if (!saleItem) return res.status(404).json({ error: "Sale item not found" });
    
    const quantitySold = Number(saleItem.quantity_sold ?? 0);
    if (quantity_returned > quantitySold) {
      return res.status(400).json({
        error: "Return quantity cannot exceed item quantity_sold",
      });
    }

    const result = await db.transaction(async (tx) => {
      const newQty = quantitySold - quantity_returned;
      const unitPrice = Number(saleItem.sale_price_per_quantity ?? 0);
      const newTotal = Math.max(0, newQty * unitPrice);

      // Update sale item
      await tx
        .update(accounts_saleitem)
        .set({
          quantity_sold: sql`${newQty.toFixed(2)}`,
          total_sale_price: sql`${newTotal.toFixed(2)}`,
        })
        .where(eq(accounts_saleitem.id, saleitem_id));

      // Restore stock in product-service
      const productId = Number(saleItem.product_id);
      try {
        await axios.post(
          `${PRODUCTS_SERVICE_URL}/products/stock/restore-batch`,
          { items: [{ product_id: productId, quantity: quantity_returned }] },
          { headers: { "Content-Type": "application/json", Accept: "application/json" }, timeout: 10_000 }
        );
      } catch (err) {
        logError("returns:restore-batch", err);
        throw new Error("Failed to restore stock");
      }

      // Recompute profit for sale
      const saleId = Number(saleItem.sale_id);
      await recomputeProfitForSale(tx, saleId);

      // Return the updated sale header (re-summed)
      const [header] = await tx
        .select({
          id: accounts_sale.id,
          customer_id: accounts_sale.customer_id,
          sold_at: accounts_sale.sold_at,
          total_amount: sql<string>`COALESCE(SUM(${accounts_saleitem.total_sale_price}::numeric), 0)`,
        })
        .from(accounts_sale)
        .leftJoin(accounts_saleitem, eq(accounts_sale.id, accounts_saleitem.sale_id))
        .where(eq(accounts_sale.id, saleId))
        .groupBy(accounts_sale.id, accounts_sale.customer_id, accounts_sale.sold_at);

      return {
        sale_update: {
          sale_id: saleId,
          saleitem_id,
          new_quantity_sold: newQty,
          new_total_sale_price: Number(newTotal.toFixed(2)),
          sale_total_amount: Number(header?.total_amount ?? 0),
        },
      };
    });

    res.json(result);
  } catch (err: any) {
    logError("processReturn", err);
    res.status(500).json({ error: err.message || "Failed to process return" });
  }
}

/**
 * DELETE /sales/:id
 */
export async function deleteSale(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await db.delete(accounts_sale).where(eq(accounts_sale.id, Number(id)));
    res.json({ message: "Sale deleted" });
  } catch (err: any) {
    logError("deleteSale", err);
    res.status(500).json({ error: err.message || "Failed to delete sale" });
  }
}

/**
 * Profit summary: GET /sales/profit/summary?from=&to=
 */
export async function getProfitSummary(req: Request, res: Response) {
  try {
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const [revenueRow] = await db
      .select({
        revenue: sql<string>`COALESCE(SUM(${accounts_saleitem.total_sale_price}::numeric), 0)`,
        orders: sql<number>`COUNT(DISTINCT ${accounts_sale.id})`,
      })
      .from(accounts_sale)
      .leftJoin(accounts_saleitem, eq(accounts_sale.id, accounts_saleitem.sale_id))
      .where(and(gte(accounts_sale.sold_at, from), lte(accounts_sale.sold_at, to)));

    const [profitRow] = await db
      .select({
        gross_profit: sql<string>`COALESCE(SUM(${accounts_profittracker.gross_profit}::numeric), 0)`,
        net_profit: sql<string>`COALESCE(SUM(${accounts_profittracker.net_profit}::numeric), 0)`,
      })
      .from(accounts_profittracker)
      .leftJoin(accounts_sale, eq(accounts_profittracker.sale_id, accounts_sale.id))
      .where(and(gte(accounts_sale.sold_at, from), lte(accounts_sale.sold_at, to)));

    const revenue = Number(revenueRow?.revenue ?? 0);
    const orders = Number(revenueRow?.orders ?? 0);
    const gross_profit = Number(profitRow?.gross_profit ?? 0);
    const net_profit = Number(profitRow?.net_profit ?? 0);
    const profit_margin = revenue > 0 ? (net_profit / revenue) * 100 : 0;

    res.json({ revenue, gross_profit, net_profit, profit_margin, orders, from, to });
  } catch (err: any) {
    logError("getProfitSummary", err);
    res.status(500).json({ error: err.message || "Failed to fetch profit summary" });
  }
}

/**
 * Profit timeline: GET /sales/profit/timeline?view=daily|weekly|monthly&from=&to=
 */
export async function getProfitTimeline(req: Request, res: Response) {
  try {
    const view = String(req.query.view || "daily").toLowerCase();
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const bucket = view === "monthly" ? "month" : view === "weekly" ? "week" : "day";

    const rows = await db
      .select({
        bucket: sql<string>`TO_CHAR(DATE_TRUNC(${sql.raw(`'${bucket}'`)}, ${accounts_sale.sold_at}), ${sql.raw(`'YYYY-MM-DD'`)})`,
        revenue: sql<string>`COALESCE(SUM(${accounts_saleitem.total_sale_price}::numeric), 0)`,
        gross_profit: sql<string>`COALESCE(SUM(${accounts_profittracker.gross_profit}::numeric), 0)`,
        net_profit: sql<string>`COALESCE(SUM(${accounts_profittracker.net_profit}::numeric), 0)`,
        orders: sql<number>`COUNT(DISTINCT ${accounts_sale.id})`,
      })
      .from(accounts_sale)
      .leftJoin(accounts_saleitem, eq(accounts_sale.id, accounts_saleitem.sale_id))
      .leftJoin(accounts_profittracker, eq(accounts_profittracker.sale_id, accounts_sale.id))
      .where(and(gte(accounts_sale.sold_at, from), lte(accounts_sale.sold_at, to)))
      .groupBy(sql`DATE_TRUNC(${sql.raw(`'${bucket}'`)}, ${accounts_sale.sold_at})`)
      .orderBy(sql`DATE_TRUNC(${sql.raw(`'${bucket}'`)}, ${accounts_sale.sold_at})`);

    const points = rows.map((r) => ({
      label: r.bucket,
      revenue: Number(r.revenue ?? 0),
      gross_profit: Number(r.gross_profit ?? 0),
      net_profit: Number(r.net_profit ?? 0),
      orders: Number(r.orders ?? 0),
    }));

    res.json(points);
  } catch (err: any) {
    logError("getProfitTimeline", err);
    res.status(500).json({ error: err.message || "Failed to fetch profit timeline" });
  }
}

/**
 * Profit transactions: GET /sales/profit/transactions?limit=&offset=
 */
export async function getProfitTransactions(req: Request, res: Response) {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query.limit ?? 20)));
    const offset = Math.max(0, Number(req.query.offset ?? 0));

    const rows = await db
      .select({
        id: accounts_sale.id,
        sold_at: accounts_sale.sold_at,
        total_amount: sql<string>`COALESCE(SUM(${accounts_saleitem.total_sale_price}::numeric), 0)`,
        gross_profit: sql<string>`COALESCE(SUM(${accounts_profittracker.gross_profit}::numeric), 0)`,
        net_profit: sql<string>`COALESCE(SUM(${accounts_profittracker.net_profit}::numeric), 0)`,
      })
      .from(accounts_sale)
      .leftJoin(accounts_saleitem, eq(accounts_sale.id, accounts_saleitem.sale_id))
      .leftJoin(accounts_profittracker, eq(accounts_profittracker.sale_id, accounts_sale.id))
      .groupBy(accounts_sale.id, accounts_sale.sold_at)
      .orderBy(sql`${accounts_sale.sold_at} DESC`)
      .limit(limit)
      .offset(offset);

    const txs = rows.map((r) => ({
      id: r.id,
      sold_at: r.sold_at,
      total_amount: Number(r.total_amount ?? 0),
      gross_profit: Number(r.gross_profit ?? 0),
      net_profit: Number(r.net_profit ?? 0),
    }));

    res.json(txs);
  } catch (err: any) {
    logError("getProfitTransactions", err);
    res.status(500).json({ error: err.message || "Failed to fetch profit transactions" });
  }
}

// Stubs — optional to implement later
export async function getProfitTracker(_req: Request, res: Response) {
  res.json({ message: "Not implemented" });
}
export async function updateProfitTracker(_req: Request, res: Response) {
  res.json({ message: "Not implemented" });
}