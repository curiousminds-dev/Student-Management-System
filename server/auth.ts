import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { SignJWT, jwtVerify } from "jose";
import { prisma, hashCredential, type SessionUser } from "./lib.js";
import { env } from "./env.js";

const jwtSecret = new TextEncoder().encode(env.JWT_SECRET);
const cookieName = env.NODE_ENV === "production" ? "__Host-ncs_refresh" : "ncs_refresh";

export async function accessToken(user: SessionUser, sessionId: string) {
  return new SignJWT({ ...user, sid: sessionId, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(jwtSecret);
}

export async function mfaChallengeToken(userId: string) {
  return new SignJWT({ type: "mfa" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(jwtSecret);
}

export async function verifyMfaChallenge(token: string) {
  const { payload } = await jwtVerify(token, jwtSecret);
  if (payload.type !== "mfa" || !payload.sub) throw new Error("Invalid MFA challenge");
  return payload.sub;
}

export async function createSession(
  request: FastifyRequest,
  reply: FastifyReply,
  user: SessionUser,
) {
  const refreshToken = randomBytes(48).toString("base64url");
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashCredential(refreshToken),
      userAgent: request.headers["user-agent"],
      ipAddress: request.ip,
      expiresAt: new Date(Date.now() + 30 * 86400000),
    },
  });
  reply.setCookie(cookieName, refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 30 * 86400,
  });
  return { token: await accessToken(user, session.id), sessionId: session.id };
}

export async function rotateSession(request: FastifyRequest, reply: FastifyReply) {
  const raw = request.cookies[cookieName];
  if (!raw) throw Object.assign(new Error("Refresh session required"), { statusCode: 401 });
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: hashCredential(raw) },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.active)
    throw Object.assign(new Error("Refresh session is invalid"), { statusCode: 401 });
  const next = randomBytes(48).toString("base64url");
  await prisma.session.update({
    where: { id: session.id },
    data: { refreshTokenHash: hashCredential(next), lastUsedAt: new Date() },
  });
  reply.setCookie(cookieName, next, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 30 * 86400,
  });
  const user = {
    id: session.user.id,
    schoolId: session.user.schoolId,
    campusId: session.user.campusId,
    role: session.user.role,
    email: session.user.email,
  };
  return { token: await accessToken(user, session.id) };
}

export async function revokeSession(request: FastifyRequest, reply: FastifyReply, all = false) {
  const sid = request.sessionUser?.sessionId;
  if (request.sessionUser)
    await prisma.session.updateMany({
      where: all ? { userId: request.sessionUser.id, revokedAt: null } : { id: sid },
      data: { revokedAt: new Date(), revokedReason: all ? "forced logout" : "logout" },
    });
  reply.clearCookie(cookieName, { path: "/" });
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const key = Buffer.from(env.MFA_ENCRYPTION_KEY, "hex");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function decryptSecret(value: string) {
  const input = Buffer.from(value, "base64url");
  const iv = input.subarray(0, 12);
  const tag = input.subarray(12, 28);
  const encrypted = input.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(env.MFA_ENCRYPTION_KEY, "hex"), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
