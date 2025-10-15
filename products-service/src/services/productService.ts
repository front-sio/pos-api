import { Request, Response } from "express";
import { db } from "../db/db";

// Schemas (Drizzle tables and Zod DTOs)
import {
  accounts_product,
  insertProductSchema,
  updateProductSchema,
} from "../db/schema/accounts_product";
import { accounts_purchase } from "../db/schema/accounts_purchase";
import { accounts_purchase_item } from "../db/schema/accounts_purchase_item";
import { accounts_stocktransaction } from "../db/schema/accounts_stocktransaction";
import {
  accounts_unit,
  insertUnitSchema,
  updateUnitSchema,
} from "../db/schema/accounts_unit";
import {
  accounts_category,
  insertCategorySchema,
  updateCategorySchema,
} from "../db/schema/accounts_category";

import { eq, inArray, sql } from "drizzle-orm";
import { ZodError, z } from "zod";

/* =============================================================================
   Helpers
============================================================================= */

// Coerce numeric/decimal fields to string so they serialize safely for PG numeric
function toDecimalStrings(body: any, fields: string[]) {
  const copy = { ...body };
  fields.forEach((f) => {
    if (copy[f] !== undefined && copy[f] !== null) copy[f] = String(copy[f]);
  });
  return copy;
}

async function findOrCreateUnitByName(name?: string | null) {
  if (!name) return undefined;
  const existing = await db
    .select()
    .from(accounts_unit)
    .where(eq(accounts_unit.name, name))
    .limit(1);
  if (existing.length) return existing[0].id;
  const [row] = await db
    .insert(accounts_unit)
    .values({ name })
    .returning({ id: accounts_unit.id });
  return row.id;
}

async function findOrCreateCategoryByName(name?: string | null) {
  if (!name) return undefined;
  const existing = await db
    .select()
    .from(accounts_category)
    .where(eq(accounts_category.name, name))
    .limit(1);
  if (existing.length) return existing[0].id;
  const [row] = await db
    .insert(accounts_category)
    .values({ name })
    .returning({ id: accounts_category.id });
  return row.id;
}

// Normalize req.body.items into an array no matter how the gateway/body-parser sent it
function normalizeItems(input: unknown): unknown[] | null {
  try {
    // Already an array
    if (Array.isArray(input)) return input;

    // JSON string
    if (typeof input === "string") {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") {
        const keys = Object.keys(parsed)
          .filter((k) => /^\d+$/.test(k))
          .sort((a, b) => Number(a) - Number(b));
        if (keys.length) return keys.map((k) => (parsed as any)[k]);
      }
      return null;
    }

    // Object with numeric keys: { "0": {...}, "1": {...} }
    if (input && typeof input === "object") {
      const obj = input as Record<string, unknown>;
      const keys = Object.keys(obj)
        .filter((k) => /^\d+$/.test(k))
        .sort((a, b) => Number(a) - Number(b));
      if (keys.length) return keys.map((k) => obj[k]);
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

/* =============================================================================
   Units CRUD
============================================================================= */

export async function getAllUnits(req: Request, res: Response) {
  try {
    const units = await db.select().from(accounts_unit);
    res.json(units);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Failed to fetch units" });
  }
}

export async function getUnitById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const rows = await db
      .select()
      .from(accounts_unit)
      .where(eq(accounts_unit.id, id));
    if (!rows.length) return res.status(404).json({ message: "Unit not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Failed to fetch unit" });
  }
}

export async function createUnit(req: Request, res: Response) {
  try {
    const payload = insertUnitSchema.parse(req.body);
    const [row] = await db
      .insert(accounts_unit)
      .values(payload)
      .returning({ id: accounts_unit.id });
    res.status(201).json({ id: row.id, message: "Unit created" });
  } catch (err) {
    console.error("Create unit error:", err);
    if (err instanceof ZodError)
      return res.status(400).json({ error: "Validation failed", issues: err.issues });
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Failed to create unit" });
  }
}

