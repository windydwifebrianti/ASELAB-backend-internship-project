import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middleware/authMiddleware";

const prisma = new PrismaClient();

// ==========================================
// 1. CARI & REKOMENDASI TIM (FR-MTC-01, 02, 03, 04)
// ==========================================
export const getTeamRecommendations = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const userId = req.user.userId;
    const { keyword, kompetisi } = req.query; // Fitur Filter (FR-MTC-02)

    // Menyusun filter pencarian dinamis
    const filterConditions: any = {};
    if (keyword) {
      filterConditions.OR = [
        { nama: { contains: String(keyword) } },
        { deskripsi: { contains: String(keyword) } },
      ];
    }
    if (kompetisi) filterConditions.kompetisi = { contains: String(kompetisi) };

    // NFR-01: Mengambil tim yang BELUM pernah di-swipe oleh user (Rekomendasi Pintar)
    const teams = await prisma.team.findMany({
      where: {
        ...filterConditions,
        leaderId: { not: userId }, // Jangan rekomendasikan tim miliknya sendiri
        swipes: { none: { userId: userId } }, // Hilangkan tim yang sudah di-PASS/LIKE
        members: { none: { userId: userId } }, // Hilangkan tim yang sudah dia ikuti
      },
      include: {
        leader: { select: { nama: true } },
      },
      take: 20, // NFR-02: Batasi paginasi agar response time di bawah 3 detik
    });

    return res
      .status(200)
      .json({ message: "Rekomendasi tim berhasil diambil", data: teams });
  } catch (error) {
    return res.status(500).json({ error: "Terjadi kesalahan server." });
  }
};

// ==========================================
// 2. SWIPE (LIKE / PASS) (FR-MTC-06)
// ==========================================
export const swipeTeam = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const userId = req.user.userId;
    const { teamId, action } = req.body; // action: "LIKE" | "PASS"

    if (!teamId || !["LIKE", "PASS"].includes(action)) {
      return res
        .status(400)
        .json({ error: "Data teamId dan action (LIKE/PASS) tidak valid." }); // NFR-09
    }

    const swipe = await prisma.teamSwipe.upsert({
      where: { userId_teamId: { userId, teamId } },
      update: { action },
      create: { userId, teamId, action },
    });

    return res
      .status(200)
      .json({ message: `Berhasil melakukan ${action} pada tim.`, data: swipe });
  } catch (error) {
    return res.status(500).json({ error: "Terjadi kesalahan server." });
  }
};

// ==========================================
// 3. MENGIRIM JOIN REQUEST & NOTIFIKASI (FR-MTC-07, FR-MTC-10)
// ==========================================
export const createJoinRequest = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const userId = req.user.userId;
    const { teamId, pesan } = req.body;

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: "Tim tidak ditemukan." });

    // NFR-14: Gunakan transaksi agar pembuatan request dan notifikasi tidak putus di tengah jalan
    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.joinRequest.create({
        data: { userId, teamId, pesan },
      });

      // FR-MTC-10: Sistem memberikan notifikasi kepada Team Leader
      await tx.notification.create({
        data: {
          userId: team.leaderId,
          title: "Join Request Baru",
          message: `Seseorang ingin bergabung dengan tim Anda (${team.nama}).`,
        },
      });

      return request;
    });

    return res
      .status(201)
      .json({ message: "Join Request berhasil dikirim.", data: result });
  } catch (error: any) {
    if (error.code === "P2002")
      return res
        .status(400)
        .json({ error: "Anda sudah mengirim permintaan ke tim ini." });
    return res.status(500).json({ error: "Terjadi kesalahan server." });
  }
};

// ==========================================
// 4. KELOLA JOIN REQUEST OLEH LEADER (FR-MTC-08, FR-MTC-10)
// ==========================================
export const manageJoinRequest = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const leaderId = req.user.userId;
    const requestId = parseInt(req.params.id);
    const { status } = req.body; // "ACCEPTED" atau "REJECTED"

    const request = await prisma.joinRequest.findUnique({
      where: { id: requestId },
      include: { team: true },
    });

    if (!request)
      return res.status(404).json({ error: "Request tidak ditemukan." });

    // NFR-07: Hanya Leader tim yang berhak menerima/menolak
    if (request.team.leaderId !== leaderId) {
      return res
        .status(403)
        .json({ error: "Akses ditolak. Anda bukan Team Leader." });
    }

    // NFR-14: Transaksi pembaruan status, penambahan anggota (jika diterima), dan notifikasi
    await prisma.$transaction(async (tx) => {
      // 1. Update status request
      await tx.joinRequest.update({
        where: { id: requestId },
        data: { status },
      });

      // 2. Jika diterima, masukkan user ke tabel TeamMember
      if (status === "ACCEPTED") {
        await tx.teamMember.create({
          data: {
            teamId: request.teamId,
            userId: request.userId,
            role: "MEMBER",
          },
        });
      }

      // 3. Kirim notifikasi hasil keputusan kepada pengirim (FR-MTC-10)
      const statusText = status === "ACCEPTED" ? "diterima" : "ditolak";
      await tx.notification.create({
        data: {
          userId: request.userId,
          title: "Update Join Request",
          message: `Permintaan Anda untuk bergabung dengan tim ${request.team.nama} telah ${statusText}.`,
        },
      });
    });

    return res
      .status(200)
      .json({ message: `Join Request berhasil ${status}.` });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Terjadi kesalahan server saat mengelola request." });
  }
};

// ==========================================
// 5. MELIHAT STATUS JOIN REQUEST (FR-MTC-09)
// ==========================================
export const getMyJoinRequests = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const userId = req.user.userId;

    const requests = await prisma.joinRequest.findMany({
      where: { userId },
      include: { team: { select: { nama: true, kompetisi: true } } },
    });

    return res.status(200).json({
      message: "Status Join Request berhasil diambil",
      data: requests,
    });
  } catch (error) {
    return res.status(500).json({ error: "Terjadi kesalahan server." });
  }
};
