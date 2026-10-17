import multer from "multer";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const uploadRoot = path.resolve(process.cwd(), "uploads");
const cvDirectory = path.join(uploadRoot, "cv");
const profileDirectory = path.join(uploadRoot, "profiles");

fs.mkdirSync(cvDirectory, { recursive: true });
fs.mkdirSync(profileDirectory, { recursive: true });

const cvStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, cvDirectory);
  },
  filename: (_req, _file, cb) => {
    cb(null, `${randomUUID()}.pdf`);
  },
});

const profileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, profileDirectory);
  },
  filename: (_req, file, cb) => {
    const extensions: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
    };

    cb(null, `${randomUUID()}${extensions[file.mimetype]}`);
  },
});

export const uploadCvMiddleware = multer({
  storage: cvStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("CV harus berupa file PDF."));
    }

    cb(null, true);
  },
}).single("cv");

export const uploadProfileImageMiddleware = multer({
  storage: profileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Foto profil harus JPG, PNG, atau WEBP."));
    }

    cb(null, true);
  },
}).single("fotoProfil");
