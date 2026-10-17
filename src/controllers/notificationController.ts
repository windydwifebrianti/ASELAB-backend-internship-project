import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middleware/authMiddleware";

const prisma = new PrismaClient();

export const getMyNotifications = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  try {
    const userId = Number(req.user?.userId);
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        error: "Parameter page atau limit tidak valid.",
      });
    }

    const [data, total, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({
        where: { userId },
      }),
      prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      }),
    ]);

    return res.status(200).json({
      message: "Notifikasi berhasil diambil.",
      total,
      unreadCount,
      page,
      limit,
      data,
    });
  } catch (error) {
    console.error("Error getMyNotifications:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan server.",
    });
  }
};

export const markNotificationRead = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  try {
    const userId = Number(req.user?.userId);
    const notificationId = Number(req.params.id);

    if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
      return res.status(400).json({
        error: "ID notifikasi tidak valid.",
      });
    }

    // Pastikan notifikasi milik user yang sedang login.
    const result = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        isRead: true,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({
        error: "Notifikasi tidak ditemukan.",
      });
    }

    return res.status(200).json({
      message: "Notifikasi ditandai sudah dibaca.",
    });
  } catch (error) {
    console.error("Error markNotificationRead:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan server.",
    });
  }
};

export const markAllNotificationsRead = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  try {
    const userId = Number(req.user?.userId);

    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return res.status(200).json({
      message: "Semua notifikasi telah ditandai sudah dibaca.",
    });
  } catch (error) {
    console.error("Error markAllNotificationsRead:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan server.",
    });
  }
};
