import { Router } from "express";
import {
  register,
  login,
  changePassword,
  getProfile,
  upsertProfile,
  getPublicProfile,
  requestOtp,
  requestRegisterOtp,
  getRegisterSession,
  uploadCV,
  downloadCV,
  deleteCV,
  uploadProfileImage,
} from "../controllers/authController";
import { verifyToken } from "../middleware/authMiddleware";
import {
  uploadCvMiddleware,
  uploadProfileImageMiddleware,
} from "../middleware/uploadMiddleware";

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
 * /api/auth/change-password:
 *   patch:
 *     tags: [Auth]
 *     summary: Mengganti password pengguna
 *     description: Mengganti password dengan memverifikasi password lama terlebih dahulu.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 example: PasswordLama123
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: PasswordBaru123
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: PasswordBaru123
 *     responses:
 *       "200":
 *         description: Password berhasil diubah
 *       "400":
 *         description: Input tidak valid atau password lama salah
 *       "401":
 *         description: Token tidak valid atau tidak tersedia
 *       "404":
 *         description: Pengguna tidak ditemukan
 *       "500":
 *         description: Kesalahan server
 */
router.patch("/change-password", verifyToken, changePassword);

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

/**
 * @openapi
 * /api/auth/profile/cv:
 *   post:
 *     tags: [Profile]
 *     summary: Mengunggah CV pengguna
 *     description: Mengunggah CV dalam format PDF. Memerlukan autentikasi.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - cv
 *             properties:
 *               cv:
 *                 type: string
 *                 format: binary
 *                 description: File CV dalam format PDF, maksimal 10 MB.
 *     responses:
 *       "200":
 *         description: CV berhasil diunggah
 *       "400":
 *         description: File tidak dikirim atau format file tidak valid
 *       "401":
 *         description: Token tidak valid atau tidak tersedia
 *       "500":
 *         description: Kesalahan server
 */
router.post("/profile/cv", verifyToken, uploadCvMiddleware, uploadCV);

/**
 * @openapi
 * /api/auth/profile/cv:
 *   get:
 *     tags: [Profile]
 *     summary: Mengunduh CV pengguna yang login
 *     description: Mengunduh CV milik pengguna yang sedang login.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: File CV berhasil ditemukan
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       "401":
 *         description: Token tidak valid atau tidak tersedia
 *       "404":
 *         description: CV belum tersedia atau file tidak ditemukan
 *       "500":
 *         description: Kesalahan server
 */
router.get("/profile/cv", verifyToken, downloadCV);

/**
 * @openapi
 * /api/auth/profile/cv:
 *   delete:
 *     tags: [Profile]
 *     summary: Menghapus CV pengguna
 *     description: Menghapus CV milik pengguna yang sedang login.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: CV berhasil dihapus
 *       "404":
 *         description: CV belum tersedia
 *       "500":
 *         description: Kesalahan server
 */
router.delete("/profile/cv", verifyToken, deleteCV);

/**
 * @openapi
 * /api/auth/profile/image:
 *   post:
 *     tags: [Profile]
 *     summary: Mengunggah gambar profil
 *     description: Mengunggah atau mengganti gambar profil pengguna.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - fotoProfil
 *             properties:
 *               fotoProfil:
 *                 type: string
 *                 format: binary
 *                 description: File gambar JPG, PNG, atau WEBP, maksimal 5 MB.
 *     responses:
 *       "200":
 *         description: Gambar profil berhasil diperbarui
 *       "400":
 *         description: File tidak dikirim atau format gambar tidak valid
 *       "401":
 *         description: Token tidak valid atau tidak tersedia
 *       "500":
 *         description: Kesalahan server
 */
router.post(
  "/profile/image",
  verifyToken,
  uploadProfileImageMiddleware,
  uploadProfileImage,
);

router.get("/profile/:id", verifyToken, getPublicProfile);

export default router;
