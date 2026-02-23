import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { listMyTopics } from "../controllers/memory.controller.js";

const router = Router();

router.get("/topics", requireAuth, listMyTopics);

export default router;

