import { GraduationCap, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { DEMO_ACCOUNTS, ROLES } from "@/lib/roles";
import type { RoleKey } from "@/types";
import { cn } from "@/lib/utils";

export function LoginScreen() {
  const { login, signingIn } = useAuth();
  const [role, setRole] = useState<RoleKey>("administrator");
  const account = DEMO_ACCOUNTS.find((a) => a.role === role)!;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-white">Nile Crest Secondary School</p>
            <p className="text-[11px] text-sidebar-foreground/60">Kampala Campus</p>
          </div>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl leading-tight font-semibold text-white">
            Student Attendance, Progress and Welfare Management System
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed text-sidebar-foreground/70">
            One record for every learner: QR identity, attendance occasions, authorised absences, welfare support and
            conduct review — with a full audit trail for every action taken.
          </p>
          <ul className="mt-6 space-y-2 text-[13px] text-sidebar-foreground/80">
            {["Offline-tolerant scanning at gate, assembly, prep and dormitory", "Confidential welfare records separated by role", "Reports for administrators, headteachers and stakeholders"].map(
              (item) => (
                <li key={item} className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-primary" />
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>
        <p className="text-[11px] text-sidebar-foreground/50">Demonstration environment · Fictional data</p>
      </div>

      <div className="flex items-center justify-center bg-background px-5 py-10">
        <form
          className="w-full max-w-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void login(role);
          }}
        >
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Choose a demonstration account to explore the role-based interface.
          </p>

          <div className="mt-6 space-y-3">
            <div>
              <Label htmlFor="email" className="text-[12px]">
                Work email
              </Label>
              <Input id="email" value={account.email} readOnly className="mt-1 h-9 text-[13px]" />
            </div>
            <div>
              <Label htmlFor="password" className="text-[12px]">
                Password
              </Label>
              <Input id="password" type="password" defaultValue="demo-password" className="mt-1 h-9 text-[13px]" />
            </div>
          </div>

          <p className="mt-6 mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Demonstration role
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.role}
                type="button"
                onClick={() => setRole(a.role)}
                className={cn(
                  "rounded-md border px-2.5 py-2 text-left text-[12px] font-medium transition-colors",
                  role === a.role
                    ? "border-cyan bg-accent text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-cyan/50",
                )}
              >
                {ROLES[a.role].name}
              </button>
            ))}
          </div>

          <p className="mt-3 text-[12px] text-muted-foreground">{ROLES[role].description}</p>

          <Button type="submit" className="mt-5 h-9 w-full text-[13px]" disabled={signingIn}>
            {signingIn ? "Signing in…" : `Sign in as ${ROLES[role].name}`}
          </Button>
        </form>
      </div>
    </div>
  );
}
