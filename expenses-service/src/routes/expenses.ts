import { Router } from "express";
import * as expenseService from "../services/expenseService";

const router = Router();

router.get("/", expenseService.getAllExpenses);
router.post("/", expenseService.createExpense);

export default router;