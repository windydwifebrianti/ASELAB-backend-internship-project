import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middleware/authMiddleware";
import {
  crawlLombaHubHomepage,
  scrapeLombaHubDetail,
} from "../utils/lombahubScraper";
import type { LombaHubPreview } from "../utils/lombahubScraper";

const prisma = new PrismaClient();

function getFallbackTitle(sourceUrl: string): string {
  const slug =
    new URL(sourceUrl).pathname.split("/").filter(Boolean).pop() ?? "";

  return decodeURIComponent(slug)
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseDeadlineForDatabase(value: string | null): Date | null {
  if (!value) return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function prepareLombaHubData(data: LombaHubPreview) {
  const sourceUrl = data.sourceUrl.trim();

  if (!sourceUrl || sourceUrl.length > 191) {
    return {
      error: "URL sumber kosong atau melebihi 191 karakter.",
    };
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    return { error: "URL sumber tidak valid." };
  }

  if (
    parsedUrl.protocol !== "https:" ||
    !["lombahub.com", "www.lombahub.com"].includes(
      parsedUrl.hostname.toLowerCase(),
    ) ||
    !parsedUrl.pathname.startsWith("/kompetisi-lomba/")
  ) {
    return {
      error: "URL harus merupakan halaman detail lomba LombaHub.",
    };
  }

  const namaLomba = data.namaLomba.trim() || getFallbackTitle(sourceUrl);

  if (!namaLomba) {
    return {
      error: "Nama lomba tidak dapat ditentukan.",
    };
  }

  parsedUrl.hash = "";
  parsedUrl.search = "";

  return {
    payload: {
      sourceUrl: parsedUrl.toString(),
      namaLomba,
      penyelenggara: data.penyelenggara?.trim() || null,
      kategori: data.kategori?.trim() || null,
      deadline: parseDeadlineForDatabase(data.deadline),
      infoPendaftaran: data.infoPendaftaran?.trim() || null,
      ketentuan: data.ketentuan?.trim() || null,
      biayaPendaftaran: data.biayaPendaftaran?.trim() || null,
      hadiah: data.hadiah?.trim() || null,
      tingkatLomba: data.tingkatLomba?.trim() || null,
      peserta: data.peserta?.trim() || null,
      registrationUrl: data.registrationUrl?.trim() || null,
      gambarUrl: data.gambarUrl?.trim() || null,
    },
  };
}

async function saveLombaHubData(data: LombaHubPreview, detailBerhasil = true) {
  const prepared = prepareLombaHubData(data);

  if ("error" in prepared) {
    return {
      ok: false as const,
      sourceUrl: data.sourceUrl,
      error: prepared.error,
    };
  }

  const payload = prepared.payload;

  // Ambil record lengkap agar informasi lama bisa dipertahankan.
  const existing = await prisma.competition.findUnique({
    where: {
      sourceUrl: payload.sourceUrl,
    },
  });

  const updatePayload = {
    namaLomba: detailBerhasil
      ? payload.namaLomba
      : (existing?.namaLomba ?? payload.namaLomba),

    penyelenggara: payload.penyelenggara ?? existing?.penyelenggara ?? null,

    kategori: payload.kategori ?? existing?.kategori ?? null,

    deadline: payload.deadline ?? existing?.deadline ?? null,

    infoPendaftaran:
      payload.infoPendaftaran ?? existing?.infoPendaftaran ?? null,

    ketentuan: payload.ketentuan ?? existing?.ketentuan ?? null,

    biayaPendaftaran:
      payload.biayaPendaftaran ?? existing?.biayaPendaftaran ?? null,

    hadiah: payload.hadiah ?? existing?.hadiah ?? null,

    tingkatLomba: payload.tingkatLomba ?? existing?.tingkatLomba ?? null,

    peserta: payload.peserta ?? existing?.peserta ?? null,

    registrationUrl:
      payload.registrationUrl ?? existing?.registrationUrl ?? null,

    gambarUrl: payload.gambarUrl ?? existing?.gambarUrl ?? null,
  };

  const competition = await prisma.competition.upsert({
    where: {
      sourceUrl: payload.sourceUrl,
    },

    create: payload,

    update: updatePayload,
  });

  return {
    ok: true as const,
    sourceUrl: payload.sourceUrl,
    action: existing ? ("updated" as const) : ("created" as const),
    competition,
  };
}
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

    const todayParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const getDatePart = (type: string): string =>
      todayParts.find((part) => part.type === type)?.value ?? "";

    const todayJakarta = `${getDatePart("year")}-${getDatePart("month")}-${getDatePart("day")}`;

    const competitionsWithStatus = competitions.map((competition) => {
      let statusLomba: string;

      if (!competition.deadline) {
        statusLomba = "TANGGAL_BELUM_DIKETAHUI";
      } else {
        const deadlineKey = competition.deadline.toISOString().slice(0, 10);

        statusLomba = deadlineKey < todayJakarta ? "KEDALUWARSA" : "AKTIF";
      }

      return {
        ...competition,
        statusLomba,
      };
    });

    return res.status(200).json({
      message: "Daftar kompetisi berhasil diambil",
      total: totalItems,
      data: competitionsWithStatus,
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

export const previewLombaHubCrawl = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const limit = Number(req.query.limit ?? 5);

    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 8) {
      return res.status(400).json({
        error: "Limit harus berupa angka antara 1 dan 8.",
      });
    }

    const data = await crawlLombaHubHomepage(limit);

    return res.status(200).json({
      message: "Preview crawling LombaHub berhasil diproses.",
      total: data.length,
      berhasil: data.filter((item) => item.ok).length,
      gagal: data.filter((item) => !item.ok).length,
      data,
    });
  } catch (error: any) {
    console.error("Error previewLombaHubCrawl:", error);

    return res.status(502).json({
      error: error?.message || "Crawling LombaHub gagal.",
    });
  }
};

export const previewLombaHubDetail = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const { url } = req.body ?? {};

    if (typeof url !== "string" || !url.trim()) {
      return res.status(400).json({
        error: "URL detail lomba wajib diisi.",
      });
    }

    const data = await scrapeLombaHubDetail(url.trim());

    return res.status(200).json({
      message: "Preview detail lomba berhasil diambil.",
      data,
    });
  } catch (error: any) {
    console.error("Error previewLombaHubDetail:", error);

    return res.status(502).json({
      error: error?.message || "Scraping detail lomba gagal.",
    });
  }
};

