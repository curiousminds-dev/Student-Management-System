/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { FastifyRequest } from "fastify";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
const secret = new TextEncoder().encode(
  process.env["JWT_SECRET"] ?? "development-only-secret-change-me-32",
);

export type SessionUser = {
  id: string;
  schoolId: string;
  campusId: string | null;
  role: string;
  email: string;
};

declare module "fastify" {
  interface FastifyRequest {
    sessionUser?: SessionUser;
  }
}

export async function issueToken(user: SessionUser): Promise<string> {
  return new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret);
}

export async function authenticate(request: FastifyRequest): Promise<SessionUser> {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  try {
    const { payload } = await jwtVerify(token, secret);
    const user = payload as unknown as SessionUser;
    request.sessionUser = user;
    return user;
  } catch {
    throw Object.assign(new Error("Invalid or expired session"), { statusCode: 401 });
  }
}

export function hashCredential(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function newCredential(): string {
  return `NCS-${randomBytes(18).toString("base64url")}`;
}

export async function audit(
  request: FastifyRequest,
  action: string,
  entityType: string,
  entityId?: string,
  before?: unknown,
  after?: unknown,
) {
  const user = request.sessionUser!;
  await prisma.auditEvent.create({
    data: {
      schoolId: user.schoolId,
      actorId: user.id,
      action,
      entityType,
      entityId,
      beforeJson: before === undefined ? null : JSON.stringify(before),
      afterJson: after === undefined ? null : JSON.stringify(after),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
      correlationId: request.id,
    },
  });
}

export function learnerDto(row: any) {
  const date = row.dateOfBirth instanceof Date ? row.dateOfBirth : new Date(row.dateOfBirth);
  return {
    ...row,
    fullName: `${row.firstName} ${row.lastName}`,
    dateOfBirth: date.toISOString().slice(0, 10),
    age: Math.floor((Date.now() - date.getTime()) / 31_557_600_000),
    todayStatus: row.attendance?.[0]?.status ?? "pending",
    attendanceRate: 0,
    qrStatus: row.credentials?.[0]?.status ?? "not_issued",
    qrSerial: row.credentials?.[0]?.serialPreview ?? "",
    guardian: { name: row.guardianName, relationship: "Guardian", phone: row.guardianPhone },
    emergencyContact: {
      name: row.guardianName,
      relationship: "Guardian",
      phone: row.guardianPhone,
    },
    house: "",
    dormitory: null,
    campusId: row.campusId,
    photoHue: [...`${row.firstName}${row.lastName}`].reduce((n, c) => n + c.charCodeAt(0), 0) % 360,
  };
}
