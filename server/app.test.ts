import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { prisma } from "./lib.js";

let app: FastifyInstance;
async function login(email = "admin@nilecrest.ac.ug") {
  return app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password: "demo-password" },
  });
}
beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("API", () => {
  it("reports health", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("ok");
  });
  it("authenticates a seeded user and enforces bearer authentication", async () => {
    const denied = await app.inject({ method: "GET", url: "/api/v1/learners" });
    expect(denied.statusCode).toBe(401);
    const response = await login();
    expect(response.statusCode).toBe(200);
    const token = response.json().token;
    const learners = await app.inject({
      method: "GET",
      url: "/api/v1/learners",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(learners.statusCode).toBe(200);
    expect(learners.json().total).toBeGreaterThan(0);
  });

  it("rotates refresh cookies and revokes the old access session on logout", async () => {
    const signedIn = await login();
    const cookie = signedIn.headers["set-cookie"] as string;
    expect(cookie).toContain("HttpOnly");
    const refreshed = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: { cookie },
    });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.headers["set-cookie"]).toContain("HttpOnly");
    const token = refreshed.json().token;
    const logout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(logout.statusCode).toBe(200);
    const denied = await app.inject({
      method: "GET",
      url: "/api/v1/learners",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(denied.statusCode).toBe(401);
  });

  it("enforces RBAC on staff administration", async () => {
    const teacher = await login("teacher@nilecrest.ac.ug");
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/staff",
      headers: { authorization: `Bearer ${teacher.json().token}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it("requires device authentication and makes concurrent scans idempotent", async () => {
    const staff = await login("security@nilecrest.ac.ug");
    const deviceAuth = await app.inject({
      method: "POST",
      url: "/api/v1/devices/auth",
      payload: { publicId: "NCS-GATE-01", secret: "ncs-demo-device-secret" },
    });
    expect(deviceAuth.statusCode).toBe(200);
    const occasion = await prisma.attendanceOccasion.findFirstOrThrow({
      where: { status: "active" },
    });
    const deviceId = deviceAuth.json().deviceId;
    const scan = () =>
      app.inject({
        method: "POST",
        url: "/api/v1/attendance/scan",
        headers: {
          authorization: `Bearer ${staff.json().token}`,
          "x-device-token": deviceAuth.json().token,
        },
        payload: {
          credential: "NCS-DEMO-AMINA-001",
          occasionId: occasion.id,
          deviceId,
          clientEventId: crypto.randomUUID(),
          recordedAt: new Date().toISOString(),
        },
      });
    const responses = await Promise.all([scan(), scan(), scan(), scan()]);
    const outcomes = responses.map((response) => response.json().outcome);
    expect(outcomes.filter((outcome) => outcome === "accepted")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome === "duplicate")).toHaveLength(3);
  });

  it("does not return learners belonging to another school", async () => {
    const foreign = await prisma.school.create({
      data: {
        name: "Other School",
        campuses: { create: { name: "Other Campus", district: "Wakiso" } },
      },
      include: { campuses: true },
    });
    await prisma.learner.create({
      data: {
        schoolId: foreign.id,
        campusId: foreign.campuses[0]!.id,
        firstName: "Foreign",
        lastName: "Learner",
        admissionNumber: "FOREIGN-001",
        className: "Senior One",
        stream: "A",
        gender: "Female",
        residence: "Day",
        dateOfBirth: new Date("2011-01-01"),
        guardianName: "Guardian",
        guardianPhone: "+256700000000",
      },
    });
    const admin = await login();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/learners?search=Foreign",
      headers: { authorization: `Bearer ${admin.json().token}` },
    });
    expect(response.json().total).toBe(0);
    await prisma.school.delete({ where: { id: foreign.id } });
  });
});
