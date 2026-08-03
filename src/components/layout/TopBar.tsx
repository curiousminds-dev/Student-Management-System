import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, HelpCircle, KeyRound, LogOut, Menu, RefreshCw, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth-context";
import { NAVIGATION } from "@/lib/navigation";
import { LearnerAvatar } from "@/components/common/LearnerAvatar";
import { toast } from "sonner";

export function TopBar({ onOpenNav }: { onOpenNav: () => void }) {
  const { user, logout } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current =
    NAVIGATION.flatMap((s) => s.items).find((i) => (i.to === "/" ? pathname === "/" : pathname.startsWith(i.to))) ??
    NAVIGATION[0]!.items[0]!;
  const section = NAVIGATION.find((s) => s.items.some((i) => i.to === current.to));

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card px-3 sm:px-4">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={onOpenNav}>
        <Menu className="h-5 w-5" />
      </Button>

      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="hidden text-[11px] text-muted-foreground sm:block">
          <Link to="/" className="hover:text-foreground">
            Home
          </Link>
          <span className="px-1">/</span>
          <span>{section?.title}</span>
          <span className="px-1">/</span>
          <span className="text-foreground">{current.label}</span>
        </nav>
        <p className="truncate text-[14px] font-semibold text-foreground">{current.label}</p>
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <div className="relative hidden xl:block">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search the system"
            placeholder="Search learners, staff or records"
            className="h-8 w-64 pl-8 text-[13px]"
          />
        </div>

        <Select defaultValue="t2">
          <SelectTrigger className="hidden h-8 w-[150px] text-[12px] md:flex" aria-label="Term">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="t1">Term 1 · 2026</SelectItem>
            <SelectItem value="t2">Term 2 · 2026</SelectItem>
            <SelectItem value="t3">Term 3 · 2026</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="cmp-1">
          <SelectTrigger className="hidden h-8 w-[150px] text-[12px] lg:flex" aria-label="Campus">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cmp-1">Kampala Campus</SelectItem>
            <SelectItem value="cmp-2">Mukono Campus</SelectItem>
          </SelectContent>
        </Select>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => toast.success("All devices are up to date")}
              className="hidden items-center gap-1.5 rounded-md bg-success-soft px-2 py-1 text-[11px] font-medium text-success sm:flex"
            >
              <RefreshCw className="h-3 w-3" />
              Synced
            </button>
          </TooltipTrigger>
          <TooltipContent>Last synchronisation 3 minutes ago</TooltipContent>
        </Tooltip>

        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          aria-label="Notifications"
          onClick={() => toast("4 unread notifications", { description: "18 unexplained absences need reconciliation." })}
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-cyan" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted" aria-label="Account menu">
              <LearnerAvatar name={user?.name ?? "User"} hue={216} size={28} />
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block truncate text-[12px] font-semibold text-foreground">{user?.name}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{user?.roleName}</span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-[12px]">
              {user?.name}
              <span className="block text-[11px] font-normal text-muted-foreground">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => toast("My profile", { description: "Profile management opens here." })}>
              <UserRound className="h-4 w-4" /> My profile
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toast.success("Password reset link sent to your email")}>
              <KeyRound className="h-4 w-4" /> Change password
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toast("Help centre", { description: "Guides for attendance and welfare." })}>
              <HelpCircle className="h-4 w-4" /> Help
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={logout}>
              <LogOut className="h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
