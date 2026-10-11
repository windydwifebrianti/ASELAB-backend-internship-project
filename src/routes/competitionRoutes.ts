import { Router } from "express";
import { getCompetitions } from "../controllers/competitionController";
import { verifyToken } from "../middleware/authMiddleware";

const router = Router();

/**
 * @openapi
 * /api/competitions:
 *   get:
 *     tags: [Competitions]
 *     summary: Mengambil daftar kompetisi
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: Pencarian berdasarkan nama lomba
 *       - in: query
 *         name: kategori
 *         schema:
 *           type: string
 *         description: Kategori kompetisi. Nilai "Semua" tidak menerapkan filter.
 *       - in: query
 *         name: tingkatKompetisi
 *         schema:
 *           type: string
 *         description: Tingkat kompetisi. Nilai "Semua" tidak menerapkan filter.
 *       - in: query
 *         name: biayaPendaftaran
 *         schema:
 *           type: string
 *           enum: [Semua, Gratis, Berbayar]
 *         description: Filter berdasarkan status biaya pendaftaran.
 *     responses:
 *       "200":
 *         description: Daftar kompetisi berhasil diambil
 *       "401":
 *         description: Token tidak valid atau tidak tersedia
 *       "500":
 *         description: Kesalahan server
 */
router.get("/", verifyToken, getCompetitions);

export default router;
