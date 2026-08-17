import { describe, expect, it } from "vitest";
import {
  biometricEnrollmentSchema,
  biometricVerificationSchema,
  loginSchema,
  syncSchema,
} from "./schemas.js";

describe("API validation", () => {
  it("rejects weak login payloads", () =>
    expect(loginSchema.safeParse({ email: "bad", password: "short" }).success).toBe(false));
  it("requires idempotency keys on offline events", () =>
    expect(
      syncSchema.safeParse({
        clientBatchId: "batch-1",
        events: [{ credential: "credential-123", occasionId: "occasion-1", deviceId: "device-1" }],
      }).success,
    ).toBe(false));
  it("requires explicit consent for biometric enrollment", () =>
    expect(
      biometricEnrollmentSchema.safeParse({
        modality: "face",
        provider: "device-adapter",
        consentRecorded: false,
        consentBy: "Guardian",
      }).success,
    ).toBe(false));
  it("requires a learner or credential reference for biometric verification", () =>
    expect(
      biometricVerificationSchema.safeParse({
        occasionId: "occasion-1",
        deviceId: "device-1",
        clientEventId: "capture-0001",
        modality: "fingerprint",
        provider: "device-adapter",
        confidence: 0.95,
      }).success,
    ).toBe(false));
});
