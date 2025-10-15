import { Router } from "express";
import * as invoiceService from "../services/invoiceService";

const router = Router();

router.get("/", invoiceService.getAllInvoices);
router.post("/", invoiceService.createInvoice);
router.get("/:id", invoiceService.getInvoiceById);
router.put("/:id", invoiceService.updateInvoice);
router.post("/:id/payments", invoiceService.addPayment);
router.get("/:id/payments", invoiceService.getInvoicePayments);
router.get("/by-sale/:saleId", invoiceService.getInvoiceBySaleId);

export default router;