import express from "express";
import cors from "cors";
import { setupSwagger } from "./config/swagger";
import authRoutes from "./routes/authRoutes";
import teamRoutes from "./routes/teamRoutes";
import matchRoutes from "./routes/matchRoutes";
import competitionRoutes from "./routes/competitionRoutes";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/match", matchRoutes);
app.use("/api/competitions", competitionRoutes);

setupSwagger(app);

app.listen(PORT, () => {
  console.log(`[server]: Server sedang berjalan di http://localhost:${PORT}`);
});
