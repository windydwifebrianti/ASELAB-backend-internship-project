import { Router } from "express";
import { verifyToken } from "../middleware/authMiddleware";
import {
  getTeamRecommendations,
  swipeTeam,
  createJoinRequest,
  manageJoinRequest,
  getMyJoinRequests,
} from "../controllers/matchController";

const router = Router();

// Pencarian, Filter & Rekomendasi (FR-MTC-01, 02, 03, 04)
router.get("/teams", verifyToken, getTeamRecommendations);
// Catatan: Untuk Detail Tim (FR-MTC-05), gunakan endpoint GET /api/teams/:id yang sudah ada di teamRoutes.

// Swipe Card (FR-MTC-06)
router.post("/swipe", verifyToken, swipeTeam);

// Mengirim & Melihat Join Request (FR-MTC-07, 09)
router.post("/requests", verifyToken, createJoinRequest);
router.get("/requests", verifyToken, getMyJoinRequests);

// Mengelola Join Request oleh Leader (FR-MTC-08)
router.put("/requests/:id", verifyToken, manageJoinRequest);

export default router;
