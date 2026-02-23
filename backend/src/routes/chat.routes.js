import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { getMyAssistant } from "../controllers/assistant.controller.js";
import {
  closeSession,
  createSession,
  getSession,
  listSessions,
  sendMessage,
} from "../controllers/chat.controller.js";

const router = Router();

router.get("/assistant", requireAuth, getMyAssistant);

router.post("/sessions", requireAuth, createSession);
router.get("/sessions", requireAuth, listSessions);
router.get("/sessions/:sessionId", requireAuth, getSession);
router.post("/sessions/:sessionId/messages", requireAuth, sendMessage);
router.post("/sessions/:sessionId/close", requireAuth, closeSession);

export default router;

