import { Router } from "express";
import { register, login } from "../controllers/authController";

const router = Router();

// Ketika ada yang menembak POST ke /register, jalankan fungsi register
router.post("/register", register);
router.post("/login", login);

export default router;
