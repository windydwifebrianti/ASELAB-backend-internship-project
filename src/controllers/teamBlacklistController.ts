import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middleware/authMiddleware";

const prisma = new PrismaClient();

export const addTeamBlacklist = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  try {
    const leaderId = Number(req.user?.userId);
    const teamId = Number(req.params.teamId);
    const { nama } = req.body ?? {};

    if (!Number.isSafeInteger(leaderId) || leaderId <= 0) {
      return res.status(401).json({
        error: "Identitas pengguna tidak valid.",
      });
    }

    if (!Number.isSafeInteger(teamId) || teamId <= 0) {
      return res.status(400).json({
        error: "ID tim tidak valid.",
      });
    }

    if (typeof nama !== "string" || !nama.trim()) {
      return res.status(400).json({
        error: "Nama pengguna wajib diisi.",
      });
    }
    const result = await prisma.$transaction(async (tx) => {
      const lockedTeams = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id
        FROM \`Team\`
        WHERE id = ${teamId}
        FOR UPDATE
      `;

      if (lockedTeams.length === 0) {
        return {
          statusCode: 404,
          error: "Tim tidak ditemukan.",
        };
      }

      const team = await tx.team.findUnique({
        where: { id: teamId },
        select: {
          id: true,
          nama: true,
          leaderId: true,
        },
      });

      if (!team) {
        return {
          statusCode: 404,
          error: "Tim tidak ditemukan.",
        };
      }

      if (team.leaderId !== leaderId) {
        return {
          statusCode: 403,
          error: "Hanya leader tim yang dapat mengelola blacklist.",
        };
      }

      const matchingUsers = await tx.user.findMany({
        where: {
          nama: nama.trim(),
        },
        take: 2,
        select: {
          id: true,
          nim: true,
          nama: true,
        },
      });

      if (matchingUsers.length === 0) {
        return {
          statusCode: 404,
          error: "Pengguna dengan nama tersebut tidak ditemukan.",
        };
      }

      if (matchingUsers.length > 1) {
        return {
          statusCode: 409,
          error:
            "Ada beberapa pengguna dengan nama tersebut. Pilih akun yang tepat agar tidak salah memasukkan pengguna ke blacklist.",
        };
      }

      const targetUser = matchingUsers[0];

      if (!targetUser) {
        return {
          statusCode: 404,
          error: "Pengguna dengan NIM tersebut tidak ditemukan.",
        };
      }

      if (targetUser.id === leaderId) {
        return {
          statusCode: 400,
          error: "Anda tidak dapat memasukkan diri sendiri ke blacklist.",
        };
      }

      const existingMember = await tx.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId,
            userId: targetUser.id,
          },
        },
        select: {
          id: true,
        },
      });

      if (existingMember) {
        return {
          statusCode: 409,
          error:
            "Pengguna sudah menjadi anggota tim. Gunakan fitur pengelolaan anggota.",
        };
      }

      const blacklist = await (tx as any).teamBlacklist.create({
        data: {
          teamId,
          blockedUserId: targetUser.id,
          createdById: leaderId,
        },
      });

      const rejectedRequests = await tx.joinRequest.updateMany({
        where: {
          teamId,
          userId: targetUser.id,
          status: "PENDING",
        },
        data: {
          status: "REJECTED",
        },
      });

      // 9. Kirim notifikasi jika ada request yang ditolak.
      if (rejectedRequests.count > 0) {
        await tx.notification.create({
          data: {
            userId: targetUser.id,
            title: "Update Join Request",
            message: `Permintaan Anda untuk bergabung dengan tim ${team.nama} ditolak.`,
          },
        });
      }

      return {
        data: {
          id: blacklist.id,
          teamId: blacklist.teamId,
          blockedUserId: targetUser.id,
          nim: targetUser.nim,
          nama: targetUser.nama,
          createdAt: blacklist.createdAt,
          rejectedPendingRequests: rejectedRequests.count,
        },
      };
    });

    if ("statusCode" in result && typeof result.statusCode === "number") {
      return res.status(result.statusCode).json({
        error: result.error,
      });
    }

    return res.status(201).json({
      message: "Pengguna berhasil dimasukkan ke blacklist tim.",
      data: result.data,
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({
        error: "Pengguna tersebut sudah ada di blacklist tim.",
      });
    }

    if (error?.code === "P2034") {
      return res.status(409).json({
        error: "Terjadi perubahan bersamaan. Silakan coba kembali.",
      });
    }

    console.error("Error addTeamBlacklist:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan server.",
    });
  }
};

export const getTeamBlacklist = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  try {
    const leaderId = Number(req.user?.userId);
    const teamId = Number(req.params.teamId);

    if (!Number.isSafeInteger(leaderId) || leaderId <= 0) {
      return res.status(401).json({
        error: "Identitas pengguna tidak valid.",
      });
    }

    if (!Number.isSafeInteger(teamId) || teamId <= 0) {
      return res.status(400).json({
        error: "ID tim tidak valid.",
      });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        leaderId: true,
      },
    });

    if (!team) {
      return res.status(404).json({
        error: "Tim tidak ditemukan.",
      });
    }

    if (team.leaderId !== leaderId) {
      return res.status(403).json({
        error: "Hanya leader tim yang dapat melihat blacklist.",
      });
    }

    const blacklists = await (prisma as any).teamBlacklist.findMany({
      where: { teamId },
      include: {
        blockedUser: {
          select: {
            id: true,
            nim: true,
            nama: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      message: "Daftar blacklist tim berhasil diambil.",
      total: blacklists.length,
      data: blacklists,
    });
  } catch (error) {
    console.error("Error getTeamBlacklist:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan server.",
    });
  }
};

export const removeTeamBlacklist = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  try {
    const leaderId = Number(req.user?.userId);
    const teamId = Number(req.params.teamId);
    const blockedUserId = Number(req.params.userId);

    if (!Number.isSafeInteger(leaderId) || leaderId <= 0) {
      return res.status(401).json({
        error: "Identitas pengguna tidak valid.",
      });
    }

    if (
      !Number.isSafeInteger(teamId) ||
      teamId <= 0 ||
      !Number.isSafeInteger(blockedUserId) ||
      blockedUserId <= 0
    ) {
      return res.status(400).json({
        error: "ID tim atau ID pengguna tidak valid.",
      });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        leaderId: true,
      },
    });

    if (!team) {
      return res.status(404).json({
        error: "Tim tidak ditemukan.",
      });
    }

    if (team.leaderId !== leaderId) {
      return res.status(403).json({
        error: "Hanya leader tim yang dapat mengelola blacklist.",
      });
    }

    const result = await (prisma as any).teamBlacklist.deleteMany({
      where: {
        teamId,
        blockedUserId,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({
        error: "Pengguna tidak ditemukan dalam blacklist tim ini.",
      });
    }

    return res.status(200).json({
      message: "Pengguna berhasil dihapus dari blacklist tim.",
    });
  } catch (error) {
    console.error("Error removeTeamBlacklist:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan server.",
    });
  }
};
