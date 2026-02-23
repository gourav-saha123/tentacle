import jwt from "jsonwebtoken";

export function signAccessToken({ userId, email }) {
  const secret = process.env.SECRET_KEY;
  if (!secret) throw new Error("SECRET_KEY is not configured");

  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign({ email }, secret, { subject: String(userId), expiresIn });
}

