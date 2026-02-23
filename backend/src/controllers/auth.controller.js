import User from "../models/user.model.js";
import Assistant from "../models/assistant.model.js";
import { hashPassword, verifyPassword } from "../services/password.service.js";
import { signAccessToken } from "../services/token.service.js";

function publicUser(u) {
  return { id: u._id, name: u.name, email: u.email, createdAt: u.createdAt };
}

export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email, password are required" });
    }

    const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: "Email already in use" });

    const user = await User.create({
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      passwordHash: await hashPassword(String(password)),
    });

    await Assistant.create({
      userId: user._id,
      name: "Tentacle",
      systemPrompt:
        process.env.TENTACLE_SYSTEM_PROMPT ||
        "You are Tentacle, an AI onboarding assistant. Ask short, focused questions to understand the user's skills, goals, projects, and collaboration intent. Keep responses concise. Prefer one question at a time.",
    });

    const token = signAccessToken({ userId: user._id, email: user.email });
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return res.status(201).json({ user: publicUser(user), token });
  } catch (err) {
    return next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await verifyPassword(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = signAccessToken({ userId: user._id, email: user.email });
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return res.json({ user: publicUser(user), token });
  } catch (err) {
    return next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ user: publicUser(user) });
  } catch (err) {
    return next(err);
  }
}

export async function logout(req, res) {
  res.clearCookie("token");
  res.json({ ok: true });
}

