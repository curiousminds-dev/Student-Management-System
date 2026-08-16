import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./auth.js";
import { hashCredential, newCredential } from "./lib.js";

describe("security primitives", () => {
  it("encrypts MFA secrets with randomized authenticated encryption", () => {
    const first = encryptSecret("TOP-SECRET");
    const second = encryptSecret("TOP-SECRET");
    expect(first).not.toBe(second);
    expect(decryptSecret(first)).toBe("TOP-SECRET");
  });
  it("creates high-entropy credentials and stores stable hashes", () => {
    const first = newCredential();
    const second = newCredential();
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThan(30);
    expect(hashCredential(first)).toHaveLength(64);
  });
});
