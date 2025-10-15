import { Router } from "express";
import {
  // Sales CRUD
  getAllSales,
  getSaleById,
  createSale,
  deleteSale,

  // Items
  addSaleItems,
  getSaleItems,
  getSaleItemById,

  // Returns processing (initiated by returns-service)
  processReturn,

  // Profit/Reports
  getProfitSummary,
  getProfitTimeline,
  getProfitTransactions,
  getProfitTracker,
  updateProfitTracker,
} from "../services/salesService";

const router = Router();

/**
 * IMPORTANT: Route ordering matters in Express.
 * Keep specific routes (like /items/*) BEFORE the parameterized '/:id' to avoid shadowing.
 */

// Items
router.get("/items/all", getSaleItems);
router.get("/items/:id", getSaleItemById); // Used by returns-service
router.post("/:id/items", addSaleItems);

// Sales CRUD
router.get("/", getAllSales);
router.get("/:id", getSaleById);
router.post("/", createSale);
router.delete("/:id", deleteSale);

// Returns (mutation is executed by sales-service upon request from returns-service)
router.post("/returns/process", processReturn); // Called by returns-service

// Profit/Reports
router.get("/profit/summary", getProfitSummary);
router.get("/profit/timeline", getProfitTimeline);
router.get("/profit/transactions", getProfitTransactions);
router.get("/profit/tracker", getProfitTracker);
router.patch("/profit/:id", updateProfitTracker);

export default router;