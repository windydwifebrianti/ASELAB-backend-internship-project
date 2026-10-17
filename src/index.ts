import express from "express";
import cors from "cors";
import path from "path";
import { setupSwagger } from "./config/swagger";
import authRoutes from "./routes/authRoutes";
import teamRoutes from "./routes/teamRoutes";
import matchRoutes from "./routes/matchRoutes";
import competitionRoutes from "./routes/competitionRoutes";
import notificationRoutes from "./routes/notificationRoutes";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(
  "/uploads/profiles",
  express.static(path.resolve(process.cwd(), "uploads", "profiles")),
);

// Routes
app.use("/api/notifications", notificationRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/match", matchRoutes);
app.use("/api/competitions", competitionRoutes);

setupSwagger(app);

app.listen(PORT, () => {
  console.log(`[server]: Server sedang berjalan di http://localhost:${PORT}`);
});
