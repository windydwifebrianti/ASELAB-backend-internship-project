import { Router } from "express";
import { verifyToken } from "../middleware/authMiddleware";
import {
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamDetail,
  getMyTeams,
  getJoinedTeams,
  getMyTeamJoinRequests,
} from "../controllers/teamController";

const router = Router();

/**
 * @openapi
 * /api/teams:
 *   post:
 *     tags: [Teams]
 *     summary: Membuat tim baru
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nama, deskripsi, kompetisi]
 *             properties:
 *               nama:
 *                 type: string
 *                 example: Tim Backend ASELAB
 *               deskripsi:
 *                 type: string
 *                 example: Mencari anggota untuk mengembangkan aplikasi.
 *               kompetisi:
 *                 type: string
 *                 example: Hackathon Nasional
 *               skillDibutuhkan:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Node.js", "PostgreSQL"]
 *               linkGrupWhatsapp:
 *                 type: string
 *                 nullable: true
 *                 example: "https://chat.whatsapp.com/contoh-link"
 *               linkChannelDiscord:
 *                 type: string
 *                 nullable: true
 *                 example: "https://discord.gg/contoh-link"
 *               kuota:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 example: 5
 *                 description: Maksimal total anggota tim, termasuk leader.
 *     responses:
 *       "201":
 *         description: Tim berhasil dibuat
 *       "400":
 *         description: Data wajib tidak lengkap
 *       "401":
 *         description: Token tidak valid atau tidak tersedia
 *       "500":
 *         description: Kesalahan server
 */
router.post("/", verifyToken, createTeam);

/**
 * @openapi
 * /api/teams/{id}:
 *   put:
 *     tags: [Teams]
 *     summary: Memperbarui informasi tim
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID tim
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nama:
 *                 type: string
 *               deskripsi:
 *                 type: string
 *               kompetisi:
 *                 type: string
 *               skillDibutuhkan:
 *                 type: array
 *                 items:
 *                   type: string
 *               linkGrupWhatsapp:
 *                 type: string
 *                 nullable: true
 *                 example: "https://chat.whatsapp.com/contoh-link"
 *               linkChannelDiscord:
 *                 type: string
 *                 nullable: true
 *                 example: "https://discord.gg/contoh-link"
 *               kuota:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 example: 5
 *                 description: Maksimal total anggota tim, termasuk leader.
 *     responses:
 *       "200":
 *         description: Informasi tim berhasil diperbarui
 *       "401":
 *         description: Token tidak valid atau tidak tersedia
 *       "403":
 *         description: Hanya ketua tim yang dapat mengubah informasi
 *       "404":
 *         description: Tim tidak ditemukan
 *       "500":
 *         description: Kesalahan server
 */
router.put("/:id", verifyToken, updateTeam);

/**
 * @openapi
 * /api/teams/{id}:
 *   delete:
 *     tags: [Teams]
 *     summary: Menghapus tim
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID tim yang akan dihapus
 *     responses:
 *       "200":
 *         description: Tim beserta anggotanya berhasil dihapus
 *       "401":
 *         description: Token tidak valid atau tidak tersedia
 *       "403":
 *         description: Hanya ketua tim yang dapat menghapus tim
 *       "404":
 *         description: Tim tidak ditemukan
 *       "500":
 *         description: Kesalahan server
 */
router.delete("/:id", verifyToken, deleteTeam);

/**
 * @openapi
 * /api/teams/{id}:
 *   get:
 *     tags: [Teams]
 *     summary: Melihat detail tim dan anggotanya
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID tim
 *     responses:
 *       "200":
 *         description: Detail tim berhasil diambil
 *       "401":
 *         description: Token tidak valid atau tidak tersedia
 *       "404":
 *         description: Tim tidak ditemukan
 *       "500":
 *         description: Kesalahan server
 */
router.get("/:id", verifyToken, getTeamDetail);

/**
 * @openapi
 * /api/teams/my-teams:
 *   get:
 *     tags: [Teams]
 *     summary: Mengambil daftar tim yang dipimpin pengguna login
 *     description: Mengambil semua tim yang dipimpin oleh pengguna berdasarkan token autentikasi.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Daftar tim berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Daftar tim yang Anda pimpin berhasil diambil.
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       nama:
 *                         type: string
 *                         example: Tim Backend ASELAB
 *                       peranSaya:
 *                         type: string
 *                         example: LEADER
 *                       jumlahAnggota:
 *                         type: integer
 *                         example: 3
 *                       sisaKuota:
 *                         type: integer
 *                         example: 2
 *       "401":
 *         description: Token tidak valid atau tidak tersedia
 *       "500":
 *         description: Kesalahan server
 */
router.get("/my-teams", verifyToken, getMyTeams);

/**
 * @openapi
 * /api/teams/joined-teams:
 *   get:
 *     tags: [Teams]
 *     summary: Mengambil daftar tim yang diikuti pengguna login
 *     description: Mengambil tim tempat pengguna login terdaftar sebagai anggota, bukan sebagai ketua tim.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Daftar tim yang diikuti berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Daftar tim yang Anda ikuti berhasil diambil.
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 2
 *                       nama:
 *                         type: string
 *                         example: Tim AI
 *                       peranSaya:
 *                         type: string
 *                         example: MEMBER
 *                       jumlahAnggota:
 *                         type: integer
 *                         example: 4
 *                       sisaKuota:
 *                         type: integer
 *                         example: 1
 *       "401":
 *         description: Token tidak valid atau tidak tersedia
 *       "500":
 *         description: Kesalahan server
 */
router.get("/joined-teams", verifyToken, getJoinedTeams);

/**
 * @openapi
 * /api/teams/my-teams/join-requests:
 *   get:
 *     tags: [Teams]
 *     summary: Mengambil join request yang masuk ke tim milik pengguna login
 *     description: Mengambil permintaan bergabung untuk tim yang dipimpin oleh pengguna login.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [PENDING, ACCEPTED, REJECTED]
 *         description: Filter status join request
 *         example: PENDING
 *     responses:
 *       "200":
 *         description: Daftar join request berhasil diambil
 *       "400":
 *         description: Status filter tidak valid
 *       "401":
 *         description: Token tidak valid atau tidak tersedia
 *       "500":
 *         description: Kesalahan server
 */
router.get("/my-teams/join-requests", verifyToken, getMyTeamJoinRequests);

export default router;