export const importLombaHubDetail = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  const { url } = req.body ?? {};

  if (typeof url !== "string" || !url.trim()) {
    return res.status(400).json({
      error: "URL detail lomba wajib diisi.",
    });
  }

  let preview: LombaHubPreview;

  try {
    preview = await scrapeLombaHubDetail(url.trim());
  } catch (error: any) {
    return res.status(502).json({
      error: error?.message || "Gagal mengambil detail lomba.",
    });
  }

  try {
    const result = await saveLombaHubData(preview);

    if (!result.ok) {
      return res.status(422).json({
        message: "Data lomba belum memenuhi syarat untuk disimpan.",
        error: result.error,
        sourceUrl: result.sourceUrl,
      });
    }

    return res.status(result.action === "created" ? 201 : 200).json({
      message:
        result.action === "created"
          ? "Lomba berhasil disimpan."
          : "Data lomba yang sudah ada berhasil diperbarui.",
      action: result.action,
      data: result.competition,
    });
  } catch (error) {
    console.error("Error importLombaHubDetail:", error);

    return res.status(500).json({
      error: "Scraping berhasil, tetapi penyimpanan ke database gagal.",
    });
  }
};

export const importLombaHubCrawl = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const limitRaw =
      typeof req.query.limit === "string" ? req.query.limit : "5";

    if (!/^\d+$/.test(limitRaw)) {
      return res.status(400).json({
        error: "Limit harus berupa angka bulat antara 1 dan 8.",
      });
    }

    const limit = Number(limitRaw);

    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 8) {
      return res.status(400).json({
        error: "Limit harus berupa angka bulat antara 1 dan 8.",
      });
    }

    const crawled = await crawlLombaHubHomepage(limit);

    const results: Array<{
      ok: boolean;
      sourceUrl: string;
      action?: "created" | "updated";
      competition?: any;
      error?: string;
      warning?: string;
    }> = [];

    for (const item of crawled) {
      // Fallback sudah dibuat di lombahubScraper.ts.
      // Hanya lewati jika data benar-benar tidak tersedia.
      if (!item.data) {
        results.push({
          ok: false,
          sourceUrl: item.sourceUrl,
          error: item.error || "Data lomba tidak tersedia.",
        });

        continue;
      }

      try {
        const result = await saveLombaHubData(item.data, item.ok);

        results.push({
          ...result,
          ...(item.ok
            ? {}
            : {
                warning:
                  item.error ||
                  "Detail gagal diambil; data dasar tetap dicoba disimpan.",
              }),
        });
      } catch (error: unknown) {
        console.error("Gagal menyimpan lomba:", item.sourceUrl, error);

        results.push({
          ok: false,
          sourceUrl: item.sourceUrl,
          error:
            error instanceof Error
              ? error.message
              : "Gagal menyimpan lomba ke database.",
        });
      }
    }

    return res.status(200).json({
      message: "Proses crawling dan impor selesai.",
      total: results.length,
      berhasil: results.filter((item) => item.ok).length,
      dibuat: results.filter((item) => item.ok && item.action === "created")
        .length,
      diperbarui: results.filter((item) => item.ok && item.action === "updated")
        .length,
      gagal: results.filter((item) => !item.ok).length,
      data: results,
    });
  } catch (error: any) {
    console.error("Error importLombaHubCrawl:", error);

    return res.status(502).json({
      error: error?.message || "Crawling LombaHub gagal.",
    });
  }
};
