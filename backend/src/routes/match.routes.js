import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { recommendedUsers } from "../controllers/match.controller.js";

const router = Router();

router.get("/users", requireAuth, recommendedUsers);

export default router;

