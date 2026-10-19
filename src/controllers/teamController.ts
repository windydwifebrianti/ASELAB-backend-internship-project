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

    const teamId = Number(req.params.id);

    if (!Number.isSafeInteger(teamId) || teamId <= 0) {
      return res.status(400).json({
        error: "ID tim tidak valid.",
      });
    }

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
    const teamId = Number(req.params.id);

    if (!Number.isSafeInteger(teamId) || teamId <= 0) {
      return res.status(400).json({
        error: "ID tim tidak valid.",
      });
    }

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
    const teamId = Number(req.params.id);
    const userId = Number(req.user?.userId);

    if (
      !Number.isSafeInteger(teamId) ||
      teamId <= 0 ||
      !Number.isSafeInteger(userId) ||
      userId <= 0
    ) {
      return res.status(400).json({
        error: "ID tim atau pengguna tidak valid.",
      });
    }

    const blacklistEntry = await prisma.teamBlacklist.findUnique({
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
      return res.status(404).json({
        error: "Tim tidak ditemukan.",
      });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: {
              select: {
                nama: true,
                profile: {
                  select: {
                    jurusan: true,
                    skill: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!team) {
      return res.status(404).json({
        error: "Tim tidak ditemukan.",
      });
    }

    return res.status(200).json({
      message: "Berhasil mengambil detail tim",
      data: team,
    });
  } catch (error) {
    console.error("Error getTeamDetail:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan server saat mengambil data tim.",
    });
  }
};

export const getMyTeams = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const userId = Number(req.user?.userId);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(401).json({
        error: "Identitas pengguna tidak valid.",
      });
    }

    const teams = await prisma.team.findMany({
      where: {
        leaderId: userId,
      },
      include: {
        leader: {
          select: {
            id: true,
            nama: true,
          },
        },
        members: {
          select: {
            id: true,
            role: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                nama: true,
                profile: {
                  select: {
                    jurusan: true,
                    fotoProfilUrl: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const data = teams.map(({ _count, ...team }) => ({
      ...team,
      peranSaya: "LEADER",
      jumlahAnggota: _count.members,
      sisaKuota: Math.max(team.kuota - _count.members, 0),
    }));

    return res.status(200).json({
      message: "Daftar tim yang Anda pimpin berhasil diambil.",
      data,
    });
  } catch (error) {
    console.error("Error getMyTeams:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan server.",
    });
  }
};

export const getJoinedTeams = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const userId = Number(req.user?.userId);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(401).json({
        error: "Identitas pengguna tidak valid.",
      });
    }

    const teams = await prisma.team.findMany({
      where: {
        members: {
          some: {
            userId,
            role: "MEMBER",
          },
        },
      },
      include: {
        leader: {
          select: {
            id: true,
            nama: true,
          },
        },
        members: {
          select: {
            id: true,
            role: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                nama: true,
                profile: {
                  select: {
                    jurusan: true,
                    fotoProfilUrl: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const data = teams.map(({ _count, ...team }) => ({
      ...team,
      peranSaya: "MEMBER",
      jumlahAnggota: _count.members,
      sisaKuota: Math.max(team.kuota - _count.members, 0),
    }));

    return res.status(200).json({
      message: "Daftar tim yang Anda ikuti berhasil diambil.",
      data,
    });
  } catch (error) {
    console.error("Error getJoinedTeams:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan server.",
    });
  }
};

export const getMyTeamJoinRequests = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const userId = Number(req.user?.userId);
    const statusQuery = req.query.status;
    const validStatuses = ["PENDING", "ACCEPTED", "REJECTED"];

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(401).json({
        error: "Identitas pengguna tidak valid.",
      });
    }

    if (
      statusQuery !== undefined &&
      (typeof statusQuery !== "string" || !validStatuses.includes(statusQuery))
    ) {
      return res.status(400).json({
        error: "Filter status harus PENDING, ACCEPTED, atau REJECTED.",
      });
    }

    const requests = await prisma.joinRequest.findMany({
      where: {
        team: {
          leaderId: userId,
        },
        ...(typeof statusQuery === "string" ? { status: statusQuery } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            nama: true,
            profile: {
              select: {
                jurusan: true,
                skill: true,
                minat: true,
                fotoProfilUrl: true,
              },
            },
          },
        },
        team: {
          select: {
            id: true,
            nama: true,
            kompetisi: true,
            kuota: true,
            _count: {
              select: {
                members: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      message: "Daftar join request untuk tim Anda berhasil diambil.",
      data: requests.map((request) => ({
        ...request,
        jumlahAnggota: request.team._count.members,
        sisaKuota: Math.max(
          request.team.kuota - request.team._count.members,
          0,
        ),
      })),
    });
  } catch (error) {
    console.error("Error getMyTeamJoinRequests:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan server.",
    });
  }
};
