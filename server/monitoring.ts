import type { FastifyInstance } from "fastify";
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";
import { env } from "./env.js";
import { prisma } from "./lib.js";

const registry = new Registry();
collectDefaultMetrics({ register: registry, prefix: "sapwms_" });
const requests = new Counter({
  name: "sapwms_http_requests_total",
  help: "HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [registry],
});
const duration = new Histogram({
  name: "sapwms_http_request_duration_seconds",
  help: "HTTP request duration",
  labelNames: ["method", "route", "status"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [registry],
});
const requestStarts = new WeakMap<object, bigint>();

export function registerMonitoring(app: FastifyInstance) {
  app.addHook("onRequest", async (request) => {
    requestStarts.set(request, process.hrtime.bigint());
  });
  app.addHook("onResponse", async (request, reply) => {
    const route = request.routeOptions.url ?? "unknown";
    const labels = { method: request.method, route, status: String(reply.statusCode) };
    requests.inc(labels);
    const started = requestStarts.get(request) ?? process.hrtime.bigint();
    duration.observe(labels, Number(process.hrtime.bigint() - started) / 1e9);
  });
  app.get("/health/live", async () => ({ status: "ok" }));
  app.get("/health/ready", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ready" };
    } catch {
      return reply.status(503).send({ status: "not_ready" });
    }
  });
  app.get("/metrics", async (request, reply) => {
    if (env.METRICS_TOKEN && request.headers.authorization !== `Bearer ${env.METRICS_TOKEN}`)
      return reply.status(401).send({ error: "Unauthorized" });
    return reply.type(registry.contentType).send(await registry.metrics());
  });
}
