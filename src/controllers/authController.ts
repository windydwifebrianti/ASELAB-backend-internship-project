import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { cekStatusMahasiswa } from "../utils/nimfinder";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { AuthRequest } from "../middleware/authMiddleware";

const prisma = new PrismaClient();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const generateOtp = (): string => {
  return crypto.randomInt(100000, 1000000).toString();
};

const getOtpExpiration = (): Date => {
  return new Date(Date.now() + 5 * 60 * 1000);
};

const isInstitutionEmail = (email: string): boolean => {
  return email.endsWith(".ac.id") || email.endsWith(".edu");
};

export const requestRegisterOtp = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { token, nama, nim, emailInstitusi, password } = req.body;

    if (token) {
      const tempRegistration = await prisma.tempRegistration.findUnique({
        where: {
          token: String(token).trim(),
        },
      });

      if (!tempRegistration) {
        return res.status(404).json({
          error: "Sesi registrasi tidak ditemukan. Silakan registrasi ulang.",
        });
      }

      if (tempRegistration.status !== "PENDING") {
        return res.status(400).json({
          error: "Sesi registrasi sudah tidak aktif.",
        });
      }

      if (tempRegistration.attemptResend >= 3) {
        return res.status(429).json({
          error: "Batas pengiriman ulang OTP telah tercapai.",
        });
      }

      const newCode = generateOtp();
      const newExpiresAt = getOtpExpiration();

      const updatedRegistration = await prisma.tempRegistration.update({
        where: {
          id: tempRegistration.id,
        },
        data: {
          code: newCode,
          expiresAt: newExpiresAt,
          attemptCode: 0,
          attemptResend: {
            increment: 1,
          },
        },
      });

      await transporter.sendMail({
        from: `"Tim Matching System" <${process.env.EMAIL_USER}>`,
        to: updatedRegistration.email,
        subject: "Kode Verifikasi OTP Anda",
        html: `<p>Kode OTP Anda adalah: <b>${newCode}</b></p><p>Kode ini akan kedaluwarsa dalam 5 menit. Jangan bagikan kode ini kepada siapapun.</p>`,
      });

      return res.status(200).json({
        message: "OTP baru berhasil dikirim ke email Anda.",
        expiresAt: updatedRegistration.expiresAt,
        emailInstitusi: updatedRegistration.email,
      });
    }

    if (!nama || !nim || !emailInstitusi || !password) {
      return res.status(400).json({
        error: "Nama, NIM, email institusi, dan password wajib diisi.",
      });
    }

    const normalizedNama = String(nama).trim();
    const normalizedNim = String(nim).trim();
    const normalizedEmail = String(emailInstitusi).trim().toLowerCase();
    const normalizedPassword = String(password);

    const isEmailKampus =
      normalizedEmail.endsWith(".ac.id") || normalizedEmail.endsWith(".edu");

    if (!isEmailKampus) {
      return res.status(403).json({
        error: "Harap gunakan email institusi pendidikan (.ac.id atau .edu).",
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ emailInstitusi: normalizedEmail }, { nim: normalizedNim }],
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        error: "Akun sudah terdaftar. Silakan langsung login.",
      });
    }

    try {
      const dataMahasiswa = await cekStatusMahasiswa(normalizedNim);
      console.log(Object.keys(dataMahasiswa.results?.[0] ?? {}));

      if (
        !Array.isArray(dataMahasiswa.results) ||
        dataMahasiswa.results.length === 0
      ) {
        return res.status(400).json({
          error: "NIM tidak ditemukan di sistem.",
        });
      }

      const mahasiswa = dataMahasiswa.results.find(
        (item: any) => String(item.nim).trim() === normalizedNim,
      );

      if (!mahasiswa) {
        return res.status(400).json({
          error: "NIM tidak ditemukan di sistem.",
        });
      }

      const normalisasiNama = (nama: string) =>
        nama.trim().replace(/\s+/g, " ").toLowerCase();

      if (
        !mahasiswa.nama ||
        normalisasiNama(mahasiswa.nama) !== normalisasiNama(normalizedNama)
      ) {
        return res.status(400).json({
          error: "Nama tidak sesuai dengan pemilik NIM.",
        });
      }

      const status = String(mahasiswa.status ?? "")
        .trim()
        .toLowerCase();

      const isAktif = /^aktif(?:$|\s|-)/.test(status);

      if (!isAktif) {
        return res.status(400).json({
          error: "Hanya mahasiswa berstatus Aktif yang dapat mendaftar.",
        });
      }
    } catch (apiError: any) {
      return res.status(502).json({
        error: apiError.message || "Gagal memvalidasi data mahasiswa.",
      });
    }

    const kodeOtp = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const registrationToken = crypto.randomBytes(32).toString("hex");
    const passwordHash = await bcrypt.hash(normalizedPassword, 10);

    await prisma.tempRegistration.upsert({
      where: {
        email: normalizedEmail,
      },
      update: {
        nama: normalizedNama,
        nim: normalizedNim,
        password: passwordHash,
        token: registrationToken,
        code: kodeOtp,
        expiresAt,
        status: "PENDING",
      },
      create: {
        nama: normalizedNama,
        nim: normalizedNim,
        email: normalizedEmail,
        password: passwordHash,
        token: registrationToken,
        code: kodeOtp,
        expiresAt,
        attemptCode: 0,
        attemptResend: 0,
        status: "PENDING",
      },
    });

    await transporter.sendMail({
      from: `"Tim Matching System" <${process.env.EMAIL_USER}>`,
      to: normalizedEmail,
      subject: "Kode Verifikasi OTP Anda",
      html: `<p>Kode OTP Anda adalah: <b>${kodeOtp}</b></p><p>Kode ini akan kedaluwarsa dalam 5 menit. Jangan bagikan kode ini kepada siapapun.</p>`,
    });

    return res.status(200).json({
      message: "OTP berhasil dikirim ke email Anda.",
      token: registrationToken,
      expiresAt: expiresAt,
      emailInstitusi: normalizedEmail,
    });
  } catch (error) {
    console.error("Error requestRegisterOtp:", error);

    return res.status(500).json({
      error: "Gagal mengirim OTP.",
    });
  }
};

