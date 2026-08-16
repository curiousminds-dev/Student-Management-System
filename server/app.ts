/* eslint-disable @typescript-eslint/no-explicit-any */
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import * as OTPAuth from "otpauth";
import { z, ZodError } from "zod";
import { audit, authenticate, hashCredential, learnerDto, newCredential, prisma } from "./lib.js";
import { hasPermission, permissionsFor, ROLE_PERMISSIONS } from "./permissions.js";
import {
  learnerSchema,
  loginSchema,
  messageSchema,
  occasionSchema,
  scanSchema,
  syncSchema,
} from "./schemas.js";
import {
  createSession,
  decryptSecret,
  encryptSecret,
  mfaChallengeToken,
  revokeSession,
  rotateSession,
  verifyMfaChallenge,
} from "./auth.js";
import { env } from "./env.js";
import { authenticateDevice, issueDeviceSession, newDeviceSecret } from "./device-auth.js";
import { deliverMessage } from "./communications.js";
import { registerMonitoring } from "./monitoring.js";

function requirePermission(permission: string) {
  return async (request: FastifyRequest) => {
    const user = await authenticate(request);
    if (!hasPermission(user.role, permission))
      throw Object.assign(new Error("Insufficient permission"), { statusCode: 403 });
  };
}

async function recordScan(
  request: FastifyRequest,
  input: ReturnType<typeof scanSchema.parse>,
  source = "online",
) {
  const user = request.sessionUser!;
  const credential = await prisma.qrCredential.findUnique({
    where: { serialHash: hashCredential(input.credential) },
    include: { learner: true },
  });
  if (!credential) return { outcome: "unknown_card", accepted: false };
  if (credential.status !== "active")
    return { outcome: "revoked_card", accepted: false, learner: learnerDto(credential.learner) };
  if (credential.learner.schoolId !== user.schoolId)
    return { outcome: "unknown_card", accepted: false };
  const occasion = await prisma.attendanceOccasion.findFirst({
    where: { id: input.occasionId, campus: { schoolId: user.schoolId } },
  });
  if (!occasion || !["active", "scheduled"].includes(occasion.status))
    return { outcome: "not_expected", accepted: false };
  try {
    const record = await prisma.attendanceRecord.create({
      data: {
        schoolId: user.schoolId,
        clientEventId: input.clientEventId,
        learnerId: credential.learnerId,
        occasionId: occasion.id,
        deviceId: input.deviceId,
        status: input.recordedAt > occasion.endsAt ? "late" : "present",
        outcome: input.recordedAt > occasion.endsAt ? "late" : "accepted",
        recordedAt: input.recordedAt,
        recordedById: user.id,
        source,
      },
    });
    await audit(request, "attendance.scan.recorded", "AttendanceRecord", record.id, undefined, {
      learnerId: record.learnerId,
      occasionId: record.occasionId,
      source,
    });
    return {
      outcome: record.outcome,
      accepted: true,
      record,
      learner: learnerDto(credential.learner),
    };
  } catch (error: any) {
    if (error?.code === "P2002")
      return { outcome: "duplicate", accepted: false, learner: learnerDto(credential.learner) };
    throw error;
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      env.NODE_ENV !== "test"
        ? {
            level: process.env["LOG_LEVEL"] ?? "info",
            redact: [
              "req.headers.authorization",
              "req.headers.cookie",
              "password",
              "token",
              "secret",
            ],
          }
        : false,
    genReqId: () => crypto.randomUUID(),
  });
  await app.register(cookie);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { global: false, max: 100, timeWindow: "1 minute" });
  await app.register(cors, { origin: env.WEB_ORIGIN.split(","), credentials: true });
  registerMonitoring(app);
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError)
      return reply.status(400).send({ error: "Validation failed", details: error.flatten() });
    const status = (error as any).statusCode ?? 500;
    return reply
      .status(status)
      .send({ error: status >= 500 ? "Internal server error" : error.message });
  });

  app.get("/", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    return {
      service: "student-management-api",
      health: "/health",
      readiness: "/health/ready",
    };
  });
  app.get("/robots.txt", async (_request, reply) => {
    reply.type("text/plain").header("Cache-Control", "no-store");
    return "User-agent: *\nDisallow: /api/\n";
  });
  app.get("/health", async () => ({ status: "ok", service: "student-management-api" }));
  const userDto = (user: any) => ({
    id: user.id,
    staffId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleName: user.role.replaceAll("_", " "),
    campusId: user.campusId,
    permissions: permissionsFor(user.role).includes("*") ? ["*"] : permissionsFor(user.role),
  });
  const sessionUser = (user: any) => ({
    id: user.id,
    schoolId: user.schoolId,
    campusId: user.campusId,
    role: user.role,
    email: user.email,
  });

  app.post(
    "/api/v1/auth/login",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes", ban: 3 } } },
    async (request, reply) => {
      const input = loginSchema.parse(request.body);
      const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
      if (user?.lockedUntil && user.lockedUntil > new Date())
        return reply.status(423).send({ error: "Account temporarily locked" });
      if (!user || !user.active || !(await bcrypt.compare(input.password, user.passwordHash))) {
        if (user) {
          const attempts = user.failedLoginAttempts + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: attempts,
              lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60000) : null,
            },
          });
        }
        return reply.status(401).send({ error: "Invalid email or password" });
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
      });
      if (user.mfaEnabled)
        return { mfaRequired: true, challengeToken: await mfaChallengeToken(user.id) };
      return { ...(await createSession(request, reply, sessionUser(user))), user: userDto(user) };
    },
  );
  app.post(
    "/api/v1/auth/mfa/verify",
    { config: { rateLimit: { max: 5, timeWindow: "5 minutes" } } },
    async (request, reply) => {
      const { challengeToken, code } = request.body as { challengeToken: string; code: string };
      const userId = await verifyMfaChallenge(challengeToken);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      if (!user.mfaSecretEncrypted)
        return reply.status(400).send({ error: "MFA is not configured" });
      const totp = new OTPAuth.TOTP({
        issuer: "Nile Crest SAPWMS",
        label: user.email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(decryptSecret(user.mfaSecretEncrypted)),
      });
      if (totp.validate({ token: code, window: 1 }) === null)
        return reply.status(401).send({ error: "Invalid verification code" });
      return { ...(await createSession(request, reply, sessionUser(user))), user: userDto(user) };
    },
  );
  app.post("/api/v1/auth/refresh", async (request, reply) => rotateSession(request, reply));
  app.post("/api/v1/auth/logout", { preHandler: authenticate }, async (request, reply) => {
    await revokeSession(request, reply);
    return { ok: true };
  });
  app.post("/api/v1/auth/logout-all", { preHandler: authenticate }, async (request, reply) => {
    await revokeSession(request, reply, true);
    return { ok: true };
  });
  app.post(
    "/api/v1/auth/password-reset/request",
    { config: { rateLimit: { max: 3, timeWindow: "1 hour" } } },
    async (request) => {
      const email = String((request.body as any)?.email ?? "").toLowerCase();
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        const raw = newCredential();
        await prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: hashCredential(raw),
            expiresAt: new Date(Date.now() + 30 * 60000),
          },
        });
        await prisma.message.create({
          data: {
            schoolId: user.schoolId,
            senderId: user.id,
            channel: "email",
            recipients: JSON.stringify([user.email]),
            subject: "Reset your password",
            body: `Use this one-time password reset token: ${raw}`,
          },
        });
      }
      return { ok: true };
    },
  );
  app.post("/api/v1/auth/password-reset/confirm", async (request, reply) => {
    const { token, password } = request.body as { token: string; password: string };
    if (!password || password.length < 12)
      return reply.status(400).send({ error: "Password must contain at least 12 characters" });
    const reset = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashCredential(token) },
    });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date())
      return reply.status(400).send({ error: "Reset token is invalid or expired" });
    await prisma.$transaction([
      prisma.user.update({
        where: { id: reset.userId },
        data: {
          passwordHash: await bcrypt.hash(password, 12),
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      prisma.session.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "password reset" },
      }),
    ]);
    return { ok: true };
  });
  app.post("/api/v1/auth/mfa/setup", { preHandler: authenticate }, async (request) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.sessionUser!.id } });
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({ issuer: "Nile Crest SAPWMS", label: user.email, secret });
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaSecretEncrypted: encryptSecret(secret.base32), mfaEnabled: false },
    });
    return { uri: totp.toString(), qrDataUrl: await QRCode.toDataURL(totp.toString()) };
  });
  app.post("/api/v1/auth/mfa/enable", { preHandler: authenticate }, async (request, reply) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.sessionUser!.id } });
    if (!user.mfaSecretEncrypted) return reply.status(400).send({ error: "Start MFA setup first" });
    const totp = new OTPAuth.TOTP({
      issuer: "Nile Crest SAPWMS",
      label: user.email,
      secret: OTPAuth.Secret.fromBase32(decryptSecret(user.mfaSecretEncrypted)),
    });
    if (totp.validate({ token: String((request.body as any).code), window: 1 }) === null)
      return reply.status(400).send({ error: "Invalid verification code" });
    await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true } });
    return { ok: true };
  });
  app.get("/api/v1/auth/me", { preHandler: authenticate }, async (request) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.sessionUser!.id } });
    return {
      id: user.id,
      staffId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleName: user.role.replaceAll("_", " "),
      campusId: user.campusId,
      permissions: permissionsFor(user.role),
    };
  });

  app.get(
    "/api/v1/learners",
    { preHandler: requirePermission("learners.view") },
    async (request) => {
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, Number(q["page"] ?? 1));
      const pageSize = Math.min(100, Math.max(1, Number(q["pageSize"] ?? 20)));
      const where: any = { schoolId: request.sessionUser!.schoolId };
      if (q["search"])
        where.OR = [
          { firstName: { contains: q["search"] } },
          { lastName: { contains: q["search"] } },
          { admissionNumber: { contains: q["search"] } },
        ];
      if (q["className"] && q["className"] !== "all") where.className = q["className"];
      const [rows, total] = await prisma.$transaction([
        prisma.learner.findMany({
          where,
          include: {
            credentials: { where: { status: "active" }, take: 1 },
            attendance: { orderBy: { recordedAt: "desc" }, take: 1 },
          },
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { lastName: "asc" },
        }),
        prisma.learner.count({ where }),
      ]);
      return { data: rows.map(learnerDto), total, page, pageSize };
    },
  );

  const observationInput = z.object({
    learnerId: z.string(),
    category: z.string().min(2),
    severity: z.enum(["low", "medium", "high"]),
    summary: z.string().min(3),
    details: z.string().min(3),
    occurredAt: z.coerce.date(),
    reviewAt: z.coerce.date().optional(),
  });
  app.get(
    "/api/v1/welfare/observations",
    { preHandler: requirePermission("observations.view") },
    async (request) =>
      prisma.welfareObservation.findMany({
        where: { schoolId: request.sessionUser!.schoolId },
        include: { learner: true, reporter: { select: { name: true } } },
        orderBy: { occurredAt: "desc" },
      }),
  );
  app.post(
    "/api/v1/welfare/observations",
    { preHandler: requirePermission("observations.create") },
    async (request, reply) => {
      const input = observationInput.parse(request.body);
      const learner = await prisma.learner.findFirstOrThrow({
        where: { id: input.learnerId, schoolId: request.sessionUser!.schoolId },
      });
      const row = await prisma.welfareObservation.create({
        data: { ...input, schoolId: learner.schoolId, reporterId: request.sessionUser!.id },
      });
      await audit(request, "welfare.observation.created", "WelfareObservation", row.id);
      return reply.status(201).send(row);
    },
  );
  app.patch(
    "/api/v1/welfare/observations/:id",
    { preHandler: requirePermission("welfare.manage") },
    async (request) => {
      const id = (request.params as any).id;
      const before = await prisma.welfareObservation.findFirstOrThrow({
        where: { id, schoolId: request.sessionUser!.schoolId },
      });
      const data = z
        .object({
          status: z.enum(["open", "reviewing", "closed"]),
          reviewAt: z.coerce.date().optional(),
        })
        .parse(request.body);
      const row = await prisma.welfareObservation.update({
        where: { id },
        data: { ...data, closedAt: data.status === "closed" ? new Date() : null },
      });
      await audit(request, "welfare.observation.updated", "WelfareObservation", id, before, row);
      return row;
    },
  );

  const caseInput = z.object({
    learnerId: z.string(),
    title: z.string().min(3),
    allegation: z.string().min(3),
  });
  app.get(
    "/api/v1/conduct/cases",
    { preHandler: requirePermission("cases.view") },
    async (request) =>
      prisma.conductCase.findMany({
        where: { schoolId: request.sessionUser!.schoolId },
        include: { learner: true, owner: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
  );
  app.post(
    "/api/v1/conduct/cases",
    { preHandler: requirePermission("cases.manage") },
    async (request, reply) => {
      const input = caseInput.parse(request.body);
      const learner = await prisma.learner.findFirstOrThrow({
        where: { id: input.learnerId, schoolId: request.sessionUser!.schoolId },
      });
      const row = await prisma.conductCase.create({
        data: {
          ...input,
          schoolId: learner.schoolId,
          ownerId: request.sessionUser!.id,
          reference: `CASE-${Date.now().toString(36).toUpperCase()}`,
        },
      });
      await audit(request, "conduct.case.created", "ConductCase", row.id);
      return reply.status(201).send(row);
    },
  );
  app.post(
    "/api/v1/conduct/cases/:id/decision",
    { preHandler: requirePermission("cases.manage") },
    async (request) => {
      const id = (request.params as any).id;
      const before = await prisma.conductCase.findFirstOrThrow({
        where: { id, schoolId: request.sessionUser!.schoolId },
      });
      const data = z
        .object({
          finding: z.enum(["substantiated", "not_substantiated", "inconclusive"]),
          rationale: z.string().min(10),
        })
        .parse(request.body);
      const row = await prisma.conductCase.update({
        where: { id },
        data: { ...data, status: "closed", closedAt: new Date() },
      });
      await audit(request, "conduct.case.decided", "ConductCase", id, before, row);
      return row;
    },
  );

  const assessmentInput = z.object({
    name: z.string().min(2),
    subject: z.string().min(2),
    className: z.string().min(2),
    term: z.string().min(2),
    maximumMark: z.number().int().positive(),
    assessmentDate: z.coerce.date(),
  });
  app.get(
    "/api/v1/academics/assessments",
    { preHandler: requirePermission("academics.view") },
    async (request) =>
      prisma.assessment.findMany({
        where: { schoolId: request.sessionUser!.schoolId },
        include: { _count: { select: { marks: true } } },
        orderBy: { assessmentDate: "desc" },
      }),
  );
  app.get(
    "/api/v1/academics/assessments/:id/marks",
    { preHandler: requirePermission("academics.view") },
    async (request) => {
      const id = (request.params as any).id;
      const assessment = await prisma.assessment.findFirstOrThrow({
        where: { id, schoolId: request.sessionUser!.schoolId },
      });
      const learners = await prisma.learner.findMany({
        where: {
          schoolId: request.sessionUser!.schoolId,
          className: assessment.className,
          status: "active",
        },
        include: { marks: { where: { assessmentId: id }, take: 1 } },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      });
      return {
        assessmentId: assessment.id,
        assessmentName: assessment.name,
        subject: assessment.subject,
        className: assessment.className,
        maxMark: assessment.maximumMark,
        cells: learners.map((learner) => ({
          learnerId: learner.id,
          learnerName: `${learner.firstName} ${learner.lastName}`,
          admissionNumber: learner.admissionNumber,
          mark:
            learner.marks[0]?.score === null || learner.marks[0]?.score === undefined
              ? null
              : Number(learner.marks[0].score),
          comment: learner.marks[0]?.comment ?? "",
        })),
      };
    },
  );
  app.post(
    "/api/v1/academics/assessments",
    { preHandler: requirePermission("academics.manage") },
    async (request, reply) => {
      const data = assessmentInput.parse(request.body);
      const row = await prisma.assessment.create({
        data: {
          ...data,
          schoolId: request.sessionUser!.schoolId,
          createdById: request.sessionUser!.id,
        },
      });
      await audit(request, "assessment.created", "Assessment", row.id);
      return reply.status(201).send(row);
    },
  );
  app.put(
    "/api/v1/academics/assessments/:id/marks",
    { preHandler: requirePermission("academics.manage") },
    async (request) => {
      const id = (request.params as any).id;
      const assessment = await prisma.assessment.findFirstOrThrow({
        where: { id, schoolId: request.sessionUser!.schoolId },
      });
      const marks = z
        .array(
          z.object({
            learnerId: z.string(),
            score: z.number().min(0).nullable(),
            comment: z.string().optional(),
          }),
        )
        .max(500)
        .parse(request.body);
      const learnerIds = [...new Set(marks.map((mark) => mark.learnerId))];
      if (learnerIds.length !== marks.length)
        throw Object.assign(new Error("Each learner may appear only once"), { statusCode: 400 });
      const validLearners = await prisma.learner.count({
        where: {
          id: { in: learnerIds },
          schoolId: request.sessionUser!.schoolId,
          className: assessment.className,
          status: "active",
        },
      });
      if (validLearners !== learnerIds.length)
        throw Object.assign(new Error("One or more learners are not active in this class"), {
          statusCode: 400,
        });
      for (const mark of marks) {
        if (mark.score !== null && mark.score > assessment.maximumMark)
          throw Object.assign(new Error("Mark exceeds assessment maximum"), { statusCode: 400 });
      }
      await prisma.$transaction(
        marks.map((mark) =>
          prisma.mark.upsert({
            where: { assessmentId_learnerId: { assessmentId: id, learnerId: mark.learnerId } },
            create: { assessmentId: id, ...mark },
            update: mark,
          }),
        ),
      );
      await audit(request, "assessment.marks.saved", "Assessment", id, undefined, {
        count: marks.length,
      });
      return { saved: marks.length };
    },
  );
  app.post(
    "/api/v1/academics/assessments/:id/publish",
    { preHandler: requirePermission("academics.manage") },
    async (request) => {
      const id = (request.params as any).id;
      const before = await prisma.assessment.findFirstOrThrow({
        where: { id, schoolId: request.sessionUser!.schoolId },
      });
      const [expected, completed] = await Promise.all([
        prisma.learner.count({
          where: {
            schoolId: request.sessionUser!.schoolId,
            className: before.className,
            status: "active",
          },
        }),
        prisma.mark.count({ where: { assessmentId: id, score: { not: null } } }),
      ]);
      if (expected === 0 || completed !== expected)
        throw Object.assign(
          new Error(`Complete all marks before publishing (${completed}/${expected} entered)`),
          { statusCode: 400 },
        );
      const row = await prisma.assessment.update({
        where: { id },
        data: { publishedAt: new Date() },
      });
      await audit(request, "assessment.published", "Assessment", id, before, row);
      return row;
    },
  );

  app.get("/api/v1/staff", { preHandler: requirePermission("staff.manage") }, async (request) =>
    prisma.user.findMany({
      where: { schoolId: request.sessionUser!.schoolId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        lastLoginAt: true,
        mfaEnabled: true,
        lockedUntil: true,
        createdAt: true,
      },
    }),
  );
  app.get("/api/v1/roles", { preHandler: requirePermission("staff.manage") }, async () =>
    Object.entries(ROLE_PERMISSIONS).map(([key, permissions]) => ({
      key,
      name: key.replaceAll("_", " "),
      permissions,
    })),
  );
  app.get(
    "/api/v1/notifications",
    { preHandler: requirePermission("communication.view") },
    async (request) =>
      prisma.message.findMany({
        where: { schoolId: request.sessionUser!.schoolId },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
  );
  app.post(
    "/api/v1/staff",
    { preHandler: requirePermission("staff.manage") },
    async (request, reply) => {
      const data = z
        .object({
          name: z.string().min(2),
          email: z.string().email(),
          role: z.string().min(2),
          password: z.string().min(12),
          campusId: z.string().optional(),
        })
        .parse(request.body);
      const row = await prisma.user.create({
        data: {
          schoolId: request.sessionUser!.schoolId,
          campusId: data.campusId ?? request.sessionUser!.campusId,
          name: data.name,
          email: data.email.toLowerCase(),
          role: data.role,
          passwordHash: await bcrypt.hash(data.password, 12),
        },
      });
      await audit(request, "staff.created", "User", row.id);
      return reply.status(201).send(userDto(row));
    },
  );
  app.patch(
    "/api/v1/staff/:id",
    { preHandler: requirePermission("staff.manage") },
    async (request) => {
      const id = (request.params as any).id;
      const before = await prisma.user.findFirstOrThrow({
        where: { id, schoolId: request.sessionUser!.schoolId },
      });
      const data = z
        .object({ role: z.string().optional(), active: z.boolean().optional() })
        .parse(request.body);
      const row = await prisma.user.update({ where: { id }, data });
      if (data.active === false || data.role)
        await prisma.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: "staff access changed" },
        });
      await audit(request, "staff.updated", "User", id, before, row);
      return userDto(row);
    },
  );

  app.get("/api/v1/settings", { preHandler: authenticate }, async (request) => ({
    school: await prisma.school.findUniqueOrThrow({
      where: { id: request.sessionUser!.schoolId },
      include: { campuses: true },
    }),
    settings: await prisma.schoolSetting.findMany({
      where: { schoolId: request.sessionUser!.schoolId, sensitive: false },
    }),
  }));
  app.put(
    "/api/v1/settings/:key",
    { preHandler: requirePermission("settings.manage") },
    async (request) => {
      const key = (request.params as any).key;
      const data = z
        .object({ value: z.unknown(), sensitive: z.boolean().default(false) })
        .parse(request.body);
      const row = await prisma.schoolSetting.upsert({
        where: { schoolId_key: { schoolId: request.sessionUser!.schoolId, key } },
        create: {
          schoolId: request.sessionUser!.schoolId,
          key,
          valueJson: data.value as any,
          sensitive: data.sensitive,
        },
        update: { valueJson: data.value as any, sensitive: data.sensitive },
      });
      await audit(request, "settings.updated", "SchoolSetting", row.id, undefined, {
        key,
        sensitive: data.sensitive,
      });
      return row;
    },
  );
  app.get(
    "/api/v1/learners/:id",
    { preHandler: requirePermission("learners.view") },
    async (request, reply) => {
      const row = await prisma.learner.findFirst({
        where: { id: (request.params as any).id, schoolId: request.sessionUser!.schoolId },
        include: {
          credentials: { orderBy: { issuedAt: "desc" } },
          attendance: { orderBy: { recordedAt: "desc" }, take: 1 },
        },
      });
      return row ? learnerDto(row) : reply.status(404).send({ error: "Learner not found" });
    },
  );
  app.post(
    "/api/v1/learners",
    { preHandler: requirePermission("learners.manage") },
    async (request, reply) => {
      const input = learnerSchema.parse(request.body);
      const user = request.sessionUser!;
      const learner = await prisma.learner.create({
        data: { ...input, schoolId: user.schoolId, campusId: input.campusId ?? user.campusId! },
      });
      await audit(request, "learner.created", "Learner", learner.id, undefined, learner);
      return reply.status(201).send(learnerDto(learner));
    },
  );
  app.patch(
    "/api/v1/learners/:id",
    { preHandler: requirePermission("learners.manage") },
    async (request) => {
      const id = (request.params as any).id;
      const before = await prisma.learner.findFirstOrThrow({
        where: { id, schoolId: request.sessionUser!.schoolId },
      });
      const input = learnerSchema.partial().parse(request.body);
      const after = await prisma.learner.update({ where: { id }, data: input });
      await audit(request, "learner.updated", "Learner", id, before, after);
      return learnerDto(after);
    },
  );
  app.post(
    "/api/v1/learners/:id/qr-credentials",
    { preHandler: requirePermission("learners.manage") },
    async (request, reply) => {
      const learnerId = (request.params as any).id;
      const learner = await prisma.learner.findFirst({
        where: { id: learnerId, schoolId: request.sessionUser!.schoolId },
      });
      if (!learner) return reply.status(404).send({ error: "Learner not found" });
      const raw = newCredential();
      const credential = await prisma.$transaction(async (tx) => {
        await tx.qrCredential.updateMany({
          where: { learnerId, status: "active" },
          data: {
            status: "replaced",
            revokedAt: new Date(),
            revokedReason: "Replacement credential issued",
          },
        });
        return tx.qrCredential.create({
          data: {
            learnerId,
            serialHash: hashCredential(raw),
            serialPreview: `${raw.slice(0, 8)}…${raw.slice(-5)}`,
            issuedById: request.sessionUser!.id,
          },
        });
      });
      await audit(request, "qr.issued", "QrCredential", credential.id, undefined, { learnerId });
      return reply
        .status(201)
        .send({ ...credential, credential: raw, qrDataUrl: await QRCode.toDataURL(raw) });
    },
  );
  app.post(
    "/api/v1/qr-credentials/:id/revoke",
    { preHandler: requirePermission("learners.manage") },
    async (request) => {
      const id = (request.params as any).id;
      const reason = String((request.body as any)?.reason ?? "Revoked by administrator");
      const current = await prisma.qrCredential.findFirstOrThrow({
        where: { id, learner: { schoolId: request.sessionUser!.schoolId } },
      });
      const result = await prisma.qrCredential.update({
        where: { id },
        data: { status: "revoked", revokedAt: new Date(), revokedReason: reason },
      });
      await audit(request, "qr.revoked", "QrCredential", id, current, result);
      return result;
    },
  );

  app.get(
    "/api/v1/attendance/occasions",
    { preHandler: requirePermission("attendance.view") },
    async (request) =>
      prisma.attendanceOccasion
        .findMany({
          where: { campus: { schoolId: request.sessionUser!.schoolId } },
          include: { _count: { select: { records: true } } },
          orderBy: { startsAt: "desc" },
        })
        .then((rows) =>
          rows.map((o) => ({
            ...o,
            date: o.startsAt.toISOString().slice(0, 10),
            startTime: o.startsAt.toISOString().slice(11, 16),
            endTime: o.endsAt.toISOString().slice(11, 16),
            scanned: o._count.records,
            responsibleStaff: o.responsibleStaffId,
          })),
        ),
  );
  app.post(
    "/api/v1/attendance/occasions",
    { preHandler: requirePermission("occasions.manage") },
    async (request, reply) => {
      const input = occasionSchema.parse(request.body);
      const row = await prisma.attendanceOccasion.create({
        data: { ...input, campusId: request.sessionUser!.campusId! },
      });
      await audit(request, "occasion.created", "AttendanceOccasion", row.id, undefined, row);
      return reply.status(201).send(row);
    },
  );
  app.patch(
    "/api/v1/attendance/occasions/:id/status",
    { preHandler: requirePermission("occasions.manage") },
    async (request) => {
      const id = (request.params as any).id;
      const status = String((request.body as any).status);
      if (!["scheduled", "active", "paused", "closed", "reconciled"].includes(status))
        throw Object.assign(new Error("Invalid status"), { statusCode: 400 });
      const before = await prisma.attendanceOccasion.findFirstOrThrow({
        where: { id, campus: { schoolId: request.sessionUser!.schoolId } },
      });
      const row = await prisma.attendanceOccasion.update({ where: { id }, data: { status } });
      await audit(request, "occasion.status.changed", "AttendanceOccasion", id, before, row);
      return row;
    },
  );
  app.post(
    "/api/v1/attendance/scan",
    { preHandler: [requirePermission("attendance.record"), authenticateDevice] },
    async (request) => {
      const input = scanSchema.parse(request.body);
      if (input.deviceId !== request.authenticatedDeviceId)
        throw Object.assign(new Error("Device identity mismatch"), { statusCode: 403 });
      return recordScan(request, input);
    },
  );
  app.post(
    "/api/v1/attendance/sync",
    { preHandler: [requirePermission("attendance.record"), authenticateDevice] },
    async (request) => {
      const input = syncSchema.parse(request.body);
      const user = request.sessionUser!;
      const existing = await prisma.syncBatch.findFirst({
        where: { clientBatchId: input.clientBatchId, device: { schoolId: user.schoolId } },
      });
      if (existing) return { idempotent: true, ...existing };
      const results = [];
      for (const event of input.events)
        results.push(await recordScan(request, event, "offline_sync"));
      const deviceId = input.events[0]?.deviceId;
      if (!deviceId)
        throw Object.assign(new Error("deviceId is required for sync"), { statusCode: 400 });
      if (deviceId !== request.authenticatedDeviceId)
        throw Object.assign(new Error("Device identity mismatch"), { statusCode: 403 });
      const batch = await prisma.syncBatch.create({
        data: {
          deviceId,
          clientBatchId: input.clientBatchId,
          received: results.length,
          accepted: results.filter((x) => x.accepted).length,
          rejected: results.filter((x) => !x.accepted).length,
        },
      });
      await prisma.device.update({ where: { id: deviceId }, data: { lastSyncAt: new Date() } });
      await audit(request, "offline.batch.synced", "SyncBatch", batch.id, undefined, batch);
      return { ...batch, results };
    },
  );
  app.get(
    "/api/v1/attendance",
    { preHandler: requirePermission("attendance.view") },
    async (request) => {
      const rows = await prisma.attendanceRecord.findMany({
        where: { schoolId: request.sessionUser!.schoolId },
        include: { learner: true, occasion: true, device: true },
        orderBy: { recordedAt: "desc" },
        take: 500,
      });
      return rows.map((r) => ({
        ...r,
        learnerName: `${r.learner.firstName} ${r.learner.lastName}`,
        admissionNumber: r.learner.admissionNumber,
        className: r.learner.className,
        stream: r.learner.stream,
        occasionName: r.occasion.name,
        scanTime: r.recordedAt.toISOString(),
        date: r.recordedAt.toISOString().slice(0, 10),
        deviceName: r.device?.name ?? null,
        recordedBy: r.recordedById,
        photoHue: 180,
      }));
    },
  );
  app.get(
    "/api/v1/attendance/scans",
    { preHandler: requirePermission("attendance.view") },
    async (request) =>
      prisma.attendanceRecord
        .findMany({
          where: { schoolId: request.sessionUser!.schoolId },
          include: { learner: true, occasion: true, device: true },
          orderBy: { recordedAt: "desc" },
          take: 100,
        })
        .then((rows) =>
          rows.map((r) => ({
            ...r,
            learnerName: `${r.learner.firstName} ${r.learner.lastName}`,
            admissionNumber: r.learner.admissionNumber,
            className: r.learner.className,
            occasionName: r.occasion.name,
            scanTime: r.recordedAt.toISOString(),
            deviceName: r.device?.name ?? "Web scanner",
          })),
        ),
  );

  app.get("/api/v1/devices", { preHandler: requirePermission("devices.view") }, async (request) =>
    prisma.device
      .findMany({ where: { schoolId: request.sessionUser!.schoolId }, orderBy: { name: "asc" } })
      .then((rows) =>
        rows.map((d) => ({
          ...d,
          assignedTo: null,
          assignedRole: "Security Officer",
          battery: null,
          pendingRecords: 0,
          conflicts: 0,
          lastSync: d.lastSyncAt?.toISOString() ?? null,
          registeredOn: d.createdAt.toISOString(),
          status: d.status === "active" ? "synced" : "disabled",
        })),
      ),
  );
  app.post(
    "/api/v1/devices/auth",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (request) => {
      const { publicId, secret } = request.body as { publicId: string; secret: string };
      return issueDeviceSession(publicId, secret);
    },
  );
  app.post(
    "/api/v1/devices",
    { preHandler: requirePermission("devices.manage") },
    async (request, reply) => {
      const body = request.body as { name: string; publicId: string; location: string };
      const secret = newDeviceSecret();
      const device = await prisma.device.create({
        data: {
          schoolId: request.sessionUser!.schoolId,
          name: body.name,
          publicId: body.publicId,
          location: body.location,
          secretHash: hashCredential(secret),
        },
      });
      await audit(request, "device.registered", "Device", device.id);
      return reply.status(201).send({ device, secret });
    },
  );
  app.post(
    "/api/v1/devices/:id/rotate-secret",
    { preHandler: requirePermission("devices.manage") },
    async (request) => {
      const id = (request.params as any).id;
      const current = await prisma.device.findFirstOrThrow({
        where: { id, schoolId: request.sessionUser!.schoolId },
      });
      const secret = newDeviceSecret();
      const device = await prisma.$transaction(async (tx) => {
        await tx.deviceSession.updateMany({
          where: { deviceId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return tx.device.update({
          where: { id },
          data: {
            secretHash: hashCredential(secret),
            secretVersion: { increment: 1 },
            secretRotatedAt: new Date(),
          },
        });
      });
      await audit(
        request,
        "device.secret.rotated",
        "Device",
        id,
        { secretVersion: current.secretVersion },
        { secretVersion: device.secretVersion },
      );
      return { device, secret };
    },
  );
  app.get(
    "/api/v1/attendance/sync",
    { preHandler: requirePermission("devices.view") },
    async (request) =>
      prisma.syncBatch
        .findMany({
          where: { device: { schoolId: request.sessionUser!.schoolId } },
          include: { device: true },
          orderBy: { syncedAt: "desc" },
          take: 100,
        })
        .then((rows) =>
          rows.map((r) => ({
            id: r.id,
            deviceId: r.deviceId,
            deviceName: r.device.name,
            syncedAt: r.syncedAt.toISOString(),
            recordsUploaded: r.accepted,
            conflicts: r.rejected,
            status: r.rejected ? "conflict" : "completed",
          })),
        ),
  );

  app.post(
    "/api/v1/communications",
    { preHandler: requirePermission("communication.view") },
    async (request, reply) => {
      const input = messageSchema.parse(request.body);
      const row = await prisma.message.create({
        data: {
          schoolId: request.sessionUser!.schoolId,
          senderId: request.sessionUser!.id,
          ...input,
          recipients: JSON.stringify(input.recipients),
        },
      });
      await audit(request, "communication.queued", "Message", row.id, undefined, {
        channel: row.channel,
        recipientCount: input.recipients.length,
      });
      void deliverMessage(row.id).catch((error) =>
        request.log.error({ err: error, messageId: row.id }, "communication delivery failed"),
      );
      return reply.status(202).send(row);
    },
  );
  app.post(
    "/api/v1/communications/:id/retry",
    { preHandler: requirePermission("communication.view") },
    async (request) => {
      const id = (request.params as any).id;
      const message = await prisma.message.findFirstOrThrow({
        where: { id, schoolId: request.sessionUser!.schoolId },
      });
      return deliverMessage(message.id);
    },
  );
  app.get("/api/v1/audit-logs", { preHandler: requirePermission("audit.view") }, async (request) =>
    prisma.auditEvent.findMany({
      where: { schoolId: request.sessionUser!.schoolId },
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  );
  app.get(
    "/api/v1/reports/attendance-summary",
    { preHandler: requirePermission("reports.view") },
    async (request) => {
      const rows = await prisma.attendanceRecord.groupBy({
        by: ["status"],
        where: { schoolId: request.sessionUser!.schoolId },
        _count: true,
      });
      return {
        generatedAt: new Date(),
        totals: Object.fromEntries(rows.map((r) => [r.status, r._count])),
      };
    },
  );
  app.get(
    "/api/v1/reports/attendance.csv",
    { preHandler: requirePermission("reports.view") },
    async (request, reply) => {
      const rows = await prisma.attendanceRecord.findMany({
        where: { schoolId: request.sessionUser!.schoolId },
        include: { learner: true, occasion: true },
        orderBy: { recordedAt: "desc" },
      });
      const csv = [
        "admission_number,learner,occasion,status,recorded_at",
        ...rows.map((r) =>
          [
            r.learner.admissionNumber,
            `"${r.learner.firstName} ${r.learner.lastName}"`,
            `"${r.occasion.name}"`,
            r.status,
            r.recordedAt.toISOString(),
          ].join(","),
        ),
      ].join("\n");
      return reply.type("text/csv").send(csv);
    },
  );

  app.get(
    "/api/v1/dashboard",
    { preHandler: requirePermission("dashboard.view") },
    async (request) => {
      const schoolId = request.sessionUser!.schoolId;
      const [learners, attendance, openOccasions, auditEvents] = await prisma.$transaction([
        prisma.learner.count({ where: { schoolId, status: "active" } }),
        prisma.attendanceRecord.groupBy({
          by: ["status"],
          where: { schoolId, recordedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
          _count: true,
        }),
        prisma.attendanceOccasion.findMany({
          where: { campus: { schoolId }, status: { in: ["active", "scheduled"] } },
          include: { _count: { select: { records: true } } },
          take: 6,
        }),
        prisma.auditEvent.findMany({
          where: { schoolId },
          include: { actor: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 6,
        }),
      ]);
      const count = (status: string) => attendance.find((r) => r.status === status)?._count ?? 0;
      return {
        greetingName: request.sessionUser!.email,
        date: new Date().toLocaleDateString("en-UG", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        term: "Current term",
        metrics: [
          {
            key: "learners",
            label: "Active learners",
            value: learners,
            change: "Live database",
            trend: "flat",
            tone: "navy",
          },
          {
            key: "present",
            label: "Present today",
            value: count("present"),
            change: "Recorded scans",
            trend: "up",
            tone: "cyan",
          },
          {
            key: "late",
            label: "Late today",
            value: count("late"),
            change: "Recorded scans",
            trend: "flat",
            tone: "warning",
          },
          {
            key: "unexplained",
            label: "Unexplained absences",
            value: count("unexplained"),
            change: "Needs reconciliation",
            trend: "flat",
            tone: "warning",
          },
        ],
        attendanceTrend: [],
        statusDistribution: attendance.map((r) => ({ name: r.status, value: r._count })),
        attendanceByClass: [],
        caseStatus: [],
        unexplainedAbsences: [],
        seriousCases: [],
        deviceIssues: [],
        todaysOccasions: openOccasions.map((o) => ({
          ...o,
          date: o.startsAt.toISOString().slice(0, 10),
          startTime: o.startsAt.toISOString().slice(11, 16),
          endTime: o.endsAt.toISOString().slice(11, 16),
          scanned: o._count.records,
          responsibleStaff: o.responsibleStaffId,
        })),
        recentStaffActions: auditEvents.map((e) => ({
          id: e.id,
          actor: e.actor?.name ?? "System",
          action: e.action,
          entity: e.entityType,
          dateTime: e.createdAt.toISOString(),
          ipAddress: e.ipAddress ?? "",
          outcome: "success",
        })),
      };
    },
  );
  return app;
}