export async function updateUnit(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const payload = updateUnitSchema.parse(req.body);
    await db
      .update(accounts_unit)
      .set({ ...payload, updated_at: new Date() })
      .where(eq(accounts_unit.id, id));
    res.json({ message: "Unit updated" });
  } catch (err) {
    console.error("Update unit error:", err);
    if (err instanceof ZodError)
      return res.status(400).json({ error: "Validation failed", issues: err.issues });
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Failed to update unit" });
  }
}

export async function deleteUnit(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    await db.delete(accounts_unit).where(eq(accounts_unit.id, id));
    res.json({ message: "Unit deleted" });
  } catch (err) {
    console.error("Delete unit error:", err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Failed to delete unit" });
  }
}

/* =============================================================================
   Categories CRUD
============================================================================= */

export async function getAllCategories(req: Request, res: Response) {
  try {
    const categories = await db.select().from(accounts_category);
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to fetch categories",
    });
  }
}

export async function getCategoryById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const rows = await db
      .select()
      .from(accounts_category)
      .where(eq(accounts_category.id, id));
    if (!rows.length) return res.status(404).json({ message: "Category not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to fetch category",
    });
  }
}

export async function createCategory(req: Request, res: Response) {
  try {
    const payload = insertCategorySchema.parse(req.body);
    const [row] = await db
      .insert(accounts_category)
      .values(payload)
      .returning({ id: accounts_category.id });
    res.status(201).json({ id: row.id, message: "Category created" });
  } catch (err) {
    console.error("Create category error:", err);
    if (err instanceof ZodError)
      return res.status(400).json({ error: "Validation failed", issues: err.issues });
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to create category",
    });
  }
}

export async function updateCategory(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const payload = updateCategorySchema.parse(req.body);
    await db
      .update(accounts_category)
      .set({ ...payload, updated_at: new Date() })
      .where(eq(accounts_category.id, id));
    res.json({ message: "Category updated" });
  } catch (err) {
    console.error("Update category error:", err);
    if (err instanceof ZodError)
      return res.status(400).json({ error: "Validation failed", issues: err.issues });
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to update category",
    });
  }
}

export async function deleteCategory(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    await db.delete(accounts_category).where(eq(accounts_category.id, id));
    res.json({ message: "Category deleted" });
  } catch (err) {
    console.error("Delete category error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to delete category",
    });
  }
}

/* =============================================================================
   Products CRUD
============================================================================= */

export async function getAllProducts(req: Request, res: Response) {
  try {
    const rows = await db
      .select({
        id: accounts_product.id,
        name: accounts_product.name,
        description: accounts_product.description,
        initial_quantity: accounts_product.initial_quantity,
        quantity: accounts_product.quantity,
        price_per_quantity: accounts_product.price_per_quantity,
        price: accounts_product.price,
        barcode: accounts_product.barcode,
        unit_id: accounts_product.unit_id,
        unit_name: accounts_unit.name,
        category_id: accounts_product.category_id,
        category_name: accounts_category.name,
        location: accounts_product.location,
        reorder_level: accounts_product.reorder_level,
        supplier: accounts_product.supplier,
        supplier_id: accounts_product.supplier_id,
        created_at: accounts_product.created_at,
        updated_at: accounts_product.updated_at,
        total_value: sql<number>`
          (
            COALESCE(${accounts_product.quantity}::numeric, 0)
            *
            COALESCE(${accounts_product.price_per_quantity}::numeric, 0)
          )::float8
        `,
      })
      .from(accounts_product)
      .leftJoin(accounts_unit, eq(accounts_product.unit_id, accounts_unit.id))
      .leftJoin(
        accounts_category,
        eq(accounts_product.category_id, accounts_category.id)
      )
      .orderBy(accounts_product.id);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error:
        err instanceof Error ? err.message : "An unknown error occurred",
    });
  }
}