export const requestOtp = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { emailInstitusi } = req.body;

    if (!emailInstitusi) {
      return res.status(400).json({
        error: "Email wajib diisi.",
      });
    }

    const normalizedEmail = String(emailInstitusi).trim().toLowerCase();

    if (!isInstitutionEmail(normalizedEmail)) {
      return res.status(403).json({
        error: "Harap gunakan email institusi pendidikan (.ac.id atau .edu).",
      });
    }

    const kodeOtp = generateOtp();
    const expiresAt = getOtpExpiration();

    await prisma.otp.upsert({
      where: {
        email: normalizedEmail,
      },
      update: {
        kodeOtp,
        expiresAt,
      },
      create: {
        email: normalizedEmail,
        kodeOtp,
        expiresAt,
      },
    });

    await transporter.sendMail({
      from: `"Tim Matching System" <${process.env.EMAIL_USER}>`,
      to: normalizedEmail,
      subject: "Kode Verifikasi OTP Anda",
      html: `<p>Kode OTP Anda adalah: <b>${kodeOtp}</b></p><p>Kode ini akan kedaluwarsa dalam 5 menit. Jangan bagikan kode ini kepada siapapun.</p>`,
    });

    return res.status(200).json({
      message: "OTP berhasil dikirim ke email Anda.",
      expiresAt: expiresAt,
      emailInstitusi: normalizedEmail,
    });
  } catch (error) {
    console.error("Error requestOtp:", error);

    return res.status(500).json({
      error: "Gagal mengirim OTP.",
    });
  }
};

export const getRegisterSession = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: "Token registrasi wajib diisi.",
      });
    }

    const tempRegistration = await prisma.tempRegistration.findUnique({
      where: {
        token: String(token).trim(),
      },
      select: {
        nama: true,
        email: true,
        expiresAt: true,
        status: true,
      },
    });

    if (!tempRegistration) {
      return res.status(404).json({
        error: "Sesi registrasi tidak ditemukan.",
      });
    }

    if (tempRegistration.status !== "PENDING") {
      return res.status(400).json({
        error: "Sesi registrasi sudah tidak aktif.",
      });
    }

    return res.status(200).json({
      message: "Sesi registrasi ditemukan.",
      data: {
        nama: tempRegistration.nama,
        emailInstitusi: tempRegistration.email,
        expiresAt: tempRegistration.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error getRegisterSession:", error);

    return res.status(500).json({
      error: "Gagal mengambil sesi registrasi.",
    });
  }
};

export const register = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { token, otp } = req.body;

    if (!token || !otp) {
      return res.status(400).json({
        error: "Token dan OTP wajib diisi.",
      });
    }

    const normalizedToken = String(token).trim();
    const normalizedOtp = String(otp).trim();

    const tempRegistration = await prisma.tempRegistration.findUnique({
      where: {
        token: normalizedToken,
      },
    });

    if (!tempRegistration) {
      return res.status(404).json({
        error: "Sesi registrasi tidak ditemukan. Silakan registrasi ulang.",
      });
    }

    if (tempRegistration.status !== "PENDING") {
      return res.status(400).json({
        error: "Sesi registrasi sudah tidak aktif.",
      });
    }

    if (tempRegistration.attemptCode >= 3) {
      return res.status(429).json({
        error: "Percobaan OTP sudah mencapai batas maksimum.",
      });
    }

    if (tempRegistration.expiresAt < new Date()) {
      return res.status(400).json({
        error: "OTP sudah kedaluwarsa. Silakan minta OTP baru.",
      });
    }

    if (tempRegistration.code !== normalizedOtp) {
      const nextAttempt = tempRegistration.attemptCode + 1;

      await prisma.tempRegistration.update({
        where: {
          id: tempRegistration.id,
        },
        data: {
          attemptCode: nextAttempt,
          status: nextAttempt >= 3 ? "FAILED" : "PENDING",
        },
      });

      return res.status(400).json({
        error:
          nextAttempt >= 3
            ? "Percobaan OTP sudah mencapai batas maksimum."
            : "OTP salah.",
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { emailInstitusi: tempRegistration.email },
          { nim: tempRegistration.nim },
        ],
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      await prisma.tempRegistration.delete({
        where: {
          id: tempRegistration.id,
        },
      });

      return res.status(409).json({
        error: "Akun sudah terdaftar. Silakan langsung login.",
      });
    }

    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          nama: tempRegistration.nama,
          nim: tempRegistration.nim,
          emailInstitusi: tempRegistration.email,
          password: tempRegistration.password,
          isVerified: true,

          profile: {
            create: {},
          },
        },
      });

      await tx.tempRegistration.delete({
        where: {
          id: tempRegistration.id,
        },
      });

      return user;
    });

    return res.status(201).json({
      message: "Registrasi berhasil!",
      data: {
        id: createdUser.id,
        nama: createdUser.nama,
        nim: createdUser.nim,
        emailInstitusi: createdUser.emailInstitusi,
        isVerified: createdUser.isVerified,
      },
    });
  } catch (error) {
    console.error("Error di register:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan pada server.",
    });
  }
};

