import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { prisma } from "./lib.js";

let app: FastifyInstance;
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
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@nilecrest.ac.ug", password: "demo-password" },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().token;
    const learners = await app.inject({
      method: "GET",
      url: "/api/v1/learners",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(learners.statusCode).toBe(200);
    expect(learners.json().total).toBeGreaterThan(0);
  });
});
