import dotenv from "dotenv";
import mongoose from "mongoose";
import { createServer } from "http";
import app from "./src/app.js";

dotenv.config();

const PORT = process.env.PORT || 4000;
const MONGODB_URL = process.env.MONGODB_URL;

if (!MONGODB_URL) {
  console.error("MONGODB_URL is not set in environment variables.");
  process.exit(1);
}

async function start() {
  try {
    await mongoose.connect(MONGODB_URL, {
      dbName: process.env.MONGODB_DB_NAME || "tentacle",
    });
    console.log("Connected to MongoDB");

    const server = createServer(app);
    server.listen(PORT, () => {
      console.log(`Tentacle backend listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server", err);
    process.exit(1);
  }
}

start();

