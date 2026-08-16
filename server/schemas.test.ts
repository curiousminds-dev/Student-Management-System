import { describe, expect, it } from "vitest";
import { loginSchema, syncSchema } from "./schemas.js";

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
});
