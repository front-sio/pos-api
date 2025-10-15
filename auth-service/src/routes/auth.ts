import { Router } from "express";
import { registerUser, loginUser, getCurrentUser, getAllUsers } from "../services/authService";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", getCurrentUser);
router.get("/users", getAllUsers);

export default router;