export async function getProductById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const rows = await db
      .select({
        id: accounts_product.id,
        name: accounts_product.name,
        description: accounts_product.description,
        initial_quantity: accounts_product.initial_quantity,
        quantity: accounts_product.quantity,
        price_per_quantity: accounts_product.price_per_quantity,
        price: accounts_product.price,
        barcode: accounts_product.barcode,
        unit_id: accounts_product.unit_id,
        unit_name: accounts_unit.name,
        category_id: accounts_product.category_id,
        category_name: accounts_category.name,
        location: accounts_product.location,
        reorder_level: accounts_product.reorder_level,
        supplier: accounts_product.supplier,
        supplier_id: accounts_product.supplier_id,
        created_at: accounts_product.created_at,
        updated_at: accounts_product.updated_at,
        total_value: sql<number>`
          (
            COALESCE(${accounts_product.quantity}::numeric, 0)
            *
            COALESCE(${accounts_product.price_per_quantity}::numeric, 0)
          )::float8
        `,
      })
      .from(accounts_product)
      .leftJoin(accounts_unit, eq(accounts_product.unit_id, accounts_unit.id))
      .leftJoin(
        accounts_category,
        eq(accounts_product.category_id, accounts_category.id)
      )
      .where(eq(accounts_product.id, Number(id)));

    if (!rows.length) return res.status(404).json({ message: "Product not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error:
        err instanceof Error ? err.message : "An unknown error occurred",
    });
  }
}

export async function createProduct(req: Request, res: Response) {
  try {
    // Backward-compat aliasing: accept 'unit' and 'category' strings
    const bodyAliased = { ...req.body };
    if (bodyAliased.unit && !bodyAliased.unit_name)
      bodyAliased.unit_name = bodyAliased.unit;
    if (bodyAliased.category && !bodyAliased.category_name)
      bodyAliased.category_name = bodyAliased.category;

    const body0 = toDecimalStrings(bodyAliased, [
      "quantity",
      "initial_quantity",
      "price",
      "price_per_quantity",
      "reorder_level",
    ]);

    const payload = insertProductSchema.parse(body0);

    // Resolve unit/category IDs if names provided
    let unitId = payload.unit_id ?? undefined;
    let categoryId = payload.category_id ?? undefined;

    if (!unitId && payload.unit_name) {
      unitId = await findOrCreateUnitByName(payload.unit_name);
    }
    if (!categoryId && payload.category_name) {
      categoryId = await findOrCreateCategoryByName(payload.category_name);
    }

    const [newProduct] = await db
      .insert(accounts_product)
      .values({
        name: payload.name,
        description: payload.description ?? null,
        initial_quantity: payload.initial_quantity as any,
        quantity: payload.quantity as any,
        price_per_quantity: payload.price_per_quantity as any,
        price: payload.price as any,
        barcode: payload.barcode ?? null,
        unit_id: unitId ?? null,
        category_id: categoryId ?? null,
        location: payload.location ?? null,
        reorder_level: payload.reorder_level as any,
        supplier: payload.supplier ?? null,
        supplier_id: (payload.supplier_id as number | undefined) ?? null,
      })
      .returning({ id: accounts_product.id });

    res.status(201).json({ id: newProduct.id, message: "Product created" });
  } catch (err) {
    console.error("Create product error:", err);
    if (err instanceof ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        issues: err.issues,
      });
    }
    res.status(500).json({
      error:
        err instanceof Error ? err.message : "An unknown error occurred",
    });
  }
}

