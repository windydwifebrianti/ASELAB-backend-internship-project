import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);

// Jalankan Server
app.listen(PORT, () => {
  console.log(`[server]: Server sedang berjalan di http://localhost:${PORT}`);
});
