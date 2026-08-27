import { Router } from "express";
import { register, login, getProfile } from "../controllers/authController";
import { verifyToken } from "../middleware/authMiddleware";

const router = Router();

// Ketika ada yang menembak POST ke /register, jalankan fungsi register
router.post("/register", register);
router.post("/login", login);

router.get("/profile", verifyToken, getProfile);

export default router;
