import { Router } from "express";
import { verifyToken } from "../middleware/authMiddleware";
import {
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamDetail,
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

export default router;
