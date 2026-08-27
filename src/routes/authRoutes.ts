import { Router } from "express";
import { register } from "../controllers/authController";

const router = Router();

// Ketika ada yang menembak POST ke /register, jalankan fungsi register
router.post("/register", register);

export default router;
