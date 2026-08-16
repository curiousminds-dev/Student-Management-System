import { describe, expect, it } from "vitest";
import { hasPermission, permissionsFor } from "./permissions.js";

describe("role permissions", () => {
  it("allows administrators to perform every guarded action", () =>
    expect(hasPermission("administrator", "anything")).toBe(true));
  it("prevents security officers from managing learner records", () =>
    expect(hasPermission("security_officer", "learners.manage")).toBe(false));
  it("allows teachers to record attendance", () =>
    expect(hasPermission("teacher", "attendance.record")).toBe(true));
  it("returns no permissions for unknown roles", () =>
    expect(permissionsFor("unknown")).toEqual([]));
});