export const login = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { emailInstitusi, password } = req.body;

    if (
      typeof emailInstitusi !== "string" ||
      typeof password !== "string" ||
      !emailInstitusi.trim() ||
      password.length === 0
    ) {
      return res.status(400).json({
        error: "Email institusi dan password wajib dikirim.",
      });
    }

    const normalizedEmail = emailInstitusi.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: {
        emailInstitusi: normalizedEmail,
      },
    });

    if (!user || !user.password) {
      return res.status(401).json({
        error: "Email institusi atau password salah.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Email institusi atau password salah.",
      });
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error("JWT_SECRET belum dikonfigurasi.");

      return res.status(500).json({
        error: "Konfigurasi server tidak lengkap.",
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        nim: user.nim,
        email: user.emailInstitusi,
      },
      jwtSecret,
      {
        expiresIn: "1d",
      },
    );

    return res.status(200).json({
      message: "Login berhasil!",
      token,
      user: {
        nama: user.nama,
        nim: user.nim,
        email: user.emailInstitusi,
      },
    });
  } catch (error) {
    console.error("Error di login:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan pada server.",
    });
  }
};

export const changePassword = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  try {
    const userId = Number(req.user?.userId);
    const { currentPassword, newPassword, confirmPassword } = req.body ?? {};

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(401).json({
        error: "Identitas pengguna tidak valid.",
      });
    }

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      typeof confirmPassword !== "string"
    ) {
      return res.status(400).json({
        error:
          "Password lama, password baru, dan konfirmasi password wajib diisi.",
      });
    }

    const oldPassword = currentPassword.trim();
    const nextPassword = newPassword.trim();
    const confirmation = confirmPassword.trim();

    if (!oldPassword || !nextPassword || !confirmation) {
      return res.status(400).json({
        error: "Semua field password wajib diisi.",
      });
    }

    if (nextPassword.length < 8) {
      return res.status(400).json({
        error: "Password baru minimal 8 karakter.",
      });
    }

    if (nextPassword !== confirmation) {
      return res.status(400).json({
        error: "Konfirmasi password baru tidak cocok.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: "Pengguna tidak ditemukan.",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        error: "Akun ini belum memiliki password lokal yang dapat diubah.",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(oldPassword, user.password);

    if (!isPasswordCorrect) {
      return res.status(400).json({
        error: "Password lama tidak sesuai.",
      });
    }

    if (oldPassword === nextPassword) {
      return res.status(400).json({
        error: "Password baru harus berbeda dari password lama.",
      });
    }

    const hashedPassword = await bcrypt.hash(nextPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
      },
    });

    return res.status(200).json({
      message: "Password berhasil diubah.",
    });
  } catch (error) {
    console.error("Error changePassword:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan server saat mengubah password.",
    });
  }
};

