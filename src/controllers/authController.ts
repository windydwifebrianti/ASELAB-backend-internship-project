import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import jwt from "jsonwebtoken";
import { cekStatusMahasiswa } from "../utils/nimfinder";

const prisma = new PrismaClient();

const verifyMicrosoftToken = async (ssoToken: string) => {
  const msResponse = await axios.get("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${ssoToken}` },
  });
  return msResponse.data.mail || msResponse.data.userPrincipalName;
};

// 1. FUNGSI REGISTER
export const register = async (req: Request, res: Response): Promise<any> => {
  try {
    // Nama dan NIM tetap diinput manual, Token sebagai pengganti Password
    const { nama, nim, ssoToken } = req.body;

    if (!nama || !nim || !ssoToken) {
      return res
        .status(400)
        .json({ error: "Nama, NIM, dan Token SSO wajib diisi!" });
    }

    // 1. Verifikasi Token SSO untuk mendapatkan Email asli
    let emailInstitusi;
    try {
      emailInstitusi = await verifyMicrosoftToken(ssoToken);
    } catch (error) {
      return res
        .status(401)
        .json({ error: "Token SSO tidak valid atau kadaluarsa." });
    }

    // Cek apakah email berakhiran .ac.id (Indonesia) atau .edu (Internasional)
    const isEmailKampus =
      emailInstitusi.endsWith(".ac.id") || emailInstitusi.endsWith(".edu");

    // Opsional: Jika kamu juga ingin melarang email publik secara eksplisit
    const isEmailPublik =
      emailInstitusi.includes("@gmail.com") ||
      emailInstitusi.includes("@yahoo.com") ||
      emailInstitusi.includes("@outlook.com");

    if (!isEmailKampus || isEmailPublik) {
      return res.status(403).json({
        error:
          "Registrasi ditolak. Harap gunakan email resmi institusi pendidikan (.ac.id atau .edu).",
      });
    }

    // 2. Cek apakah sudah terdaftar
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ emailInstitusi }, { nim }] },
    });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "Akun sudah terdaftar. Silakan langsung login." });
    }

    // 3. Validasi ke API Nimfinder
    let dataMahasiswa;
    try {
      dataMahasiswa = await cekStatusMahasiswa(nim);
      if (dataMahasiswa.total === 0) {
        return res
          .status(400)
          .json({ error: "NIM tidak ditemukan di sistem." });
      }
      if (!dataMahasiswa.results[0].status.toLowerCase().includes("aktif")) {
        return res
          .status(400)
          .json({ error: "Status Anda bukan Mahasiswa Aktif." });
      }
    } catch (apiError: any) {
      return res.status(502).json({ error: apiError.message });
    }

    // 4. Simpan ke Database
    await prisma.user.create({
      data: { nama, nim, emailInstitusi },
    });

    // 5. Kembalikan data utuh Nimfinder
    return res.status(201).json(dataMahasiswa);
  } catch (error) {
    console.error("Error di register:", error);
    return res.status(500).json({ error: "Terjadi kesalahan pada server" });
  }
};

// 2. FUNGSI LOGIN

