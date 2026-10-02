import { Router } from "express";
import { getCompetitions } from "../controllers/competitionController";
import { verifyToken } from "../middleware/authMiddleware";

const router = Router();

router.get("/", verifyToken, getCompetitions);

export default router;