export async function updateProduct(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Backward-compat aliasing
    const bodyAliased = { ...req.body };
    if (bodyAliased.unit && !bodyAliased.unit_name)
      bodyAliased.unit_name = bodyAliased.unit;
    if (bodyAliased.category && !bodyAliased.category_name)
      bodyAliased.category_name = bodyAliased.category;

    const body0 = toDecimalStrings(bodyAliased, [
      "quantity",
      "initial_quantity",
      "price",
      "price_per_quantity",
      "reorder_level",
    ]);

    const payload = updateProductSchema.parse(body0);

    let unitId = payload.unit_id ?? undefined;
    let categoryId = payload.category_id ?? undefined;

    if (!unitId && payload.unit_name) {
      unitId = await findOrCreateUnitByName(payload.unit_name);
    }
    if (!categoryId && payload.category_name) {
      categoryId = await findOrCreateCategoryByName(payload.category_name);
    }

    await db
      .update(accounts_product)
      .set({
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.description !== undefined
          ? { description: payload.description }
          : {}),
        ...(payload.initial_quantity !== undefined
          ? { initial_quantity: payload.initial_quantity as any }
          : {}),
        ...(payload.quantity !== undefined ? { quantity: payload.quantity as any } : {}),
        ...(payload.price_per_quantity !== undefined
          ? { price_per_quantity: payload.price_per_quantity as any }
          : {}),
        ...(payload.price !== undefined ? { price: payload.price as any } : {}),
        ...(payload.barcode !== undefined ? { barcode: payload.barcode } : {}),
        ...(unitId !== undefined ? { unit_id: unitId } : {}),
        ...(categoryId !== undefined ? { category_id: categoryId } : {}),
        ...(payload.location !== undefined ? { location: payload.location } : {}),
        ...(payload.reorder_level !== undefined
          ? { reorder_level: payload.reorder_level as any }
          : {}),
        ...(payload.supplier !== undefined ? { supplier: payload.supplier } : {}),
        ...(payload.supplier_id !== undefined
          ? { supplier_id: payload.supplier_id }
          : {}),
        updated_at: new Date(),
      })
      .where(eq(accounts_product.id, Number(id)));

    res.json({ message: "Product updated" });
  } catch (err) {
    console.error("Update product error:", err);
    if (err instanceof ZodError) {
      return res.status(400).json({
        error: "Validation failed for update",
        issues: err.issues,
      });
    }
    res.status(500).json({
      error:
        err instanceof Error ? err.message : "An unknown error occurred",
    });
  }
}

export async function deleteProduct(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await db.delete(accounts_product).where(eq(accounts_product.id, Number(id)));
    res.json({ message: "Product deleted" });
  } catch (err) {
    console.error("Delete product error:", err);
    res.status(500).json({
      error:
        err instanceof Error ? err.message : "An unknown error occurred",
    });
  }
}

/* =============================================================================
   Stock
============================================================================= */

export async function addStock(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { amount, price_per_unit, user_id, supplier_id } = req.body;

    const numericAmount = Number(amount);
    const numericPricePerUnit = Number(price_per_unit);
    const numericUserId = Number(user_id);
    const numericProductId = Number(id);
    const numericSupplierId =
      supplier_id !== undefined && supplier_id !== null
        ? Number(supplier_id)
        : undefined;

    if (
      isNaN(numericAmount) ||
      isNaN(numericPricePerUnit) ||
      isNaN(numericUserId) ||
      isNaN(numericProductId)
    ) {
      return res.status(400).json({ error: "Invalid numeric input provided." });
    }

    const total_cost = numericAmount * numericPricePerUnit;

    await db.transaction(async (trx) => {
      await trx.insert(accounts_stocktransaction).values({
        product_id: numericProductId,
        user_id: numericUserId,
        supplier_id: numericSupplierId,
        amount_added: numericAmount,
        price_per_unit: numericPricePerUnit.toFixed(2),
        total_cost: total_cost.toFixed(2),
      });

      await trx
        .update(accounts_product)
        .set({
          quantity: sql`${accounts_product.quantity} + ${numericAmount.toString()}`,
          ...(numericSupplierId !== undefined ? { supplier_id: numericSupplierId } : {}),
          updated_at: new Date(),
        })
        .where(eq(accounts_product.id, numericProductId));
    });

    res
      .status(201)
      .json({ message: "Stock added and product quantity updated." });
  } catch (err) {
    console.error("Add stock error:", err);
    res.status(500).json({
      error:
        err instanceof Error ? err.message : "An unknown error occurred",
    });
  }
}