export const login = async (req: Request, res: Response): Promise<any> => {
  try {
    // User login dengan NIM dan Token SSO
    const { nim, ssoToken } = req.body;

    if (!nim || !ssoToken) {
      return res
        .status(400)
        .json({ error: "NIM dan Token SSO wajib dikirim!" });
    }

    // 1. Verifikasi Token SSO
    let emailInstitusi;
    try {
      emailInstitusi = await verifyMicrosoftToken(ssoToken);
    } catch (error) {
      return res
        .status(401)
        .json({ error: "Token SSO tidak valid atau kadaluarsa." });
    }

    // 2. Cari user di database berdasarkan NIM dan Email dari Token
    const user = await prisma.user.findFirst({
      where: {
        nim: nim,
        emailInstitusi: emailInstitusi,
      },
    });

    if (!user) {
      return res.status(401).json({
        error: "Akun tidak ditemukan atau NIM tidak cocok dengan email SSO.",
      });
    }

    // 3. Buatkan Token JWT sesi internal milik kita
    const token = jwt.sign(
      { userId: user.id, nim: user.nim, email: user.emailInstitusi },
      process.env.JWT_SECRET as string,
      { expiresIn: "1d" },
    );

    return res.status(200).json({
      message: "Login berhasil!",
      token: token, // Tiket JWT yang akan dibawa Frontend ke halaman selanjutnya
      user: {
        nama: user.nama,
        nim: user.nim,
        email: user.emailInstitusi,
      },
    });
  } catch (error) {
    console.error("Error di login:", error);
    return res.status(500).json({ error: "Terjadi kesalahan pada server" });
  }
};

import { AuthRequest } from "../middleware/authMiddleware";

export const getProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    const { nim, email } = req.user;

    const userProfile = await prisma.user.findFirst({
      where: { nim: nim },
      select: {
        id: true,
        nama: true,
        nim: true,
        emailInstitusi: true,
        profile: true,
      },
    });

    if (!userProfile) {
      return res.status(404).json({ error: "Data pengguna tidak ditemukan." });
    }

    return res.status(200).json({
      message: "Berhasil mengambil profil",
      data: userProfile,
    });
  } catch (error) {
    console.error("Error di getProfile:", error);
    return res.status(500).json({ error: "Terjadi kesalahan pada server" });
  }
};

// 3. FUNGSI KELOLA PROFIL (FR-PM-01, FR-PM-02, FR-PM-03)
export const upsertProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<any> => {
  try {
    // ID User diambil dari token JWT yang sudah divalidasi oleh middleware (NFR-05, NFR-07)
    const userId = req.user.userId;
    const { jurusan, skill, minat, pengalamanLomba } = req.body;

    // Validasi input dasar (NFR-06)
    if (!jurusan) {
      return res.status(400).json({ error: "Data jurusan wajib diisi." });
    }

    // Upsert: Memastikan relasi One-to-One mutlak (NFR-14).
    const profile = await prisma.profile.upsert({
      where: { userId: Number(userId) },
      update: {
        jurusan,
        skill: skill || [],
        minat: minat || [],
        pengalamanLomba: pengalamanLomba || "",
      },
      create: {
        userId: Number(userId),
        jurusan,
        skill: skill || [],
        minat: minat || [],
        pengalamanLomba: pengalamanLomba || "",
      },
    });

    return res.status(200).json({
      message: "Data profil berhasil disimpan dan diperbarui.",
      data: profile,
    });
  } catch (error) {
    console.error("Error di upsertProfile:", error);
    // Penanganan kegagalan sistem agar tidak merusak data (NFR-15)
    return res
      .status(500)
      .json({ error: "Terjadi kesalahan server saat menyimpan profil." });
  }
};

// 4. FUNGSI MELIHAT PROFIL PENGGUNA LAIN (FR-PM-04)
export const getPublicProfile = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const targetUserId = parseInt(req.params.id);

    // Validasi parameter ID (NFR-06)
    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: "ID pengguna tidak valid." });
    }

    // Ambil data user beserta profilnya secara read-only
    const userProfile = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        nama: true,
        // Menyembunyikan emailInstitusi untuk menjaga privasi publik
        profile: true,
      },
    });

    if (!userProfile || !userProfile.profile) {
      return res
        .status(404)
        .json({ error: "Profil pengguna tidak ditemukan atau belum diisi." });
    }

    return res.status(200).json({
      message: "Berhasil mengambil profil pengguna.",
      data: userProfile,
    });
  } catch (error) {
    console.error("Error di getPublicProfile:", error);
    return res
      .status(500)
      .json({ error: "Terjadi kesalahan server saat mengambil profil." });
  }
};
