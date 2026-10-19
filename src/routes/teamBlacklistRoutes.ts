import { Router } from "express";
import { verifyToken } from "../middleware/authMiddleware";
import {
  addTeamBlacklist,
  getTeamBlacklist,
  removeTeamBlacklist,
} from "../controllers/teamBlacklistController";

const router = Router();

/**
 * @openapi
 * /api/teams/{teamId}/blacklist:
 *   post:
 *     tags: [Team Blacklist]
 *     summary: Menambahkan pengguna ke blacklist tim
 *     description: Hanya leader pemilik tim yang dapat menambahkan pengguna berdasarkan NIM.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
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
 *             required:
 *                - nama
 *             properties:
 *               nama:
 *                 type: string
 *                 example: "Dina Putri"
 *     responses:
 *       "201":
 *         description: Pengguna berhasil ditambahkan ke blacklist
 *       "400":
 *         description: Input tidak valid atau leader mencoba memblokir dirinya sendiri
 *       "401":
 *         description: Token tidak valid
 *       "403":
 *         description: Pengguna bukan leader tim
 *       "404":
 *         description: Tim atau pengguna tidak ditemukan
 *       "409":
 *         description: Pengguna sudah diblacklist atau sudah menjadi anggota tim
 *       "500":
 *         description: Kesalahan server
 */
router.post("/:teamId/blacklist", verifyToken, addTeamBlacklist);

/**
 * @openapi
 * /api/teams/{teamId}/blacklist:
 *   get:
 *     tags: [Team Blacklist]
 *     summary: Melihat daftar blacklist tim
 *     description: Hanya leader pemilik tim yang dapat melihat daftar blacklist.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID tim
 *     responses:
 *       "200":
 *         description: Daftar blacklist berhasil diambil
 *       "400":
 *         description: ID tim tidak valid
 *       "401":
 *         description: Token tidak valid
 *       "403":
 *         description: Pengguna bukan leader tim
 *       "404":
 *         description: Tim tidak ditemukan
 *       "500":
 *         description: Kesalahan server
 */
router.get("/:teamId/blacklist", verifyToken, getTeamBlacklist);

/**
 * @openapi
 * /api/teams/{teamId}/blacklist/{userId}:
 *   delete:
 *     tags: [Team Blacklist]
 *     summary: Menghapus pengguna dari blacklist tim
 *     description: userId merupakan ID internal pengguna, bukan NIM. Hanya leader tim yang dapat menghapus blacklist.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID tim
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID internal pengguna yang diblacklist
 *     responses:
 *       "200":
 *         description: Blacklist berhasil dihapus
 *       "400":
 *         description: ID tidak valid
 *       "401":
 *         description: Token tidak valid
 *       "403":
 *         description: Pengguna bukan leader tim
 *       "404":
 *         description: Tim atau data blacklist tidak ditemukan
 *       "500":
 *         description: Kesalahan server
 */
router.delete("/:teamId/blacklist/:userId", verifyToken, removeTeamBlacklist);

export default router;
