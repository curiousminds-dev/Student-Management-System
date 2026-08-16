import { cn } from "@/lib/utils";

export type BadgeTone =
  | "present"
  | "late"
  | "excused"
  | "unexplained"
  | "pending"
  | "neutral"
  | "info"
  | "danger"
  | "success"
  | "warning";

const TONES: Record<BadgeTone, string> = {
  present: "bg-success-soft text-success",
  success: "bg-success-soft text-success",
  late: "bg-warning-soft text-[oklch(0.52_0.12_74)]",
  warning: "bg-warning-soft text-[oklch(0.52_0.12_74)]",
  excused: "bg-info-soft text-info",
  info: "bg-info-soft text-info",
  unexplained: "bg-danger-soft text-danger",
  danger: "bg-danger-soft text-danger",
  pending: "bg-muted text-muted-foreground",
  neutral: "bg-muted text-muted-foreground",
};

const LABELS: Record<string, string> = {
  present: "Present",
  late: "Late",
  excused: "Excused",
  unexplained: "Unexplained",
  pending: "Pending",
  active: "Active",
  revoked: "Revoked",
  replaced: "Replaced",
  not_issued: "Not issued",
  synced: "Synced",
  syncing: "Syncing",
  failed: "Failed",
  conflict: "Conflict",
  disabled: "Disabled",
  reconciled: "Reconciled",
  not_required: "—",
  suspended: "Suspended",
  invited: "Invited",
};

export function StatusBadge({
  status,
  tone,
  className,
}: {
  status: string;
  tone?: BadgeTone;
  className?: string;
}) {
  const resolved: BadgeTone =
    tone ??
    ([
      "present",
      "active",
      "synced",
      "approved",
      "reconciled",
      "sent",
      "success",
      "closed",
    ].includes(status)
      ? "present"
      : ["late", "pending", "syncing", "queued", "paused", "marks_entry"].includes(status)
        ? "late"
        : ["excused", "scheduled", "published", "open"].includes(status)
          ? "excused"
          : ["unexplained", "revoked", "failed", "conflict", "suspended", "denied"].includes(status)
            ? "unexplained"
            : "neutral");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        TONES[resolved],
        className,
      )}
    >
      {LABELS[status] ?? status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
}
