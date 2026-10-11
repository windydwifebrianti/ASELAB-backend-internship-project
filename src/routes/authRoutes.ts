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

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Menyelesaikan registrasi dengan OTP
 *     description: Memverifikasi token registrasi dan OTP sebelum membuat akun.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, otp]
 *             properties:
 *               token:
 *                 type: string
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       "201":
 *         description: Registrasi berhasil
 *       "400":
 *         description: Token atau OTP tidak valid atau kedaluwarsa
 *       "404":
 *         description: Sesi registrasi tidak ditemukan
 *       "409":
 *         description: Akun sudah terdaftar
 *       "429":
 *         description: Batas percobaan OTP tercapai
 *       "500":
 *         description: Kesalahan server
 */
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

/**
 * @openapi
 * /api/auth/profile:
 *   post:
 *     tags: [Profile]
 *     summary: Membuat atau memperbarui profil
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [jurusan]
 *             properties:
 *               jurusan:
 *                 type: string
 *                 example: Teknologi Informasi
 *               skill:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Backend Development", "Golang"]
 *               minat:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Software Engineering"]
 *               pengalamanLomba:
 *                 type: string
 *                 example: Pernah mengikuti hackathon.
 *     responses:
 *       "200":
 *         description: Profil berhasil disimpan
 *       "400":
 *         description: Jurusan wajib diisi
 *       "401":
 *         description: Token tidak valid atau tidak tersedia
 *       "500":
 *         description: Kesalahan server
 */
router.post("/profile", verifyToken, upsertProfile);

/**
 * @openapi
 * /api/auth/profile/{id}:
 *   get:
 *     tags: [Profile]
 *     summary: Melihat profil pengguna berdasarkan ID
 *     description: Route ini juga memerlukan autentikasi sesuai middleware saat ini.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID pengguna yang profilnya akan dilihat
 *     responses:
 *       "200":
 *         description: Profil berhasil ditemukan
 *       "400":
 *         description: ID pengguna tidak valid
 *       "401":
 *         description: Token tidak valid atau tidak tersedia
 *       "404":
 *         description: Profil tidak ditemukan atau belum diisi
 *       "500":
 *         description: Kesalahan server
 */
router.get("/profile/:id", verifyToken, getPublicProfile);

/**
 * @openapi
 * /api/auth/request-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Meminta OTP melalui email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [emailInstitusi]
 *             properties:
 *               emailInstitusi:
 *                 type: string
 *                 example: mahasiswa@kampus.ac.id
 *     responses:
 *       "200":
 *         description: OTP berhasil dikirim
 *       "400":
 *         description: Email wajib diisi
 *       "403":
 *         description: Email bukan email institusi yang diizinkan
 *       "500":
 *         description: Pengiriman OTP gagal
 */
router.post("/request-otp", requestOtp);

/**
 * @openapi
 * /api/auth/request-register-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Meminta atau mengirim ulang OTP registrasi
 *     description: Request awal memakai nama, NIM, emailInstitusi, dan password. Pengiriman ulang memakai token registrasi.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 required: [nama, nim, emailInstitusi, password]
 *                 properties:
 *                   nama:
 *                     type: string
 *                     example: Nama Mahasiswa
 *                   nim:
 *                     type: string
 *                     example: "123456789"
 *                   emailInstitusi:
 *                     type: string
 *                     example: mahasiswa@kampus.ac.id
 *                   password:
 *                     type: string
 *                     format: password
 *               - type: object
 *                 required: [token]
 *                 properties:
 *                   token:
 *                     type: string
 *                     description: Token registrasi dari respons sebelumnya
 *     responses:
 *       "200":
 *         description: OTP berhasil dikirim atau dikirim ulang
 *       "400":
 *         description: Data registrasi tidak lengkap atau tidak valid
 *       "403":
 *         description: Email institusi tidak diizinkan
 *       "404":
 *         description: Sesi registrasi tidak ditemukan
 *       "409":
 *         description: Akun sudah terdaftar
 *       "502":
 *         description: Layanan validasi mahasiswa gagal
 *       "500":
 *         description: Kesalahan server atau pengiriman email
 */
router.post("/request-register-otp", requestRegisterOtp);

/**
 * @openapi
 * /api/auth/register/session:
 *   post:
 *     tags: [Auth]
 *     summary: Memeriksa sesi registrasi sementara
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       "200":
 *         description: Sesi registrasi ditemukan
 *       "400":
 *         description: Token tidak diberikan atau sesi tidak aktif
 *       "404":
 *         description: Sesi registrasi tidak ditemukan
 *       "500":
 *         description: Kesalahan server
 */
router.post("/register/session", getRegisterSession);

export default router;
