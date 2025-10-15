import { Router } from "express";
import * as customerService from "../services/customerService";

const router = Router();

router.get("/", customerService.getAllCustomers);
router.post("/", customerService.createCustomer);
router.get("/:id", customerService.getCustomerById);
router.put("/:id", customerService.updateCustomer);
router.delete("/:id", customerService.deleteCustomer);

export default router;