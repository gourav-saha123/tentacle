import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import groupRoutes from "./routes/group.routes.js";
import feedRoutes from "./routes/feed.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";

const app = express();

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

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

