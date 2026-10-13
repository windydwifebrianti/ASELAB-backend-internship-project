import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middleware/authMiddleware";

const prisma = new PrismaClient();

export const createTeam = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const leaderId = req.user.userId;
    const { nama, deskripsi, kompetisi, skillDibutuhkan } = req.body;

    if (
      typeof nama !== "string" ||
      typeof deskripsi !== "string" ||
      typeof kompetisi !== "string"
    ) {
      return res.status(400).json({
        error: "Nama, deskripsi, dan kompetisi wajib diisi.",
      });
    }

    const namaBersih = nama.trim();
    const deskripsiBersih = deskripsi.trim();
    const kompetisiBersih = kompetisi.trim();

    if (!namaBersih || !deskripsiBersih || !kompetisiBersih) {
      return res
        .status(400)
        .json({ error: "Nama, deskripsi, dan kompetisi tim wajib diisi." });
    }

    const result = await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          nama: namaBersih,
          deskripsi: deskripsiBersih,
          kompetisi: kompetisiBersih,
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

export const deleteTeam = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const userId = req.user.userId;
    const teamId = parseInt(req.params.id);

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: "Tim tidak ditemukan." });

    if (team.leaderId !== userId) {
      return res.status(403).json({
        error: "Akses ditolak! Hanya Team Leader yang dapat menghapus tim.",
      });
    }

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

export const getTeamDetail = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const teamId = parseInt(req.params.id);

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
