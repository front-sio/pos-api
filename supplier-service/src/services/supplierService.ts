import { Request, Response } from 'express';
import { db } from '../db/db';
import {
  accounts_supplier,
  insertSupplierSchema,
  updateSupplierSchema,
} from '../db/schema/accounts_supplier';
import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';

export async function getAllSuppliers(req: Request, res: Response) {
  try {
    const rows = await db.select().from(accounts_supplier);
    res.json(rows);
  } catch (err) {
    console.error('getAllSuppliers:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch suppliers' });
  }
}

export async function getSupplierById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const rows = await db.select().from(accounts_supplier).where(eq(accounts_supplier.id, id));
    if (!rows.length) return res.status(404).json({ message: 'Supplier not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('getSupplierById:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch supplier' });
  }
}

export async function createSupplier(req: Request, res: Response) {
  try {
    const payload = insertSupplierSchema.parse(req.body);
    const [row] = await db
      .insert(accounts_supplier)
      .values(payload)
      .returning({ id: accounts_supplier.id });
    res.status(201).json({ id: row.id, message: 'Supplier created' });
  } catch (err) {
    console.error('createSupplier:', err);
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    }
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create supplier' });
  }
}

export async function updateSupplier(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const payload = updateSupplierSchema.parse(req.body);
    await db
      .update(accounts_supplier)
      .set({ ...payload, updated_at: new Date() })
      .where(eq(accounts_supplier.id, id));
    res.json({ message: 'Supplier updated' });
  } catch (err) {
    console.error('updateSupplier:', err);
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    }
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update supplier' });
  }
}

export async function deleteSupplier(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    await db.delete(accounts_supplier).where(eq(accounts_supplier.id, id));
    res.json({ message: 'Supplier deleted' });
  } catch (err) {
    console.error('deleteSupplier:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete supplier' });
  }
}