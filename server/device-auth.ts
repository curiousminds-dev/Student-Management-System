import { randomBytes } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env.js";
import { hashCredential, prisma } from "./lib.js";

const key = new TextEncoder().encode(env.JWT_SECRET);

declare module "fastify" {
  interface FastifyRequest {
    authenticatedDeviceId?: string;
  }
}

export async function issueDeviceSession(publicId: string, secret: string) {
  const device = await prisma.device.findUnique({ where: { publicId } });
  if (!device || device.status !== "active" || device.secretHash !== hashCredential(secret))
    throw Object.assign(new Error("Invalid device credentials"), { statusCode: 401 });
  const sessionSecret = randomBytes(32).toString("base64url");
  const session = await prisma.deviceSession.create({
    data: {
      deviceId: device.id,
      tokenHash: hashCredential(sessionSecret),
      expiresAt: new Date(Date.now() + 12 * 3600000),
    },
  });
  const token = await new SignJWT({
    type: "device",
    did: device.id,
    dsv: device.secretVersion,
    nonce: sessionSecret,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.id)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(key);
  return { token, deviceId: device.id, expiresIn: 43200 };
}

export async function authenticateDevice(request: FastifyRequest) {
  const raw = request.headers["x-device-token"];
  if (typeof raw !== "string")
    throw Object.assign(new Error("Device authentication required"), { statusCode: 401 });
  try {
    const { payload } = await jwtVerify(raw, key);
    if (
      payload.type !== "device" ||
      !payload.sub ||
      typeof payload.did !== "string" ||
      typeof payload.nonce !== "string"
    )
      throw new Error();
    const session = await prisma.deviceSession.findUnique({
      where: { id: payload.sub },
      include: { device: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.device.status !== "active" ||
      session.device.secretVersion !== payload.dsv ||
      session.tokenHash !== hashCredential(payload.nonce)
    )
      throw new Error();
    request.authenticatedDeviceId = session.deviceId;
  } catch {
    throw Object.assign(new Error("Invalid or expired device session"), { statusCode: 401 });
  }
}

export function newDeviceSecret() {
  return `DEV-${randomBytes(32).toString("base64url")}`;
}