// NEW: Batch sell (decrement) stock for multiple products atomically
const batchItemsSchema = z.object({
  items: z.array(
    z.object({
      product_id: z.number().int().positive(),
      quantity: z.number().positive(),
    })
  ).min(1, "At least one item is required"),
});

export async function sellBatchStock(req: Request, res: Response) {
  try {
    const payload = batchItemsSchema.parse(req.body);
    const productIds = payload.items.map(i => i.product_id);

    // Fetch all products involved
    const rows = await db
      .select({
        id: accounts_product.id,
        quantity: accounts_product.quantity,
      })
      .from(accounts_product)
      .where(inArray(accounts_product.id, productIds));

    const byId = new Map<number, number>();
    for (const r of rows) byId.set(Number(r.id), Number(r.quantity ?? 0));

    const missing: number[] = [];
    const insufficient: Array<{ product_id: number; requested: number; available: number }> = [];

    for (const it of payload.items) {
      const available = byId.get(it.product_id);
      if (available === undefined) {
        missing.push(it.product_id);
      } else if (available < it.quantity) {
        insufficient.push({ product_id: it.product_id, requested: it.quantity, available });
      }
    }

    if (missing.length || insufficient.length) {
      return res.status(409).json({
        error: "Insufficient stock",
        details: { missing, insufficient },
      });
    }

    // All good: apply updates atomically and record transactions
    await db.transaction(async (trx) => {
      for (const it of payload.items) {
        await trx
          .update(accounts_product)
          .set({
            quantity: sql`${accounts_product.quantity} - ${String(it.quantity)}`,
            updated_at: new Date(),
          })
          .where(eq(accounts_product.id, it.product_id));

        // Record transaction (negative amount for sell)
        await trx.insert(accounts_stocktransaction).values({
          product_id: it.product_id,
          user_id: 1, // TODO: bind authenticated user
          supplier_id: null,
          amount_added: -Math.abs(it.quantity),
          price_per_unit: "0.00",
          total_cost: "0.00",
        });
      }
    });

    return res.json({ message: "Stock decremented (batch) successfully" });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: "Validation failed", issues: err.issues });
    }
    console.error("sellBatchStock error:", err);
    return res.status(500).json({
      error:
        err instanceof Error ? err.message : "An unknown error occurred",
    });
  }
}

export async function restoreBatchStock(req: Request, res: Response) {
  try {
    const payload = batchItemsSchema.parse(req.body);
    const productIds = payload.items.map(i => i.product_id);

    // Confirm products exist
    const rows = await db
      .select({ id: accounts_product.id })
      .from(accounts_product)
      .where(inArray(accounts_product.id, productIds));

    const existing = new Set(rows.map(r => Number(r.id)));
    const missing: number[] = productIds.filter(id => !existing.has(id));

    if (missing.length) {
      return res.status(404).json({
        error: "Some products were not found",
        details: { missing },
      });
    }

    await db.transaction(async (trx) => {
      for (const it of payload.items) {
        await trx
          .update(accounts_product)
          .set({
            quantity: sql`${accounts_product.quantity} + ${String(it.quantity)}`,
            updated_at: new Date(),
          })
          .where(eq(accounts_product.id, it.product_id));

        // Record transaction (positive amount for restore)
        await trx.insert(accounts_stocktransaction).values({
          product_id: it.product_id,
          user_id: 1, // TODO: bind authenticated user
          supplier_id: null,
          amount_added: Math.abs(it.quantity),
          price_per_unit: "0.00",
          total_cost: "0.00",
        });
      }
    });

    return res.json({ message: "Stock restored (batch) successfully" });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: "Validation failed", issues: err.issues });
    }
    console.error("restoreBatchStock error:", err);
    return res.status(500).json({
      error:
        err instanceof Error ? err.message : "An unknown error occurred",
    });
  }
}

