import { Request, Response } from "express";
import { db } from "../db/db";
import { accounts_expense } from "../db/schema/accounts_expense";

// Get all expenses
export async function getAllExpenses(req: Request, res: Response) {
  const expenses = await db.select().from(accounts_expense);
  res.json(expenses);
}

// Create expense
export async function createExpense(req: Request, res: Response) {
  const {  description, amount, date_incurred } = req.body;
  await db.insert(accounts_expense).values({  description, amount, date_incurred });
  res.status(201).json({ message: "Expense recorded" });
}