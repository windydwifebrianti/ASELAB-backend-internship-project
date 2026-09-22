import { Router } from "express";
import {
  register,
  login,
  getProfile,
  upsertProfile,
  getPublicProfile,
  requestOtp,
  requestRegisterOtp,
  getRegisterSession,
} from "../controllers/authController";
import { verifyToken } from "../middleware/authMiddleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);

router.get("/profile", verifyToken, getProfile);

router.post("/profile", verifyToken, upsertProfile);
router.get("/profile/:id", verifyToken, getPublicProfile);

router.post("/request-otp", requestOtp);
router.post("/request-register-otp", requestRegisterOtp);
router.post("/register/session", getRegisterSession);

export default router;
