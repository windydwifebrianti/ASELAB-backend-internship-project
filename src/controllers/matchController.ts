import { Request, Response } from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middleware/authMiddleware";

const prisma = new PrismaClient();

const lockTeamRow = async (
  tx: Prisma.TransactionClient,
  teamId: number,
): Promise<boolean> => {
  const rows = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT id
    FROM \`Team\`
    WHERE id = ${teamId}
    FOR UPDATE
  `;

  return rows.length > 0;
};

export const getTeamRecommendations = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const userId = req.user.userId;
    const { keyword, kategori, skill } = req.query;

    const userProfile = await prisma.profile.findUnique({
      where: { userId: Number(userId) },
    });

    const filterConditions: any = {};
    if (keyword) {
      filterConditions.OR = [
        { nama: { contains: String(keyword) } },
        { deskripsi: { contains: String(keyword) } },
      ];
    }
    if (kategori && kategori !== "Semua") {
      filterConditions.kompetisi = { contains: String(kategori) };
    }

    let teams = await prisma.team.findMany({
      where: {
        ...filterConditions,
        leaderId: { not: userId },
        swipes: { none: { userId: userId } },

        blacklists: {
          none: {
            blockedUserId: Number(userId),
          },
        },
      },
      include: {
        leader: { select: { nama: true } },
        members: { select: { id: true } },
      },
      take: 50,
    });

    if (userProfile && teams.length > 0) {
      const userSkills: string[] = Array.isArray(userProfile.skill)
        ? (userProfile.skill as string[]).map((s) => s.toLowerCase())
        : [];
      const userMinat: string[] = Array.isArray(userProfile.minat)
        ? (userProfile.minat as string[]).map((m) => m.toLowerCase())
        : [];

      const scoredTeams = teams.map((team) => {
        let matchScore = 0;
        const teamSkillsReq: string[] = Array.isArray(team.skillDibutuhkan)
          ? (team.skillDibutuhkan as string[]).map((s) => s.toLowerCase())
          : [];

        userSkills.forEach((userSkill) => {
          if (teamSkillsReq.includes(userSkill)) matchScore += 2;
        });

        const teamDesc = team.deskripsi.toLowerCase();
        userMinat.forEach((minat) => {
          if (teamDesc.includes(minat)) matchScore += 1;
        });

        let persentase = Math.round((matchScore / 10) * 100);
        if (persentase > 98) persentase = 98;
        if (persentase < 10) persentase = 10;

        const anggotaTerisi = team.members.length;

        return {
          ...team,
          kecocokan: `${persentase}%`,
          jumlahAnggotaTeks: `${anggotaTerisi}/${team.kuota || 5} Anggota`,
        };
      });

      if (skill && skill !== "Semua") {
        const searchedSkill = String(skill).toLowerCase();
        teams = scoredTeams.filter(
          (t) =>
            Array.isArray(t.skillDibutuhkan) &&
            (t.skillDibutuhkan as string[]).some((s) =>
              s.toLowerCase().includes(searchedSkill),
            ),
        );
      } else {
        teams = scoredTeams;
      }

      teams.sort(
        (a: any, b: any) => parseInt(b.kecocokan) - parseInt(a.kecocokan),
      );
      teams = teams.slice(0, 20);
    }

    return res
      .status(200)
      .json({ message: "Rekomendasi tim berhasil diambil", data: teams });
  } catch (error) {
    return res.status(500).json({ error: "Terjadi kesalahan server." });
  }
};

