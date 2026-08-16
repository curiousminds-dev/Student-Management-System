export const ROLE_PERMISSIONS = {
  administrator: ["*"],
  headteacher: [
    "dashboard.view",
    "learners.view",
    "attendance.view",
    "attendance.record",
    "occasions.manage",
    "reports.view",
    "communication.view",
    "audit.view",
  ],
  director_of_studies: [
    "dashboard.view",
    "learners.view",
    "learners.manage",
    "attendance.view",
    "attendance.record",
    "occasions.manage",
    "reports.view",
    "communication.view",
  ],
  teacher: [
    "dashboard.view",
    "learners.view",
    "attendance.view",
    "attendance.record",
    "observations.view",
    "observations.create",
  ],
  security_officer: [
    "learners.identity_only",
    "attendance.view",
    "attendance.record",
    "devices.view",
  ],
  nurse: [
    "learners.view",
    "attendance.view",
    "observations.view",
    "observations.create",
    "welfare.view",
    "welfare.manage",
    "health.view",
  ],
  warden: [
    "learners.view",
    "attendance.view",
    "attendance.record",
    "observations.view",
    "observations.create",
    "welfare.view",
  ],
  transport_officer: [
    "learners.identity_only",
    "attendance.view",
    "attendance.record",
    "devices.view",
  ],
} as const;

export function permissionsFor(role: string): string[] {
  return [...(ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] ?? [])];
}

export function hasPermission(role: string, permission: string): boolean {
  const permissions = permissionsFor(role);
  return permissions.includes("*") || permissions.includes(permission);
}