export async function getStockTransactions(req: Request, res: Response) {
  try {
    const rows = await db
      .select({
        id: accounts_stocktransaction.id,
        product_id: accounts_stocktransaction.product_id,
        user_id: accounts_stocktransaction.user_id,
        supplier_id: accounts_stocktransaction.supplier_id,
        amount_added: accounts_stocktransaction.amount_added,
        price_per_unit: accounts_stocktransaction.price_per_unit,
        total_cost: accounts_stocktransaction.total_cost,
        timestamp: accounts_stocktransaction.timestamp,
        product_name: accounts_product.name,
        unit_name: accounts_unit.name,
      })
      .from(accounts_stocktransaction)
      .leftJoin(
        accounts_product,
        eq(accounts_product.id, accounts_stocktransaction.product_id)
      )
      .leftJoin(accounts_unit, eq(accounts_unit.id, accounts_product.unit_id))
      .orderBy(accounts_stocktransaction.id);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error:
        err instanceof Error ? err.message : "An unknown error occurred",
    });
  }
}

export async function updateProductStock(req: Request, res: Response) {
  try {
    const { productId } = req.params;
    const { amount_sold } = req.body;
    const numericAmountSold = Number(amount_sold);
    if (isNaN(numericAmountSold) || numericAmountSold <= 0) {
      return res.status(400).json({ error: "Invalid amount_sold" });
    }
    await db
      .update(accounts_product)
      .set({
        quantity: sql`${accounts_product.quantity} - ${numericAmountSold.toString()}`,
        updated_at: new Date(),
      })
      .where(eq(accounts_product.id, Number(productId)));

    res.json({ message: "Product stock decremented." });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error:
        err instanceof Error ? err.message : "An unknown error occurred",
    });
  }
}

/* =============================================================================
   Purchases (multi-item header + items; legacy single-line fallback)
============================================================================= */

// Multi-item line
const purchaseItemSchema = z.object({
  product_id: z.number(),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  price_per_unit: z.union([z.string(), z.number()]),
});

// Header (purchase order)
const createPurchaseOrderSchema = z.object({
  supplier_id: z.number().optional(),
  status: z.enum(["paid", "unpaid", "credited"]).default("unpaid"),
  paid_amount: z.union([z.string(), z.number()]).optional(),
  notes: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1, "At least one item is required"),
});

// Legacy single-line schema
const insertPurchaseSchemaLegacy = z.object({
  product_id: z.number(),
  quantity_added: z.number().min(1, "Quantity added must be at least 1"),
  price_per_quantity: z.string().min(1, "Price per quantity is required"),
  supplier_id: z.number().optional(),
});

export async function getPurchases(req: Request, res: Response) {
  try {
    // Headers
    const headers = await db
      .select({
        id: accounts_purchase.id,
        supplier_id: accounts_purchase.supplier_id,
        status: accounts_purchase.status,
        paid_amount: accounts_purchase.paid_amount,
        subtotal: accounts_purchase.subtotal,
        total: accounts_purchase.total,
        date: accounts_purchase.date,
        notes: accounts_purchase.notes,
      })
      .from(accounts_purchase)
      .orderBy(accounts_purchase.id);

    if (!headers.length) return res.json([]);

    const ids = headers.map((h) => h.id);

    // Items with product/unit names
    const itemsRows = await db
      .select({
        id: accounts_purchase_item.id,
        purchase_id: accounts_purchase_item.purchase_id,
        product_id: accounts_purchase_item.product_id,
        quantity: accounts_purchase_item.quantity,
        price_per_unit: accounts_purchase_item.price_per_unit,
        total_cost: accounts_purchase_item.total_cost,
        product_name: accounts_product.name,
        unit_name: accounts_unit.name,
      })
      .from(accounts_purchase_item)
      .leftJoin(
        accounts_product,
        eq(accounts_product.id, accounts_purchase_item.product_id)
      )
      .leftJoin(accounts_unit, eq(accounts_unit.id, accounts_product.unit_id))
      .where(inArray(accounts_purchase_item.purchase_id, ids));

    const itemsByPurchase = new Map<number, any[]>();
    for (const row of itemsRows) {
      const arr = itemsByPurchase.get(row.purchase_id) ?? [];
      arr.push({
        id: row.id,
        product_id: row.product_id,
        quantity: row.quantity,
        price_per_unit: row.price_per_unit,
        total_cost: row.total_cost,
        product_name: row.product_name,
        unit_name: row.unit_name,
      });
      itemsByPurchase.set(row.purchase_id, arr);
    }

    const data = headers.map((h) => {
      const lines = itemsByPurchase.get(h.id) ?? [];
      const computedSubtotal = lines.reduce(
        (sum, li) => sum + parseFloat(String(li.total_cost || "0")),
        0
      );
      const subtotal =
        h.subtotal != null ? parseFloat(String(h.subtotal)) : computedSubtotal;
      const total =
        h.total != null ? parseFloat(String(h.total)) : subtotal;
      const paid =
        h.paid_amount != null ? parseFloat(String(h.paid_amount)) : 0;

      return {
        id: h.id,
        supplier_id: h.supplier_id,
        status: h.status,
        paid_amount: paid,
        subtotal: subtotal,
        total: total,
        date: h.date,
        notes: h.notes,
        items: lines,
      };
    });

    res.json(data);
  } catch (err) {
    console.error("getPurchases error:", err);
    res.status(500).json({
      error:
        err instanceof Error ? err.message : "An unknown error occurred",
    });
  }
}

