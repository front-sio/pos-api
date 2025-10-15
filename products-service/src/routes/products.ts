import { Router } from "express";
import {
  // Products
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  // Stock
  addStock,
  getStockTransactions,
  updateProductStock,
  sellBatchStock,          // NEW
  restoreBatchStock,       // NEW
  // Purchases
  getPurchases,
  createPurchase,
  getLatestPurchasePrice,
  updatePurchasePayment, // NEW
  // Units
  getAllUnits,
  getUnitById,
  createUnit,
  updateUnit,
  deleteUnit,
  // Categories
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../services/productService";

const router = Router();

// --- Purchases ---
router.get("/purchases", getPurchases);
router.post("/purchases", createPurchase);
router.get("/purchases/latest/:productId", getLatestPurchasePrice);
router.patch("/purchases/:id/payment", updatePurchasePayment); // NEW

// --- Stock ---
router.post("/:id/add-stock", addStock);
router.get("/stock/transactions", getStockTransactions);
router.patch("/:productId/stock", updateProductStock);

// NEW batch stock endpoints used by sales-service
router.post("/stock/sell-batch", sellBatchStock);
router.post("/stock/restore-batch", restoreBatchStock);

// --- Units CRUD ---
router.get("/units", getAllUnits);
router.get("/units/:id", getUnitById);
router.post("/units", createUnit);
router.patch("/units/:id", updateUnit);
router.delete("/units/:id", deleteUnit);

// --- Categories CRUD ---
router.get("/categories", getAllCategories);
router.get("/categories/:id", getCategoryById);
router.post("/categories", createCategory);
router.patch("/categories/:id", updateCategory);
router.delete("/categories/:id", deleteCategory);

// --- Products ---
router.get("/", getAllProducts);
router.get("/:id", getProductById);
router.post("/", createProduct);
router.patch("/:id", updateProduct);
router.delete("/:id", deleteProduct);

export default router;