export const getProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  try {
    const { nim } = req.user;

    const userProfile = await prisma.user.findFirst({
      where: {
        nim,
      },
      select: {
        id: true,
        nama: true,
        nim: true,
        emailInstitusi: true,
        profile: true,
      },
    });

    if (!userProfile) {
      return res.status(404).json({
        error: "Data pengguna tidak ditemukan.",
      });
    }

    return res.status(200).json({
      message: "Berhasil mengambil profil",
      data: userProfile,
    });
  } catch (error) {
    console.error("Error di getProfile:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan pada server.",
    });
  }
};

export const upsertProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  try {
    const userId = req.user.userId;
    const { jurusan, skill, minat, pengalamanLomba } = req.body;

    if (!jurusan) {
      return res.status(400).json({
        error: "Data jurusan wajib diisi.",
      });
    }

    const profile = await prisma.profile.upsert({
      where: {
        userId: Number(userId),
      },
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

    return res.status(500).json({
      error: "Terjadi kesalahan server saat menyimpan profil.",
    });
  }
};

export const getPublicProfile = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const targetUserId = Number(req.params.id);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({
        error: "ID pengguna tidak valid.",
      });
    }

    const userProfile = await prisma.user.findUnique({
      where: {
        id: targetUserId,
      },
      select: {
        nama: true,
        profile: true,
      },
    });

    if (!userProfile || !userProfile.profile) {
      return res.status(404).json({
        error: "Profil pengguna tidak ditemukan atau belum diisi.",
      });
    }

    return res.status(200).json({
      message: "Berhasil mengambil profil pengguna.",
      data: userProfile,
    });
  } catch (error) {
    console.error("Error di getPublicProfile:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan server saat mengambil profil.",
    });
  }
};

export const uploadCV = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  try {
    const userId = Number(req.user?.userId);
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        error: "File CV belum dikirim.",
      });
    }

    const profile = await prisma.profile.upsert({
      where: { userId },
      update: {
        cvPath: file.filename,
      },
      create: {
        userId,
        cvPath: file.filename,
      },
    });

    return res.status(200).json({
      message: "CV berhasil diunggah.",
      data: {
        cvUploaded: Boolean(profile.cvPath),
      },
    });
  } catch (error) {
    console.error("Error uploadCV:", error);

    return res.status(500).json({
      error: "Gagal mengunggah CV.",
    });
  }
};

export const downloadCV = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  try {
    const userId = Number(req.user?.userId);

    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { cvPath: true },
    });

    if (!profile?.cvPath) {
      return res.status(404).json({
        error: "CV belum tersedia.",
      });
    }

    // CV hanya dapat diakses pemilik akun melalui endpoint ini.
    if (path.basename(profile.cvPath) !== profile.cvPath) {
      return res.status(400).json({
        error: "Lokasi file tidak valid.",
      });
    }

    const filePath = path.resolve(
      process.cwd(),
      "uploads",
      "cv",
      profile.cvPath,
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: "File CV tidak ditemukan.",
      });
    }

    res.download(filePath, "CV.pdf", (error) => {
      if (error) {
        console.error("Error downloadCV:", error);

        if (!res.headersSent) {
          res.status(500).json({
            error: "Gagal mengunduh CV.",
          });
        }
      }
    });

    return res;
  } catch (error) {
    console.error("Error downloadCV:", error);

    return res.status(500).json({
      error: "Gagal mengunduh CV.",
    });
  }
};

export const deleteCV = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  try {
    const userId = Number(req.user?.userId);
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { cvPath: true },
    });

    if (!profile?.cvPath) {
      return res.status(404).json({
        error: "CV belum tersedia.",
      });
    }

    if (path.basename(profile.cvPath) !== profile.cvPath) {
      return res.status(400).json({
        error: "Lokasi file tidak valid.",
      });
    }

    const filePath = path.resolve(
      process.cwd(),
      "uploads",
      "cv",
      profile.cvPath,
    );

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.profile.update({
      where: { userId },
      data: { cvPath: null },
    });

    return res.status(200).json({
      message: "CV berhasil dihapus.",
    });
  } catch (error) {
    console.error("Error deleteCV:", error);

    return res.status(500).json({
      error: "Gagal menghapus CV.",
    });
  }
};

export const uploadProfileImage = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  try {
    const userId = Number(req.user?.userId);
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        error: "Gambar profil belum dikirim.",
      });
    }

    const imageUrl = `/uploads/profiles/${file.filename}`;

    const profile = await prisma.profile.upsert({
      where: { userId },
      update: {
        fotoProfilUrl: imageUrl,
      },
      create: {
        userId,
        fotoProfilUrl: imageUrl,
      },
    });

    return res.status(200).json({
      message: "Gambar profil berhasil diperbarui.",
      data: {
        fotoProfilUrl: profile.fotoProfilUrl,
      },
    });
  } catch (error) {
    console.error("Error uploadProfileImage:", error);

    return res.status(500).json({
      error: "Gagal memperbarui gambar profil.",
    });
  }
};
