import { Router } from "express";
import * as reportService from "../services/reportService";

const router = Router();

router.get("/daily", reportService.dailyReport);
router.get("/monthly", reportService.monthlyReport);

export default router;