export const swipeTeam = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const userId = req.user.userId;
    const { teamId, action } = req.body; // action: "LIKE" | "PASS"

    const teamIdNumber = Number(teamId);

    if (
      !Number.isSafeInteger(teamIdNumber) ||
      teamIdNumber <= 0 ||
      !["LIKE", "PASS"].includes(action)
    ) {
      return res.status(400).json({
        error: "Data teamId dan action (LIKE/PASS) tidak valid.",
      });
    }

    const blacklistEntry = await prisma.teamBlacklist.findUnique({
      where: {
        teamId_blockedUserId: {
          teamId: teamIdNumber,
          blockedUserId: Number(userId),
        },
      },
      select: {
        id: true,
      },
    });

    if (blacklistEntry) {
      return res.status(403).json({
        error: "Anda tidak dapat berinteraksi dengan tim ini.",
      });
    }

    const swipe = await prisma.teamSwipe.upsert({
      where: { userId_teamId: { userId, teamId: teamIdNumber } },
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

export const createJoinRequest = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const userId = Number(req.user?.userId);
    const teamId = Number(req.body?.teamId);
    const { pesan } = req.body ?? {};

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(401).json({
        error: "Identitas pengguna tidak valid.",
      });
    }

    if (!Number.isSafeInteger(teamId) || teamId <= 0) {
      return res.status(400).json({
        error: "teamId harus berupa angka positif.",
      });
    }

    if (pesan !== undefined && pesan !== null && typeof pesan !== "string") {
      return res.status(400).json({
        error: "pesan harus berupa teks.",
      });
    }

    const pesanBersih = typeof pesan === "string" ? pesan.trim() || null : null;

    const result = await prisma.$transaction(async (tx) => {
      const teamExists = await lockTeamRow(tx, teamId);

      if (!teamExists) {
        return {
          statusCode: 404,
          error: "Tim tidak ditemukan.",
        };
      }

      const team = await tx.team.findUnique({
        where: { id: teamId },
      });

      if (!team) {
        return {
          statusCode: 404,
          error: "Tim tidak ditemukan.",
        };
      }

      const blacklistEntry = await tx.teamBlacklist.findUnique({
        where: {
          teamId_blockedUserId: {
            teamId,
            blockedUserId: userId,
          },
        },
        select: {
          id: true,
        },
      });

      if (blacklistEntry) {
        return {
          statusCode: 403,
          error: "Anda tidak dapat mengajukan permintaan ke tim ini.",
        };
      }

      if (team.leaderId === userId) {
        return {
          statusCode: 400,
          error: "Anda tidak dapat bergabung dengan tim sendiri.",
        };
      }

      const existingMember = await tx.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId,
            userId,
          },
        },
      });

      if (existingMember) {
        return {
          statusCode: 409,
          error: "Anda sudah menjadi anggota tim ini.",
        };
      }

      const existingRequest = await tx.joinRequest.findUnique({
        where: {
          userId_teamId: {
            userId,
            teamId,
          },
        },
      });

      if (existingRequest) {
        return {
          statusCode: 409,
          error: "Anda sudah pernah mengirim permintaan ke tim ini.",
        };
      }

      const memberCount = await tx.teamMember.count({
        where: { teamId },
      });

      if (memberCount >= team.kuota) {
        return {
          statusCode: 409,
          error: "Tim sudah penuh.",
        };
      }

      const joinRequest = await tx.joinRequest.create({
        data: {
          userId,
          teamId,
          pesan: pesanBersih,
        },
      });

      await tx.notification.create({
        data: {
          userId: team.leaderId,
          title: "Join Request Baru",
          message: `Seseorang ingin bergabung dengan tim Anda (${team.nama}).`,
        },
      });

      return { data: joinRequest };
    });

    if ("statusCode" in result && typeof result.statusCode === "number") {
      return res.status(result.statusCode).json({
        error: result.error,
      });
    }

    return res.status(201).json({
      message: "Join Request berhasil dikirim.",
      data: result.data,
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({
        error: "Anda sudah pernah mengirim permintaan ke tim ini.",
      });
    }

    if (error?.code === "P2034") {
      return res.status(409).json({
        error: "Terjadi perubahan bersamaan. Silakan coba kembali.",
      });
    }

    console.error("Error createJoinRequest:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan server.",
    });
  }
};

