import { Router } from "express";
import { getCompetitions } from "../controllers/competitionController";
import { verifyToken } from "../middleware/authMiddleware";

const router = Router();

/**
 * @openapi
 * /api/competitions:
 *   get:
 *     tags:
 *       - Competitions
 *     summary: Mengambil daftar kompetisi
 *     description: Mengambil daftar kompetisi dengan filter dan pagination.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Nomor halaman yang ingin ditampilkan.
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Jumlah maksimum kompetisi per halaman.
 *       - in: query
 *         name: keyword
 *         required: false
 *         schema:
 *           type: string
 *         description: Kata kunci pencarian nama lomba.
 *       - in: query
 *         name: kategori
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter berdasarkan kategori kompetisi.
 *       - in: query
 *         name: tingkatKompetisi
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter berdasarkan tingkat kompetisi.
 *       - in: query
 *         name: biayaPendaftaran
 *         required: false
 *         schema:
 *           type: string
 *           enum:
 *             - Semua
 *             - Gratis
 *             - Berbayar
 *         description: Filter berdasarkan biaya pendaftaran.
 *     responses:
 *       "200":
 *         description: Daftar kompetisi berhasil diambil.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Daftar kompetisi berhasil diambil
 *                 total:
 *                   type: integer
 *                   description: Jumlah seluruh kompetisi yang cocok dengan filter.
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 1
 *                     totalItems:
 *                       type: integer
 *                       example: 2
 *                     totalPages:
 *                       type: integer
 *                       example: 2
 *                     hasNextPage:
 *                       type: boolean
 *                       example: true
 *                     hasPreviousPage:
 *                       type: boolean
 *                       example: false
 *       "400":
 *         description: Parameter pagination atau filter tidak valid.
 *       "401":
 *         description: Token tidak valid atau tidak tersedia.
 *       "500":
 *         description: Kesalahan server.
 */
router.get("/", verifyToken, getCompetitions);

router.get("/", verifyToken, getCompetitions);

export default router;
