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

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Login pengguna
 *     description: Memverifikasi email institusi dan password pengguna.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - emailInstitusi
 *               - password
 *             properties:
 *               emailInstitusi:
 *                 type: string
 *                 example: mahasiswa@kampus.ac.id
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       "200":
 *         description: Login berhasil
 *       "400":
 *         description: Input tidak lengkap atau tidak valid
 *       "401":
 *         description: Email atau password salah
 *       "500":
 *         description: Kesalahan server
 */

router.post("/login", login);

/**
 * @openapi
 * /api/auth/profile:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Mendapatkan profil pengguna yang login
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Profil berhasil diambil
 *       "401":
 *         description: Token tidak ada atau tidak valid
 *       "500":
 *         description: Kesalahan server
 */
router.get("/profile", verifyToken, getProfile);

router.post("/profile", verifyToken, upsertProfile);
router.get("/profile/:id", verifyToken, getPublicProfile);

router.post("/request-otp", requestOtp);
router.post("/request-register-otp", requestRegisterOtp);
router.post("/register/session", getRegisterSession);

export default router;
