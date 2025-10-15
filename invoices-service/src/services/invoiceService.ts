import { Request, Response } from "express";
import { db } from "../db/db";
import { accounts_invoice } from "../db/schema/accounts_invoice";
import { accounts_invoice_sales } from "../db/schema/accounts_invoice_sales";
import { accounts_payment } from "../db/schema/accounts_payment";
import { eq } from "drizzle-orm";

function logError(where: string, err: unknown) {
  console.error(`[invoices-service][${where}]`, err);
}

export async function getAllInvoices(_req: Request, res: Response) {
  try {
    const invoices = await db.select().from(accounts_invoice);
    res.json(invoices);
  } catch (err) {
    logError("getAllInvoices", err);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
}

export async function getInvoiceById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const invoice = await db.select().from(accounts_invoice).where(eq(accounts_invoice.id, Number(id)));
    if (!invoice.length) return res.status(404).json({ message: "Invoice not found" });
    res.json(invoice[0]);
  } catch (err) {
    logError("getInvoiceById", err);
    res.status(500).json({ error: "Failed to fetch invoice" });
  }
}

export async function createInvoice(req: Request, res: Response) {
  try {
    const { customer_id, total_amount, status, sales } = req.body;
    if (!customer_id || total_amount == null) {
      return res.status(400).json({ error: "customer_id and total_amount are required" });
    }
    const [newInvoice] = await db
      .insert(accounts_invoice)
      .values({
        customer_id: Number(customer_id),
        total_amount: String(total_amount),
        status: status ?? "unpaid",
      })
      .returning({ id: accounts_invoice.id });

    const invoice_id = newInvoice.id;

    if (Array.isArray(sales) && sales.length) {
      for (const sale_id of sales) {
        await db.insert(accounts_invoice_sales).values({ invoice_id, sale_id: Number(sale_id) });
      }
    }

    res.status(201).json({ id: invoice_id, message: "Invoice created" });
  } catch (err) {
    logError("createInvoice", err);
    res.status(500).json({ error: "Failed to create invoice" });
  }
}

export async function updateInvoice(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const data = req.body;
    await db.update(accounts_invoice).set(data).where(eq(accounts_invoice.id, Number(id)));
    res.json({ message: "Invoice updated" });
  } catch (err) {
    logError("updateInvoice", err);
    res.status(500).json({ error: "Failed to update invoice" });
  }
}

export async function addPayment(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    if (amount == null) return res.status(400).json({ error: "amount is required" });

    await db.insert(accounts_payment).values({ invoice_id: Number(id), amount: String(amount) });
    res.json({ message: "Payment added" });
  } catch (err) {
    logError("addPayment", err);
    res.status(500).json({ error: "Failed to add payment" });
  }
}

export async function getInvoicePayments(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const payments = await db.select().from(accounts_payment).where(eq(accounts_payment.invoice_id, Number(id)));
    res.json(payments);
  } catch (err) {
    logError("getInvoicePayments", err);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
}

// Optional: summary by sale id (for UI badges)
export async function getInvoiceBySaleId(req: Request, res: Response) {
  try {
    const { saleId } = req.params;
    const links = await db.select().from(accounts_invoice_sales).where(eq(accounts_invoice_sales.sale_id, Number(saleId)));
    if (!links.length) return res.status(404).json({ message: "No invoice for sale" });

    const invoiceId = links[0].invoice_id;
    const [invoice] = await db.select().from(accounts_invoice).where(eq(accounts_invoice.id, invoiceId));
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const pays = await db.select().from(accounts_payment).where(eq(accounts_payment.invoice_id, invoiceId));
    const paid = pays.reduce<number>((s, p: any) => s + Number(p.amount ?? 0), 0);
    const total = Number(invoice.total_amount ?? 0);
    const due = Math.max(0, total - paid);

    res.json({
      invoice_id: invoiceId,
      status: invoice.status,
      total_amount: total,
      paid_amount: paid,
      due_amount: due,
      is_paid: paid >= total,
    });
  } catch (err) {
    logError("getInvoiceBySaleId", err);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
}