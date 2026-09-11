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

router.get("/teams", verifyToken, getTeamRecommendations);

router.post("/swipe", verifyToken, swipeTeam);

router.post("/requests", verifyToken, createJoinRequest);
router.get("/requests", verifyToken, getMyJoinRequests);

router.put("/requests/:id", verifyToken, manageJoinRequest);

export default router;
