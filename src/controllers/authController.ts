import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { cekStatusMahasiswa } from "../utils/nimfinder";

const prisma = new PrismaClient();

// Konfigurasi Email
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 1. Fungsi Meminta OTP ke Email Pengguna
export const requestOtp = async (req: Request, res: Response): Promise<any> => {
  try {
    const { emailInstitusi } = req.body;

    if (!emailInstitusi) {
      return res.status(400).json({ error: "Email wajib diisi!" });
    }

    // Cek apakah email berakhiran .ac.id atau .edu
    const isEmailKampus =
      emailInstitusi.endsWith(".ac.id") || emailInstitusi.endsWith(".edu");
    if (!isEmailKampus) {
      return res.status(403).json({
        error: "Harap gunakan email institusi pendidikan (.ac.id atau .edu).",
      });
    }

    // Generate 6 digit angka acak
    const kodeOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

    // Simpan ke database (tabel Otp)
    await prisma.otp.upsert({
      where: { email: emailInstitusi },
      update: { kodeOtp, expiresAt },
      create: { email: emailInstitusi, kodeOtp, expiresAt },
    });

    // Kirim email
    await transporter.sendMail({
      from: `"Tim Matching System" <${process.env.EMAIL_USER}>`,
      to: emailInstitusi,
      subject: "Kode Verifikasi OTP Anda",
      html: `<p>Kode OTP Anda adalah: <b>${kodeOtp}</b></p><p>Kode ini akan kedaluwarsa dalam 5 menit. Jangan bagikan kode ini kepada siapapun.</p>`,
    });

    return res
      .status(200)
      .json({ message: "OTP berhasil dikirim ke email Anda." });
  } catch (error) {
    console.error("Error requestOtp:", error);
    return res.status(500).json({ error: "Gagal mengirim OTP." });
  }
};

// 2. Fungsi Register dengan OTP
export const register = async (req: Request, res: Response): Promise<any> => {
  try {
    const { nama, nim, emailInstitusi, otp } = req.body;

    if (!nama || !nim || !emailInstitusi || !otp) {
      return res
        .status(400)
        .json({ error: "Nama, NIM, Email Institusi, dan OTP wajib diisi!" });
    }

    // 1. Verifikasi OTP
    const validOtp = await prisma.otp.findFirst({
      where: { email: emailInstitusi, kodeOtp: otp },
    });

    if (!validOtp) {
      return res
        .status(400)
        .json({ error: "OTP salah atau tidak cocok dengan email." });
    }
    if (validOtp.expiresAt < new Date()) {
      return res
        .status(400)
        .json({ error: "OTP sudah kedaluwarsa. Silakan minta ulang." });
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

    // 5. Hapus OTP setelah berhasil digunakan
    await prisma.otp.delete({ where: { email: emailInstitusi } });

    return res
      .status(201)
      .json({ message: "Registrasi berhasil!", data: dataMahasiswa });
  } catch (error) {
    console.error("Error di register:", error);
    return res.status(500).json({ error: "Terjadi kesalahan pada server" });
  }
};

// 2. FUNGSI LOGIN dengan OTP

export const login = async (req: Request, res: Response): Promise<any> => {
  try {
    const { emailInstitusi, otp } = req.body;

    if (!emailInstitusi || !otp) {
      return res
        .status(400)
        .json({ error: "NIM dan Token SSO wajib dikirim!" });
    }

    // 1. Verifikasi OTP
    const validOtp = await prisma.otp.findFirst({
      where: { email: emailInstitusi, kodeOtp: otp },
    });

    if (!validOtp) return res.status(400).json({ error: "OTP salah." });
    if (validOtp.expiresAt < new Date())
      return res.status(400).json({ error: "OTP kedaluwarsa." });

    // 2. Cari user di database
    const user = await prisma.user.findFirst({
      where: { emailInstitusi: emailInstitusi },
    });

    if (!user) {
      return res.status(401).json({
        error: "Akun tidak ditemukan. Silakan register terlebih dahulu.",
      });
    }

    // 3. Buat Token JWT
    const token = jwt.sign(
      { userId: user.id, nim: user.nim, email: user.emailInstitusi },
      process.env.JWT_SECRET as string,
      { expiresIn: "1d" },
    );

    // 4. Hapus OTP
    await prisma.otp.delete({ where: { email: emailInstitusi } });

    return res.status(200).json({
      message: "Login berhasil!",
      token: token,
      user: { nama: user.nama, nim: user.nim, email: user.emailInstitusi },
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
