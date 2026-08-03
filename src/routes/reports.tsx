import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, FileBarChart, Lock, Printer } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, SectionCard } from "@/components/common/Primitives";
import { SensitiveNotice } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { reportService } from "@/services";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Report centre — attendance, welfare and administration" },
      { name: "description", content: "Generate attendance, welfare, conduct and administration reports for Nile Crest Secondary School." },
      { property: "og:title", content: "Report centre" },
      { property: "og:description", content: "Attendance, welfare, conduct and administration reports." },
    ],
  }),
  component: ReportsPage,
});

interface ReportDef { id: string; title: string; description: string; restricted?: boolean }

const CATEGORIES: { name: string; description: string; reports: ReportDef[] }[] = [
  {
    name: "Attendance",
    description: "Daily, weekly and termly attendance reporting",
    reports: [
      { id: "daily-register", title: "Daily register", description: "Full attendance register for a single day." },
      { id: "weekly-summary", title: "Weekly summary", description: "Attendance summary across the current week." },
      { id: "term-report", title: "Term report", description: "Cumulative attendance for the selected term." },
      { id: "late-coming", title: "Late-coming report", description: "Learners recorded late, by class and date." },
      { id: "unexplained-absence", title: "Unexplained absence", description: "Absences not yet reconciled or explained." },
      { id: "authorised-absence", title: "Authorised absence", description: "Approved absences with reasons and approver." },
      { id: "attendance-by-class", title: "Attendance by class", description: "Attendance percentages broken down by class." },
      { id: "attendance-by-learner", title: "Attendance by learner", description: "Individual learner attendance history." },
    ],
  },
  {
    name: "Welfare and conduct",
    description: "Restricted reports requiring welfare access",
    reports: [
      { id: "positive-conduct", title: "Positive conduct", description: "Recognitions and positive observations recorded.", restricted: true },
      { id: "open-concerns", title: "Open concerns", description: "Welfare concerns awaiting review or closure.", restricted: true },
      { id: "case-status", title: "Case status", description: "Conduct cases by stage and outcome.", restricted: true },
      { id: "intervention-followup", title: "Intervention follow-up", description: "Active interventions and review dates.", restricted: true },
      { id: "sick-bay-summary", title: "Sick-bay summary", description: "Health encounters and outcomes.", restricted: true },
    ],
  },
  {
    name: "Administration",
    description: "Operational and compliance reporting",
    reports: [
      { id: "device-sync", title: "Device synchronisation", description: "Sync status and conflicts across devices." },
      { id: "audit-report", title: "Audit report", description: "System actions across all modules and users." },
      { id: "staff-activity", title: "Staff activity", description: "Staff sign-ins and recorded actions." },
      { id: "qr-replacements", title: "QR replacements", description: "QR card replacements and revocations." },
      { id: "data-quality", title: "Data quality", description: "Missing or inconsistent learner records." },
    ],
  },
];

function ReportsPage() {
  const { can } = useAuth();
  const hasWelfare = can("welfare.view");
  const [active, setActive] = useState<ReportDef | null>(null);
  const [generating, setGenerating] = useState<"pdf" | "csv" | "print" | null>(null);
  const [className, setClassName] = useState("all");
  const [stream, setStream] = useState("all");
  const [occasion, setOccasion] = useState("all");
  const [from, setFrom] = useState("2026-07-27");
  const [to, setTo] = useState("2026-08-03");

  const run = async (kind: "pdf" | "csv" | "print") => {
    if (!active) return;
    setGenerating(kind);
    try {
      await reportService.generate(active.id);
      toast.success(
        kind === "print" ? "Print preview ready" : `${kind.toUpperCase()} export ready`,
        { description: `${active.title} has been generated for the selected filters.` },
      );
      setActive(null);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <AppShell permission="reports.view" area="the report centre">
      <PageHeader title="Report centre" description="Generate attendance, welfare and administration reports for export or printing." />

      <div className="space-y-4">
        {CATEGORIES.map((cat) => (
          <SectionCard key={cat.name} title={cat.name} description={cat.description}>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
              {cat.reports.map((r) => {
                const blocked = r.restricted && !hasWelfare;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setActive(r)}
                    className={cn(
                      "rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/50",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-navy-soft text-primary">
                        <FileBarChart className="h-3.5 w-3.5" />
                      </span>
                      {r.restricted ? (
                        <Badge variant="outline" className={cn("gap-1 text-[10px]", blocked ? "text-danger" : "text-info")}>
                          <Lock className="h-3 w-3" /> Restricted
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-[13px] font-medium">{r.title}</p>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">{r.description}</p>
                  </button>
                );
              })}
            </div>
          </SectionCard>
        ))}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{active?.title}</DialogTitle>
            <DialogDescription>{active?.description}</DialogDescription>
          </DialogHeader>

          {active?.restricted && !hasWelfare ? (
            <SensitiveNotice>
              Your role does not include welfare access. This report contains welfare or conduct information and cannot be
              generated for your account.
            </SensitiveNotice>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>From</Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 text-[13px]" />
                </div>
                <div className="space-y-1.5">
                  <Label>To</Label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 text-[13px]" />
                </div>
                <div className="space-y-1.5">
                  <Label>Class</Label>
                  <Select value={className} onValueChange={setClassName}>
                    <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All classes</SelectItem>
                      {["Senior One", "Senior Two", "Senior Three", "Senior Four", "Senior Five", "Senior Six"].map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Stream</Label>
                  <Select value={stream} onValueChange={setStream}>
                    <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All streams</SelectItem>
                      {["East", "West", "North", "South"].map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Occasion</Label>
                  <Select value={occasion} onValueChange={setOccasion}>
                    <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All occasions</SelectItem>
                      <SelectItem value="gate">Gate entry / exit</SelectItem>
                      <SelectItem value="assembly">Assembly</SelectItem>
                      <SelectItem value="lesson">Class lesson</SelectItem>
                      <SelectItem value="roll-call">Dormitory roll call</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-end">
                <Button variant="outline" size="sm" disabled={!!generating} onClick={() => void run("print")}>
                  <Printer className="h-3.5 w-3.5" /> Print preview
                </Button>
                <Button variant="outline" size="sm" disabled={!!generating} onClick={() => void run("csv")}>
                  <Download className="h-3.5 w-3.5" /> {generating === "csv" ? "Generating…" : "CSV"}
                </Button>
                <Button size="sm" disabled={!!generating} onClick={() => void run("pdf")}>
                  <Download className="h-3.5 w-3.5" /> {generating === "pdf" ? "Generating…" : "PDF"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
