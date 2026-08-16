import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronsLeft, GraduationCap } from "lucide-react";
import { NAVIGATION } from "@/lib/navigation";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function Sidebar({
  collapsed,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const { can } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        "flex h-full flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-[240px]",
      )}
    >
      <div
        className={cn("flex items-center gap-2.5 px-4 py-4", collapsed && "justify-center px-0")}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <GraduationCap className="h-5 w-5" />
        </span>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-white">
              Nile Crest Secondary School
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">Kampala Campus</p>
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {NAVIGATION.map((section) => {
          const items = section.items.filter((i) => can(i.permission) || (i.alt && can(i.alt)));
          if (items.length === 0) return null;
          return (
            <div key={section.title} className="mb-4">
              {!collapsed ? (
                <p className="px-2 pb-1.5 text-[10px] font-semibold tracking-[0.09em] text-sidebar-foreground/45 uppercase">
                  {section.title}
                </p>
              ) : (
                <div className="mx-3 mb-2 border-t border-sidebar-border/60" />
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                  const link = (
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors outline-none",
                        "focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-white",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </Link>
                  );
                  return (
                    <li key={item.to}>
                      {collapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{link}</TooltipTrigger>
                          <TooltipContent side="right">{item.label}</TooltipContent>
                        </Tooltip>
                      ) : (
                        link
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "m-3 hidden items-center gap-2 rounded-md px-2.5 py-2 text-[12px] font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white lg:flex",
          collapsed && "justify-center px-0",
        )}
      >
        <ChevronsLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        {!collapsed ? "Collapse" : null}
      </button>
    </nav>
  );
}
