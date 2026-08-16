import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 pb-4 sm:flex sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="page-title truncate text-foreground">{title}</h1>
          {meta}
        </div>
        {description ? (
          <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("surface-card overflow-hidden", className)}>
      {title ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-foreground">{title}</h2>
            {description ? (
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className={cn(bodyClassName)}>{children}</div>
    </section>
  );
}

const TONE_STYLES: Record<string, string> = {
  navy: "bg-navy-soft text-primary",
  cyan: "bg-accent text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-[oklch(0.52_0.12_74)]",
  info: "bg-info-soft text-info",
};

export function MetricCard({
  label,
  value,
  change,
  trend = "flat",
  tone = "navy",
  icon: Icon,
}: {
  label: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "flat";
  tone?: keyof typeof TONE_STYLES;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  return (
    <div className="surface-card px-4 py-3.5">
      <div className="flex items-center gap-2">
        {Icon ? (
          <span className={cn("grid h-7 w-7 place-items-center rounded-md", TONE_STYLES[tone])}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : null}
        <p className="truncate text-[12px] font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {change ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <TrendIcon
            className={cn(
              "h-3 w-3",
              trend === "up"
                ? "text-success"
                : trend === "down"
                  ? "text-[oklch(0.52_0.12_74)]"
                  : "text-muted-foreground",
            )}
          />
          {change}
        </p>
      ) : null}
    </div>
  );
}

export function QuickLink({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="h-auto justify-start gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium"
    >
      <Link to={to}>
        <Icon className="h-4 w-4 text-primary" />
        <span className="truncate">{label}</span>
        <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
      </Link>
    </Button>
  );
}