export const manageJoinRequest = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const leaderId = Number(req.user?.userId);
    const requestId = Number(req.params.id);
    const { status } = req.body ?? {};

    if (!Number.isSafeInteger(leaderId) || leaderId <= 0) {
      return res.status(401).json({
        error: "Identitas pengguna tidak valid.",
      });
    }

    if (!Number.isSafeInteger(requestId) || requestId <= 0) {
      return res.status(400).json({
        error: "ID join request tidak valid.",
      });
    }

    if (status !== "ACCEPTED" && status !== "REJECTED") {
      return res.status(400).json({
        error: 'Status harus "ACCEPTED" atau "REJECTED".',
      });
    }

    const initialRequest = await prisma.joinRequest.findUnique({
      where: { id: requestId },
      include: { team: true },
    });

    if (!initialRequest) {
      return res.status(404).json({
        error: "Request tidak ditemukan.",
      });
    }

    if (initialRequest.team.leaderId !== leaderId) {
      return res.status(403).json({
        error: "Akses ditolak. Anda bukan Team Leader.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const teamExists = await lockTeamRow(tx, initialRequest.teamId);

      if (!teamExists) {
        return {
          statusCode: 404,
          error: "Tim tidak ditemukan.",
        };
      }

      const currentRequest = await tx.joinRequest.findUnique({
        where: { id: requestId },
        include: { team: true },
      });

      if (!currentRequest) {
        return {
          statusCode: 404,
          error: "Request tidak ditemukan.",
        };
      }

      if (currentRequest.team.leaderId !== leaderId) {
        return {
          statusCode: 403,
          error: "Akses ditolak. Anda bukan Team Leader.",
        };
      }

      if (currentRequest.status !== "PENDING") {
        return {
          statusCode: 409,
          error: "Request ini sudah diproses sebelumnya.",
        };
      }

      if (status === "ACCEPTED") {
        const blacklistEntry = await tx.teamBlacklist.findUnique({
          where: {
            teamId_blockedUserId: {
              teamId: currentRequest.teamId,
              blockedUserId: currentRequest.userId,
            },
          },
          select: {
            id: true,
          },
        });

        if (blacklistEntry) {
          return {
            statusCode: 403,
            error: "Pengguna ini masuk blacklist tim dan tidak dapat diterima.",
          };
        }
      }

      if (status === "ACCEPTED") {
        const existingMember = await tx.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId: currentRequest.teamId,
              userId: currentRequest.userId,
            },
          },
        });

        if (existingMember) {
          return {
            statusCode: 409,
            error: "Pengguna sudah menjadi anggota tim ini.",
          };
        }

        const memberCount = await tx.teamMember.count({
          where: {
            teamId: currentRequest.teamId,
          },
        });

        if (memberCount >= currentRequest.team.kuota) {
          return {
            statusCode: 409,
            error: "Tim sudah penuh. Request tidak dapat diterima.",
          };
        }
      }

      const updated = await tx.joinRequest.updateMany({
        where: {
          id: requestId,
          status: "PENDING",
        },
        data: { status },
      });

      if (updated.count !== 1) {
        return {
          statusCode: 409,
          error: "Request sudah diproses oleh proses lain.",
        };
      }

      if (status === "ACCEPTED") {
        await tx.teamMember.create({
          data: {
            teamId: currentRequest.teamId,
            userId: currentRequest.userId,
            role: "MEMBER",
          },
        });
      }

      const statusText = status === "ACCEPTED" ? "diterima" : "ditolak";

      await tx.notification.create({
        data: {
          userId: currentRequest.userId,
          title: "Update Join Request",
          message: `Permintaan Anda untuk bergabung dengan tim ${currentRequest.team.nama} telah ${statusText}.`,
        },
      });

      return {
        message: `Join Request berhasil ${status}.`,
      };
    });

    if ("statusCode" in result && typeof result.statusCode === "number") {
      return res.status(result.statusCode).json({
        error: result.error,
      });
    }

    return res.status(200).json({
      message: result.message,
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({
        error: "Pengguna sudah terdaftar sebagai anggota tim.",
      });
    }

    if (error?.code === "P2034") {
      return res.status(409).json({
        error: "Terjadi perubahan bersamaan. Silakan coba kembali.",
      });
    }

    console.error("Error manageJoinRequest:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan server saat mengelola request.",
    });
  }
};

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
