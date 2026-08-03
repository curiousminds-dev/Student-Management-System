import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: typeof Inbox;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="mb-1 grid h-11 w-11 place-items-center rounded-full bg-accent text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-[13px] text-muted-foreground">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="mb-1 grid h-11 w-11 place-items-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-foreground">This information could not be loaded</p>
      <p className="max-w-sm text-[13px] text-muted-foreground">
        {message ?? "The request did not complete. Check your connection and try again."}
      </p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function TableSkeleton({ rows = 8, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: columns }).map((__, c) => (
            <Skeleton key={c} className={cn("h-3.5", c === 0 ? "w-44" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PermissionDenied({ area }: { area: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-2 py-24 text-center">
      <span className="mb-1 grid h-12 w-12 place-items-center rounded-full bg-navy-soft text-primary">
        <ShieldAlert className="h-6 w-6" />
      </span>
      <h1 className="text-lg font-semibold">You do not have access to {area}</h1>
      <p className="text-[13px] text-muted-foreground">
        Your role does not include permission for this area. If you need access for your duties, ask the school
        administrator to review your permissions.
      </p>
    </div>
  );
}

export function SensitiveNotice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-border bg-navy-soft/60 px-3 py-2 text-[12px] text-foreground",
        className,
      )}
    >
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <p>{children}</p>
    </div>
  );
}
