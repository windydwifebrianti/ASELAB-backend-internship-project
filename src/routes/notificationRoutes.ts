import { Router } from "express";
import { verifyToken } from "../middleware/authMiddleware";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notificationController";

const router = Router();

/**
 * @openapi
 * /api/notifications:
 *   get:
 *     tags: [Notification]
 *     summary: Mendapatkan daftar notifikasi pengguna
 *     description: Mengambil notifikasi milik pengguna yang sedang login dengan pagination.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Nomor halaman
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Jumlah notifikasi per halaman
 *     responses:
 *       "200":
 *         description: Notifikasi berhasil diambil
 *       "400":
 *         description: Parameter pagination tidak valid
 *       "401":
 *         description: Token tidak valid atau tidak tersedia
 *       "500":
 *         description: Kesalahan server
 */
router.get("/", verifyToken, getMyNotifications);

/**
 * @openapi
 * /api/notifications/read-all:
 *   patch:
 *     tags: [Notification]
 *     summary: Menandai semua notifikasi sebagai sudah dibaca
 *     description: Hanya mengubah status notifikasi milik pengguna yang sedang login.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Semua notifikasi berhasil ditandai sudah dibaca
 *       "401":
 *         description: Token tidak valid atau tidak tersedia
 *       "500":
 *         description: Kesalahan server
 */
router.patch("/read-all", verifyToken, markAllNotificationsRead);

/**
 * @openapi
 * /api/notifications/{id}/read:
 *   patch:
 *     tags: [Notification]
 *     summary: Menandai satu notifikasi sebagai sudah dibaca
 *     description: Hanya dapat mengubah notifikasi milik pengguna yang sedang login.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID notifikasi
 *     responses:
 *       "200":
 *         description: Notifikasi berhasil ditandai sudah dibaca
 *       "400":
 *         description: ID notifikasi tidak valid
 *       "401":
 *         description: Token tidak valid atau tidak tersedia
 *       "404":
 *         description: Notifikasi tidak ditemukan
 *       "500":
 *         description: Kesalahan server
 */
router.patch("/:id/read", verifyToken, markNotificationRead);

export default router;
