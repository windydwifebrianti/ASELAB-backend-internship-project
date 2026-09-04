import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middleware/authMiddleware";

const prisma = new PrismaClient();

// ==========================================
// 1. MEMBUAT TIM (FR-TM-01, FR-TM-02, FR-TM-03)
// ==========================================
export const createTeam = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const leaderId = req.user.userId;
    const { nama, deskripsi, kompetisi, skillDibutuhkan } = req.body;

    // NFR-06: Validasi input data wajib
    if (!nama || !deskripsi || !kompetisi) {
      return res
        .status(400)
        .json({ error: "Nama, deskripsi, dan kompetisi tim wajib diisi." });
    }

    // NFR-14 & FR-TM-03: Gunakan Prisma Transaction untuk membuat Tim sekaligus menetapkan si Pembuat sebagai LEADER di tabel anggota.
    const result = await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          nama,
          deskripsi,
          kompetisi,
          skillDibutuhkan: skillDibutuhkan || [],
          leaderId: Number(leaderId),
        },
      });

      await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId: Number(leaderId),
          role: "LEADER",
        },
      });

      return team;
    });

    return res
      .status(201)
      .json({ message: "Tim berhasil dibuat", data: result });
  } catch (error) {
    console.error("Error createTeam:", error);
    return res
      .status(500)
      .json({ error: "Terjadi kesalahan pada server saat membuat tim." }); // NFR-15
  }
};

// ==========================================
// 2. MENGUBAH INFO TIM (FR-TM-04)
// ==========================================
export const updateTeam = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const userId = req.user.userId;
    const teamId = parseInt(req.params.id);
    const { nama, deskripsi, kompetisi, skillDibutuhkan } = req.body;

    const team = await prisma.team.findUnique({ where: { id: teamId } });

    if (!team) return res.status(404).json({ error: "Tim tidak ditemukan." });

    // NFR-07: Access Control - Hanya Team Leader yang bisa mengubah
    if (team.leaderId !== userId) {
      return res.status(403).json({
        error: "Akses ditolak! Hanya Team Leader yang dapat mengubah info tim.",
      });
    }

    const updatedTeam = await prisma.team.update({
      where: { id: teamId },
      data: {
        nama: nama || team.nama,
        deskripsi: deskripsi || team.deskripsi,
        kompetisi: kompetisi || team.kompetisi,
        skillDibutuhkan: skillDibutuhkan || team.skillDibutuhkan,
      },
    });

    return res.status(200).json({
      message: "Informasi tim berhasil diperbarui",
      data: updatedTeam,
    });
  } catch (error) {
    console.error("Error updateTeam:", error);
    return res.status(500).json({ error: "Terjadi kesalahan server." });
  }
};

// ==========================================
// 3. MENGHAPUS TIM (FR-TM-05)
// ==========================================
export const deleteTeam = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const userId = req.user.userId;
    const teamId = parseInt(req.params.id);

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: "Tim tidak ditemukan." });

    // NFR-07: Access Control
    if (team.leaderId !== userId) {
      return res.status(403).json({
        error: "Akses ditolak! Hanya Team Leader yang dapat menghapus tim.",
      });
    }

    // Akan otomatis menghapus TeamMember karena relasi onDelete: Cascade (NFR-14)
    await prisma.team.delete({ where: { id: teamId } });

    return res
      .status(200)
      .json({ message: "Tim beserta seluruh anggotanya berhasil dihapus." });
  } catch (error) {
    console.error("Error deleteTeam:", error);
    return res
      .status(500)
      .json({ error: "Terjadi kesalahan server saat menghapus tim." });
  }
};

// ==========================================
// 4. MELIHAT DETAIL TIM & ANGGOTA (FR-TM-06, FR-TM-07)
// ==========================================
export const getTeamDetail = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const teamId = parseInt(req.params.id);

    // Mengambil data tim beserta daftar anggotanya (NFR-01: Indexing ID menjamin < 3 detik)
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: {
              select: {
                nama: true,
                profile: { select: { jurusan: true, skill: true } }, // Mengambil sekilas skill anggota
              },
            },
          },
        },
      },
    });

    if (!team) return res.status(404).json({ error: "Tim tidak ditemukan." });

    return res
      .status(200)
      .json({ message: "Berhasil mengambil detail tim", data: team });
  } catch (error) {
    console.error("Error getTeamDetail:", error);
    return res
      .status(500)
      .json({ error: "Terjadi kesalahan server saat mengambil data tim." });
  }
};
