import { Router } from "express";
import { verifyToken } from "../middleware/authMiddleware";
import {
  getCompetitions,
  previewLombaHubCrawl,
  previewLombaHubDetail,
  importLombaHubCrawl,
  importLombaHubDetail,
} from "../controllers/competitionController";

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

/**
 * @openapi
 * /api/competitions/lombahub/crawl-import:
 *   post:
 *     tags: [Competitions]
 *     summary: Crawling dan menyimpan lomba dari LombaHub
 *     description: Mengambil beberapa halaman lomba dari LombaHub, memvalidasi datanya, lalu membuat atau memperbarui data kompetisi berdasarkan sourceUrl.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 8
 *           default: 5
 *         description: Jumlah halaman lomba yang diproses.
 *     responses:
 *       "200":
 *         description: Proses crawling dan impor selesai. Periksa jumlah berhasil dan gagal.
 *       "400":
 *         description: Limit tidak valid.
 *       "401":
 *         description: Token tidak valid atau tidak tersedia.
 *       "502":
 *         description: Crawling LombaHub gagal.
 */
router.post("/lombahub/crawl-import", verifyToken, importLombaHubCrawl);

/**
 * @openapi
 * /api/competitions/lombahub/scrape-import:
 *   post:
 *     tags: [Competitions]
 *     summary: Scraping dan menyimpan satu lomba dari LombaHub
 *     description: Mengambil detail satu lomba dari URL yang diberikan, memvalidasi data, lalu membuat atau memperbarui kompetisi berdasarkan sourceUrl.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 example: https://lombahub.com/kompetisi-lomba/limas-internasional-xxvi
 *     responses:
 *       "200":
 *         description: Data lomba yang sudah ada berhasil diperbarui.
 *       "201":
 *         description: Lomba baru berhasil disimpan.
 *       "400":
 *         description: URL tidak valid atau kosong.
 *       "401":
 *         description: Token tidak valid atau tidak tersedia.
 *       "422":
 *         description: Data hasil scraping tidak lengkap.
 *       "502":
 *         description: Gagal mengambil detail lomba.
 *       "500":
 *         description: Gagal menyimpan data.
 */
router.post("/lombahub/scrape-import", verifyToken, importLombaHubDetail);

router.post("/lombahub/crawl-import", verifyToken, importLombaHubCrawl);

export default router;
