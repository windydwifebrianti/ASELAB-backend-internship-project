import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Memperluas interface Request Express agar mengenali properti 'user'
export interface AuthRequest extends Request {
  user?: any;
}

export const verifyToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): any => {
  // 1. Ambil token dari header request
  const authHeader = req.headers.authorization;

  // Memisahkan kata "Bearer" dari string token yang sebenarnya
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ error: "Akses ditolak. Token tidak ditemukan!" });
  }

  // 2. Verifikasi keaslian token
  try {
    const secretKey = process.env.JWT_SECRET || "fallback_secret_key_123";
    const decoded = jwt.verify(token, secretKey);

    // 3. Simpan data payload (userId, nim, email) ke dalam req.user
    req.user = decoded;

    // Loloskan ke proses selanjutnya (controller)
    next();
  } catch (error) {
    return res
      .status(403)
      .json({ error: "Token tidak valid atau sudah kadaluarsa!" });
  }
};
