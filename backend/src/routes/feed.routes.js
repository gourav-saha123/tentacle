import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { getFeed, getThread, openGroups } from "../controllers/feed.controller.js";

const router = Router();

router.get("/", requireAuth, getFeed);
router.get("/groups", requireAuth, openGroups);
router.get("/posts/:postId", requireAuth, getThread);

export default router;

