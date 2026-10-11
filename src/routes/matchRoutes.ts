import { Router } from "express";
import { verifyToken } from "../middleware/authMiddleware";
import {
  getTeamRecommendations,
  swipeTeam,
  createJoinRequest,
  manageJoinRequest,
  getMyJoinRequests,
} from "../controllers/matchController";

const router = Router();

/**
 * @openapi
 * /api/match/teams:
 *   get:
 *     tags: [Matching]
 *     summary: Mengambil rekomendasi tim
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: Kata kunci nama atau deskripsi tim
 *       - in: query
 *         name: kategori
 *         schema:
 *           type: string
 *         description: Filter kategori kompetisi
 *       - in: query
 *         name: skill
 *         schema:
 *           type: string
 *         description: Filter skill yang dibutuhkan tim
 *     responses:
 *       "200":
 *         description: Rekomendasi tim berhasil diambil
 *       "401":
 *         description: Token tidak valid atau tidak tersedia
 *       "500":
 *         description: Kesalahan server
 */
router.get("/teams", verifyToken, getTeamRecommendations);

/**
 * @openapi
 * /api/match/swipe:
 *   post:
 *     tags: [Matching]
 *     summary: Memberikan LIKE atau PASS pada tim
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [teamId, action]
 *             properties:
 *               teamId:
 *                 type: integer
 *                 example: 1
 *               action:
 *                 type: string
 *                 enum: [LIKE, PASS]
 *                 example: LIKE
 *     responses:
 *       "200":
 *         description: Swipe berhasil disimpan
 *       "400":
 *         description: Data teamId atau action tidak valid
 *       "401":
 *         description: Token tidak valid atau tidak tersedia
 *       "500":
 *         description: Kesalahan server
 */
router.post("/swipe", verifyToken, swipeTeam);

/**
 * @openapi
 * /api/match/requests:
 *   post:
 *     tags: [Matching]
 *     summary: Mengirim permintaan bergabung ke tim
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [teamId]
 *             properties:
 *               teamId:
 *                 type: integer
 *                 example: 1
 *               pesan:
 *                 type: string
 *                 example: Saya tertarik bergabung sebagai backend developer.
 *     responses:
 *       "201":
 *         description: Join request berhasil dikirim
 *       "400":
 *         description: Permintaan duplikat atau data tidak valid
 *       "401":
 *         description: Token tidak valid atau tidak tersedia
 *       "404":
 *         description: Tim tidak ditemukan
 *       "500":
 *         description: Kesalahan server
 */
router.post("/requests", verifyToken, createJoinRequest);

/**
 * @openapi
 * /api/match/requests:
 *   get:
 *     tags: [Matching]
 *     summary: Melihat status join request milik sendiri
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Status join request berhasil diambil
 *       "401":
 *         description: Token tidak valid atau tidak tersedia
 *       "500":
 *         description: Kesalahan server
 */
router.get("/requests", verifyToken, getMyJoinRequests);

/**
 * @openapi
 * /api/match/requests/{id}:
 *   put:
 *     tags: [Matching]
 *     summary: Menerima atau menolak join request
 *     description: Hanya ketua tim yang bersangkutan yang dapat mengelola permintaan.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID join request
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACCEPTED, REJECTED]
 *                 example: ACCEPTED
 *     responses:
 *       "200":
 *         description: Join request berhasil diproses
 *       "401":
 *         description: Token tidak valid atau tidak tersedia
 *       "403":
 *         description: Pengguna bukan ketua tim yang berhak
 *       "404":
 *         description: Join request tidak ditemukan
 *       "500":
 *         description: Kesalahan server
 */
router.put("/requests/:id", verifyToken, manageJoinRequest);

export default router;