export async function createPurchase(req: Request, res: Response) {
  try {
    // Normalize items regardless of transport format
    const rawItems = req.body?.items ?? (req as any).items;
    const itemsNormalized = normalizeItems(rawItems);

    // Multi-item path
    if (itemsNormalized && Array.isArray(itemsNormalized)) {
      const payload = createPurchaseOrderSchema.parse(
        toDecimalStrings(
          {
            supplier_id: req.body?.supplier_id,
            status: req.body?.status,
            paid_amount: req.body?.paid_amount,
            notes: req.body?.notes,
            items: itemsNormalized,
          },
          ["paid_amount"]
        )
      );

      const items = payload.items.map((it) => {
        const price =
          typeof it.price_per_unit === "number"
            ? it.price_per_unit
            : parseFloat(it.price_per_unit as string);
        return {
          ...it,
          price_num: price,
          total_num: price * it.quantity,
        };
      });

      const subtotal = items.reduce((s, it) => s + it.total_num, 0);
      const total = subtotal;
      const paid = payload.paid_amount ? parseFloat(String(payload.paid_amount)) : 0;

      await db.transaction(async (trx) => {
        // Insert header
        const [po] = await trx
          .insert(accounts_purchase)
          .values({
            supplier_id: payload.supplier_id,
            status: payload.status,
            subtotal: subtotal.toFixed(2),
            total: total.toFixed(2),
            paid_amount: paid.toFixed(2),
            notes: payload.notes ?? null,
          })
          .returning({ id: accounts_purchase.id });

        const purchaseId = po.id;

        // Insert items + update stock + stock transactions
        for (const it of items) {
          await trx.insert(accounts_purchase_item).values({
            purchase_id: purchaseId,
            product_id: it.product_id,
            quantity: it.quantity,
            price_per_unit: it.price_num.toFixed(2),
            total_cost: it.total_num.toFixed(2),
          });

          await trx
            .update(accounts_product)
            .set({
              quantity: sql`${accounts_product.quantity} + ${String(it.quantity)}`,
              ...(payload.supplier_id !== undefined
                ? { supplier_id: payload.supplier_id }
                : {}),
              updated_at: new Date(),
            })
            .where(eq(accounts_product.id, it.product_id));

          await trx.insert(accounts_stocktransaction).values({
            product_id: it.product_id,
            user_id: 1, // TODO: bind authenticated user
            supplier_id: payload.supplier_id,
            amount_added: it.quantity,
            price_per_unit: it.price_num.toFixed(2),
            total_cost: it.total_num.toFixed(2),
          });
        }
      });

      return res.status(201).json({ message: "Purchase recorded & stock updated" });
    }

    // Legacy single-line path
    const {
      product_id,
      quantity_added,
      price_per_quantity,
      supplier_id,
    } = insertPurchaseSchemaLegacy.parse(req.body);

    await db.transaction(async (trx) => {
      const totalCost = quantity_added * parseFloat(price_per_quantity);
      const [newPurchase] = await trx
        .insert(accounts_purchase)
        .values({
          product_id,
          quantity_added,
          price_per_quantity,
          supplier_id,
          status: "unpaid",
          subtotal: totalCost.toFixed(2),
          total: totalCost.toFixed(2),
          paid_amount: "0.00",
        })
        .returning({ id: accounts_purchase.id });

      await trx
        .update(accounts_product)
        .set({
          quantity: sql`${accounts_product.quantity} + ${quantity_added.toString()}`,
          ...(supplier_id !== undefined ? { supplier_id } : {}),
          updated_at: new Date(),
        })
        .where(eq(accounts_product.id, product_id));

      const numericPricePerQuantity = parseFloat(price_per_quantity);
      await trx.insert(accounts_stocktransaction).values({
        product_id,
        user_id: 1, // TODO: bind authenticated user
        supplier_id,
        amount_added: quantity_added,
        price_per_unit: numericPricePerQuantity.toFixed(2),
        total_cost: (quantity_added * numericPricePerQuantity).toFixed(2),
      });

      res
        .status(201)
        .json({ id: newPurchase.id, message: "Purchase recorded & stock updated" });
    });
  } catch (err) {
    console.error("createPurchase error:", err, "body:", JSON.stringify(req.body));
    if (err instanceof ZodError) {
      return res.status(400).json({ error: "Validation failed", issues: err.issues });
    }
    res.status(500).json({
      error:
        err instanceof Error ? err.message : "An unknown error occurred",
    });
  }
}

