import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middleware/authMiddleware";

const prisma = new PrismaClient();

export const getCompetitions = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const pageRaw = req.query.page ?? "1";
    const limitRaw = req.query.limit ?? "10";

    if (
      typeof pageRaw !== "string" ||
      !/^\d+$/.test(pageRaw) ||
      typeof limitRaw !== "string" ||
      !/^\d+$/.test(limitRaw)
    ) {
      return res.status(400).json({
        error: "Page dan limit harus berupa angka bulat positif.",
      });
    }

    const page = Number(pageRaw);
    const limit = Number(limitRaw);

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        error: "Page minimal 1 dan limit harus antara 1 sampai 100.",
      });
    }

    const skip = (page - 1) * limit;

    if (!Number.isSafeInteger(skip)) {
      return res.status(400).json({
        error: "Nomor halaman terlalu besar.",
      });
    }

    const keyword =
      typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";

    const kategori =
      typeof req.query.kategori === "string" ? req.query.kategori.trim() : "";

    const tingkatKompetisi =
      typeof req.query.tingkatKompetisi === "string"
        ? req.query.tingkatKompetisi.trim()
        : "";

    const filterConditions: any = {};

    if (keyword) {
      filterConditions.namaLomba = {
        contains: keyword,
      };
    }

    if (kategori && kategori.toLowerCase() !== "semua") {
      filterConditions.kategori = kategori;
    }

    if (tingkatKompetisi && tingkatKompetisi.toLowerCase() !== "semua") {
      filterConditions.tingkatLomba = tingkatKompetisi;
    }

    if (req.query.biayaPendaftaran !== undefined) {
      if (typeof req.query.biayaPendaftaran !== "string") {
        return res.status(400).json({
          error: "Filter biaya pendaftaran tidak valid.",
        });
      }

      const biaya = req.query.biayaPendaftaran.trim().toLowerCase();

      if (biaya && biaya !== "semua") {
        if (biaya === "gratis") {
          filterConditions.biayaPendaftaran = {
            equals: "Gratis",
          };
        } else if (biaya === "berbayar") {
          filterConditions.AND = [
            { biayaPendaftaran: { not: null } },
            { biayaPendaftaran: { not: "Gratis" } },
          ];
        } else {
          return res.status(400).json({
            error: "Gunakan Gratis, Berbayar, atau Semua.",
          });
        }
      }
    }

    const [competitions, totalItems] = await prisma.$transaction([
      prisma.competition.findMany({
        where: filterConditions,
        orderBy: [{ deadline: "asc" }, { id: "asc" }],
        skip,
        take: limit,
      }),

      prisma.competition.count({
        where: filterConditions,
      }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return res.status(200).json({
      message: "Daftar kompetisi berhasil diambil",
      total: totalItems,
      data: competitions,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1 && totalPages > 0,
      },
    });
  } catch (error) {
    console.error("Error getCompetitions:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan server saat mengambil data kompetisi.",
    });
  }
};
