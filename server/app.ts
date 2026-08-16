/* eslint-disable @typescript-eslint/no-explicit-any */
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { ZodError } from "zod";
import {
  audit,
  authenticate,
  hashCredential,
  issueToken,
  learnerDto,
  newCredential,
  prisma,
} from "./lib.js";
import { hasPermission, permissionsFor } from "./permissions.js";
import {
  learnerSchema,
  loginSchema,
  messageSchema,
  occasionSchema,
  scanSchema,
  syncSchema,
} from "./schemas.js";

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
    logger: process.env["NODE_ENV"] !== "test",
    genReqId: () => crypto.randomUUID(),
  });
  await app.register(cors, { origin: process.env["WEB_ORIGIN"]?.split(",") ?? true });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError)
      return reply.status(400).send({ error: "Validation failed", details: error.flatten() });
    const status = (error as any).statusCode ?? 500;
    return reply
      .status(status)
      .send({ error: status >= 500 ? "Internal server error" : error.message });
  });

  app.get("/health", async () => ({ status: "ok", service: "student-management-api" }));
  app.post("/api/v1/auth/login", async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || !user.active || !(await bcrypt.compare(input.password, user.passwordHash)))
      return reply.status(401).send({ error: "Invalid email or password" });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const session = {
      id: user.id,
      schoolId: user.schoolId,
      campusId: user.campusId,
      role: user.role,
      email: user.email,
    };
    const token = await issueToken(session);
    return {
      token,
      user: {
        id: user.id,
        staffId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        roleName: user.role.replaceAll("_", " "),
        campusId: user.campusId,
        permissions: permissionsFor(user.role).includes("*") ? ["*"] : permissionsFor(user.role),
      },
    };
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
    { preHandler: requirePermission("attendance.record") },
    async (request) => recordScan(request, scanSchema.parse(request.body)),
  );
  app.post(
    "/api/v1/attendance/sync",
    { preHandler: requirePermission("attendance.record") },
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
      return reply.status(202).send(row);
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