// Update settlement/payment fields on a purchase header
const updatePaymentSchema = z.object({
  paid_amount: z.union([z.string(), z.number()]),
  status: z.enum(["paid", "unpaid", "credited"]).optional(),
});

export async function updatePurchasePayment(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const payload = updatePaymentSchema.parse(
      toDecimalStrings(req.body, ["paid_amount"])
    );

    await db
      .update(accounts_purchase)
      .set({
        paid_amount: String(payload.paid_amount),
        ...(payload.status ? { status: payload.status } : {}),
      })
      .where(eq(accounts_purchase.id, id));

    res.json({ message: "Purchase payment updated" });
  } catch (err) {
    console.error("updatePurchasePayment error:", err);
    if (err instanceof ZodError) {
      return res.status(400).json({ error: "Validation failed", issues: err.issues });
    }
    res.status(500).json({
      error:
        err instanceof Error ? err.message : "An unknown error occurred",
    });
  }
}

// Sales-Service helper: latest price per quantity for a product (legacy)
export async function getLatestPurchasePrice(req: Request, res: Response) {
  try {
    const { productId } = req.params;
    const pid = Number(productId);
    if (!pid || Number.isNaN(pid)) {
      return res.status(400).json({ error: "Invalid productId" });
    }

    // Look up the most recent purchase line for this product (multi-item purchases)
    const rows = await db
      .select({
        price_per_unit: accounts_purchase_item.price_per_unit,
        date: accounts_purchase.date,
        item_id: accounts_purchase_item.id,
      })
      .from(accounts_purchase_item)
      .leftJoin(
        accounts_purchase,
        eq(accounts_purchase_item.purchase_id, accounts_purchase.id)
      )
      .where(eq(accounts_purchase_item.product_id, pid))
      .orderBy(
        sql`${accounts_purchase.date} DESC NULLS LAST`,
        sql`${accounts_purchase_item.id} DESC`
      )
      .limit(1);

    if (!rows.length) {
      return res
        .status(404)
        .json({ error: `No purchase record found for product ${productId}` });
    }

    // Keep response shape backward-compatible
    return res.json({ price_per_quantity: rows[0].price_per_unit });
  } catch (err: unknown) {
    console.error("getLatestPurchasePrice error:", err);
    return res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}