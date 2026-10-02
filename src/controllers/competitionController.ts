import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middleware/authMiddleware";

const prisma = new PrismaClient();

export const getCompetitions = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const { keyword, kategori, tingkatKompetisi, biayaPendaftaran } = req.query;

    const filterConditions: any = {};

    if (keyword) {
      filterConditions.namaLomba = { contains: String(keyword) };
    }

    if (kategori && kategori !== "Semua") {
      filterConditions.kategori = String(kategori);
    }
    if (tingkatKompetisi && tingkatKompetisi !== "Semua") {
      filterConditions.tingkatLomba = String(tingkatKompetisi);
    }
    if (biayaPendaftaran && biayaPendaftaran !== "Semua") {
      if (String(biayaPendaftaran).toLowerCase() === "gratis") {
        filterConditions.biayaPendaftaran = { equals: "Gratis" };
      } else {
        filterConditions.biayaPendaftaran = { not: "Gratis" };
      }
    }

    const competitions = await prisma.competition.findMany({
      where: filterConditions,
      orderBy: { deadline: "asc" },
    });

    return res.status(200).json({
      message: "Daftar kompetisi berhasil diambil",
      total: competitions.length,
      data: competitions,
    });
  } catch (error) {
    console.error("Error getCompetitions:", error);
    return res.status(500).json({
      error: "Terjadi kesalahan server saat mengambil data kompetisi.",
    });
  }
};
