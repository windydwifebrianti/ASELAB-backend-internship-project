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

router.post("/register", register);
router.post("/login", login);

router.get("/profile", verifyToken, getProfile);

router.post("/profile", verifyToken, upsertProfile);
router.get("/profile/:id", verifyToken, getPublicProfile);

export default router;
