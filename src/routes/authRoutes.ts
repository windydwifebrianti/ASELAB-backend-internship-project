import { Router } from "express";
import {
  register,
  login,
  getProfile,
  upsertProfile,
  getPublicProfile,
} from "../controllers/authController";
import { verifyToken } from "../middleware/authMiddleware";

const router = Router();

// Ketika ada yang menembak POST ke /register, jalankan fungsi register
router.post("/register", register);
router.post("/login", login);

router.get("/profile", verifyToken, getProfile);

router.post("/profile", verifyToken, upsertProfile);
router.get("/profile/:id", verifyToken, getPublicProfile);

export default router;
