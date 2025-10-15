import { Router } from "express";
import { getAllReturns, getReturnById, getReturnsBySaleId, createReturn } from "../services/returnService";

const router = Router();

router.get("/", getAllReturns);
router.get("/by-sale/:saleId", getReturnsBySaleId); // specific first
router.get("/:id", getReturnById);
router.post("/", createReturn);

export default router;