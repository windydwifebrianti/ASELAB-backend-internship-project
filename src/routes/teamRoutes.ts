import { Router } from "express";
import { verifyToken } from "../middleware/authMiddleware";
import {
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamDetail,
} from "../controllers/teamController";

const router = Router();

router.post("/", verifyToken, createTeam);
router.put("/:id", verifyToken, updateTeam);
router.delete("/:id", verifyToken, deleteTeam);
router.get("/:id", verifyToken, getTeamDetail);

export default router;
