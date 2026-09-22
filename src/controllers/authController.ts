import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { cekStatusMahasiswa } from "../utils/nimfinder";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import crypto from "crypto";
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

const generateRegistrationToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

const getOtpExpiration = (): Date => {
  return new Date(Date.now() + 5 * 60 * 1000);
};

const isInstitutionEmail = (email: string): boolean => {
  return email.endsWith(".ac.id") || email.endsWith(".edu");
};

const sendRegistrationOtp = async (
  email: string,
  otp: string,
): Promise<void> => {
  await transporter.sendMail({
    from: `"Tim Matching System" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Kode Verifikasi OTP Anda",
    html: `<p>Kode OTP Anda adalah: <b>${otp}</b></p><p>Kode ini akan kedaluwarsa dalam 5 menit. Jangan bagikan kode ini kepada siapapun.</p>`,
  });
};

export const requestRegisterOtp = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { nama, nim, emailInstitusi, password } = req.body;

    if (!nama || !nim || !emailInstitusi || !password) {
      return res.status(400).json({
        error: "Nama, NIM, email institusi, dan password wajib diisi.",
      });
    }

    const normalizedNama = String(nama).trim();
    const normalizedNim = String(nim).trim();
    const normalizedEmail = String(emailInstitusi).trim().toLowerCase();
    const normalizedPassword = String(password);

    if (
      !normalizedNama ||
      !normalizedNim ||
      !normalizedEmail ||
      !normalizedPassword
    ) {
      return res.status(400).json({
        error: "Nama, NIM, email institusi, dan password wajib diisi.",
      });
    }

    if (!isInstitutionEmail(normalizedEmail)) {
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

    const existingTemp = await prisma.tempRegistration.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingTemp) {
      if (existingTemp.status === "FAILED") {
        return res.status(429).json({
          error: "Sesi registrasi sudah diblokir.",
        });
      }

      if (existingTemp.attemptCode >= 3) {
        return res.status(429).json({
          error: "Percobaan OTP sudah mencapai batas maksimum.",
        });
      }

      if (existingTemp.attemptResend >= 3) {
        return res.status(429).json({
          error: "Permintaan OTP sudah mencapai batas maksimum.",
        });
      }

      const kodeOtp = generateOtp();
      const expiresAt = getOtpExpiration();

      await prisma.tempRegistration.update({
        where: {
          id: existingTemp.id,
        },
        data: {
          code: kodeOtp,
          expiresAt,
          attemptResend: {
            increment: 1,
          },
        },
      });

      await sendRegistrationOtp(existingTemp.email, kodeOtp);

      return res.status(200).json({
        message: "OTP berhasil dikirim ulang ke email Anda.",
        token: existingTemp.token,
        isResend: true,
      });
    }

    let dataMahasiswa;

    try {
      dataMahasiswa = await cekStatusMahasiswa(normalizedNim);

      if (dataMahasiswa.total === 0) {
        return res.status(400).json({
          error: "NIM tidak ditemukan di sistem.",
        });
      }

      const mahasiswa = dataMahasiswa.results[0];

      if (!mahasiswa.status.toLowerCase().includes("aktif")) {
        return res.status(400).json({
          error: "Status Anda bukan Mahasiswa Aktif.",
        });
      }
    } catch (apiError: any) {
      return res.status(502).json({
        error: apiError.message || "Gagal memvalidasi data mahasiswa.",
      });
    }

    const kodeOtp = generateOtp();
    const expiresAt = getOtpExpiration();
    const registrationToken = generateRegistrationToken();
    const passwordHash = await bcrypt.hash(normalizedPassword, 10);

    await prisma.tempRegistration.create({
      data: {
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

    await sendRegistrationOtp(normalizedEmail, kodeOtp);

    return res.status(200).json({
      message: "OTP berhasil dikirim ke email Anda.",
      token: registrationToken,
      isResend: false,
      data: dataMahasiswa,
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
    });
  } catch (error) {
    console.error("Error requestOtp:", error);

    return res.status(500).json({
      error: "Gagal mengirim OTP.",
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
    const { emailInstitusi, otp } = req.body;

    if (!emailInstitusi || !otp) {
      return res.status(400).json({
        error: "Email institusi dan OTP wajib dikirim.",
      });
    }

    const normalizedEmail = String(emailInstitusi).trim().toLowerCase();
    const normalizedOtp = String(otp).trim();

    const validOtp = await prisma.otp.findFirst({
      where: {
        email: normalizedEmail,
        kodeOtp: normalizedOtp,
      },
    });

    if (!validOtp) {
      return res.status(400).json({
        error: "OTP salah.",
      });
    }

    if (validOtp.expiresAt < new Date()) {
      return res.status(400).json({
        error: "OTP kedaluwarsa.",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        emailInstitusi: normalizedEmail,
      },
    });

    if (!user) {
      return res.status(401).json({
        error: "Akun tidak ditemukan. Silakan register terlebih dahulu.",
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

    await prisma.otp.delete({
      where: {
        email: normalizedEmail,
      },
    });

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
