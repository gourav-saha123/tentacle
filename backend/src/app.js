import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import groupRoutes from "./routes/group.routes.js";
import feedRoutes from "./routes/feed.routes.js";
import memoryRoutes from "./routes/memory.routes.js";
import matchRoutes from "./routes/match.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";

const app = express();

app.use(helmet());
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 120),
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/memory", memoryRoutes);
app.use("/api/match", matchRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

