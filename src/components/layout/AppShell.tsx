import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { LoginScreen } from "./LoginScreen";
import { useAuth } from "@/lib/auth-context";
import { PermissionDenied } from "@/components/common/States";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { PermissionKey } from "@/types";

export function AppShell({
  children,
  permission,
  area,
  fullBleed,
}: {
  children: ReactNode;
  permission?: PermissionKey | PermissionKey[];
  area?: string;
  fullBleed?: boolean;
}) {
  const { user, ready, can } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!ready) {
    return (
      <div className="flex min-h-screen">
        <Skeleton className="hidden h-screen w-[240px] rounded-none lg:block" />
        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  const required = permission ? (Array.isArray(permission) ? permission : [permission]) : [];
  const allowed = required.length === 0 || required.some((p) => can(p));

  return (
    <div className="flex min-h-screen bg-background">
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[240px] border-0 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar
            collapsed={false}
            onToggle={() => setMobileOpen(false)}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenNav={() => setMobileOpen(true)} />
        <main className={fullBleed ? "min-w-0 flex-1" : "min-w-0 flex-1 p-4 sm:p-5 lg:p-6"}>
          {allowed ? children : <PermissionDenied area={area ?? "this area"} />}
        </main>
      </div>
    </div>
  );
}
