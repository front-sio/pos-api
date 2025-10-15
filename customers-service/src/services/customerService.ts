import { Request, Response } from "express";
import { db } from "../db/db";
import { accounts_customer } from "../db/schema/accounts_customer";
import { eq } from "drizzle-orm";

// Get all customers
export async function getAllCustomers(req: Request, res: Response) {
  try {
    const customers = await db.select().from(accounts_customer);
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customers" });
  }
}

// Get customer by ID
export async function getCustomerById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const customer = await db
      .select()
      .from(accounts_customer)
      .where(eq(accounts_customer.id, Number(id)));

    if (!customer.length) return res.status(404).json({ message: "Customer not found" });
    res.json(customer[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer" });
  }
}

// Create customer
export async function createCustomer(req: Request, res: Response) {
  try {
    const { name } = req.body;

    const [newCustomer] = await db
      .insert(accounts_customer)
      .values({ name })
      .returning({ id: accounts_customer.id });

    res.status(201).json({ id: newCustomer.id, message: "Customer created" });
  } catch (err) {
    res.status(500).json({ error: "Failed to create customer" });
  }
}

// Update customer
export async function updateCustomer(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name } = req.body;

    await db.update(accounts_customer).set({ name }).where(eq(accounts_customer.id, Number(id)));
    res.json({ message: "Customer updated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update customer" });
  }
}

// Delete customer
export async function deleteCustomer(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await db.delete(accounts_customer).where(eq(accounts_customer.id, Number(id)));
    res.json({ message: "Customer deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete customer" });
  }
}
