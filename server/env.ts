import { readFileSync } from "node:fs";
import { z } from "zod";

function secret(name: string): string | undefined {
  const file = process.env[`${name}_FILE`];
  if (file) return readFileSync(file, "utf8").trim();
  return process.env[name];
}

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  MFA_ENCRYPTION_KEY: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  WEB_ORIGIN: z.string().url(),
  API_PORT: z.coerce.number().int().positive().default(3001),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  METRICS_TOKEN: z.string().min(24).optional(),
  AUDIT_RETENTION_DAYS: z.coerce.number().int().min(365).default(2555),
  MESSAGE_RETENTION_DAYS: z.coerce.number().int().min(30).default(365),
});

export const env = schema.parse({
  ...process.env,
  JWT_SECRET: secret("JWT_SECRET"),
  MFA_ENCRYPTION_KEY: secret("MFA_ENCRYPTION_KEY"),
  RESEND_API_KEY: secret("RESEND_API_KEY"),
  TWILIO_AUTH_TOKEN: secret("TWILIO_AUTH_TOKEN"),
  METRICS_TOKEN: secret("METRICS_TOKEN"),
});
