import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AlertTriangle, Bus, Calendar, ChevronLeft, Download, FileText, HeartPulse, IdCard, Lock, MoreHorizontal,
  Pencil, Printer, QrCode, RefreshCcw, ShieldAlert, ShieldCheck, Stethoscope, Trophy, UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, SectionCard } from "@/components/common/Primitives";
import { EmptyState, ErrorState, PermissionDenied, TableSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LearnerAvatar } from "@/components/common/LearnerAvatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { learnerService, supportService, academicsService } from "@/services";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/learners/$id")({
  head: () => ({
    meta: [
      { title: "Learner profile — Nile Crest SAPWMS" },
      { name: "description", content: "Full learner profile with attendance, academics, conduct, welfare and QR credential management." },
      { property: "og:title", content: "Learner profile — Nile Crest SAPWMS" },
      { property: "og:description", content: "Attendance, academics, conduct, welfare and QR credential management for a learner." },
    ],
  }),
  notFoundComponent: () => (
    <AppShell>
      <EmptyState title="Learner not found" description="This learner record does not exist or may have been removed." icon={AlertTriangle} />
    </AppShell>
  ),
  component: LearnerProfilePage,
});

function RestrictedPanel({ area }: { area: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 py-14 text-center">
      <span className="mb-1 grid h-11 w-11 place-items-center rounded-full bg-navy-soft text-primary">
        <Lock className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-foreground">Restricted — {area}</p>
      <p className="max-w-sm text-[13px] text-muted-foreground">
        Your role does not have permission to view this information. Ask a school administrator if you need access.
      </p>
    </div>
  );
}

const reasonSchema = z.object({ reason: z.string().min(10, "Provide at least 10 characters explaining the reason") });
type ReasonValues = z.infer<typeof reasonSchema>;

function ReasonDialog({
  open, onOpenChange, title, description, staff, onConfirm, confirming,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  staff: string;
  onConfirm: (reason: string) => void;
  confirming: boolean;
}) {
  const form = useForm<ReasonValues>({ resolver: zodResolver(reasonSchema), defaultValues: { reason: "" } });
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-md bg-muted/50 px-3 py-2 text-[12px] text-muted-foreground">
          Responsible staff: <span className="font-medium text-foreground">{staff}</span> · {new Date().toLocaleString("en-UG")}
        </div>
        <Form {...form}>
          <FormField control={form.control} name="reason" render={({ field }) => (
            <FormItem>
              <FormLabel>Reason<span className="text-danger">*</span></FormLabel>
              <FormControl><Textarea rows={3} placeholder="Explain why this action is required" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </Form>
        <AlertDialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={confirming}
            onClick={form.handleSubmit((v) => onConfirm(v.reason))}
          >
            {confirming ? "Processing…" : "Confirm"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function LearnerProfilePage() {
  const { id } = Route.useParams();
  const { can, user } = useAuth();
  const qc = useQueryClient();
  const staffName = user?.name ?? "Current staff member";

  const [revokeOpen, setRevokeOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [absenceOpen, setAbsenceOpen] = useState(false);

  const learnerQuery = useQuery({
    queryKey: ["learner", id],
    queryFn: () => learnerService.byId(id),
    retry: false,
  });

  const credentialsQuery = useQuery({
    queryKey: ["learner-credentials", id],
    queryFn: () => learnerService.credentials(id),
    enabled: !!learnerQuery.data,
  });

  const revokeMutation = useMutation({
    mutationFn: (reason: string) => learnerService.revokeCredential(id, reason),
    onSuccess: () => {
      toast.success("QR credential revoked", { description: "The learner's card can no longer be used to scan attendance." });
      setRevokeOpen(false);
      void qc.invalidateQueries({ queryKey: ["learner-credentials", id] });
    },
  });
  const replaceMutation = useMutation({
    mutationFn: (reason: string) => learnerService.replaceCredential(id, reason),
    onSuccess: () => {
      toast.success("New QR credential issued", { description: "A replacement card has been generated." });
      setReplaceOpen(false);
      void qc.invalidateQueries({ queryKey: ["learner-credentials", id] });
    },
  });

  if (learnerQuery.isLoading) {
    return (
      <AppShell permission={["learners.view", "learners.identity_only"]} area="learner profiles">
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (learnerQuery.isError || !learnerQuery.data) {
    return (
      <AppShell permission={["learners.view", "learners.identity_only"]} area="learner profiles">
        <ErrorState message="This learner could not be found or the record failed to load." onRetry={() => void learnerQuery.refetch()} />
      </AppShell>
    );
  }

  const learner = learnerQuery.data;

  return (
    <AppShell permission={["learners.view", "learners.identity_only"]} area="learner profiles">
      <Link to="/learners" className="mb-3 inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3.5 w-3.5" /> Back to learners
      </Link>

      <SectionCard bodyClassName="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <LearnerAvatar name={learner.fullName} hue={learner.photoHue} size={64} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="page-title text-foreground">{learner.fullName}</h1>
                <StatusBadge status={learner.status} />
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                <span>Admission {learner.admissionNumber}</span>
                <span>LIN {learner.lin}</span>
                <span>{learner.className} · {learner.stream}</span>
                <span className="inline-flex items-center gap-1"><Bus className="h-3 w-3" /> {learner.residence}{learner.dormitory ? ` · ${learner.dormitory}` : ""}</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={learner.qrStatus} />
                <StatusBadge status={learner.todayStatus} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {can("learners.manage") ? (
              <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => toast("Edit profile", { description: "Opening the learner edit form." })}>
                <Pencil className="h-3.5 w-3.5" /> Edit profile
              </Button>
            ) : null}
            {can("learners.manage") ? (
              <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => setReplaceOpen(true)}>
                <RefreshCcw className="h-3.5 w-3.5" /> Replace QR card
              </Button>
            ) : null}
            {can("observations.create") ? (
              <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => toast("Record observation", { description: `New observation form opened for ${learner.fullName}.` })}>
                <FileText className="h-3.5 w-3.5" /> Record observation
              </Button>
            ) : null}
            {can("attendance.record") ? (
              <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => setAbsenceOpen(true)}>
                <UserCheck className="h-3.5 w-3.5" /> Authorise absence
              </Button>
            ) : null}
            <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => toast.success("Preparing summary", { description: "The printable learner summary will open shortly." })}>
              <Printer className="h-3.5 w-3.5" /> Print summary
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="outline" className="h-8 w-8" aria-label="More actions">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => toast("Message guardian", { description: `SMS composer opened for ${learner.guardian.name}.` })}>Message guardian</DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast("Transfer requested", { description: "A transfer request draft has been created." })}>Request transfer</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-danger" onClick={() => toast.error("Deactivate learner", { description: "This requires administrator confirmation." })}>Deactivate learner</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </SectionCard>

      <div className="mt-4">
        <Tabs defaultValue="overview">
          <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/60 p-1">
            {[
              ["overview", "Overview"], ["attendance", "Attendance"], ["academics", "Academics"], ["conduct", "Conduct"],
              ["welfare", "Welfare"], ["health", "Health encounters"], ["participation", "Participation"],
              ["interventions", "Interventions"], ["documents", "Documents"], ["timeline", "Timeline"],
            ].map(([v, l]) => (
              <TabsTrigger key={v} value={String(v)} className="text-[12px]">{l}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab learner={learner} credentials={credentialsQuery.data} loading={credentialsQuery.isLoading}
              onRevoke={() => setRevokeOpen(true)} onReplace={() => setReplaceOpen(true)} />
          </TabsContent>
          <TabsContent value="attendance" className="mt-4">
            <AttendanceTab learnerId={id} />
          </TabsContent>
          <TabsContent value="academics" className="mt-4">
            {can("academics.view") ? <AcademicsTab className={learner.className} /> : <RestrictedPanel area="Academics" />}
          </TabsContent>
          <TabsContent value="conduct" className="mt-4">
            {can("cases.view") ? <ConductTab learnerId={id} /> : <RestrictedPanel area="Conduct cases" />}
          </TabsContent>
          <TabsContent value="welfare" className="mt-4">
            {can("welfare.view") ? <WelfareTab learnerId={id} /> : <RestrictedPanel area="Welfare records" />}
          </TabsContent>
          <TabsContent value="health" className="mt-4">
            {can("health.view") ? <HealthTab learnerId={id} /> : <RestrictedPanel area="Health encounters" />}
          </TabsContent>
          <TabsContent value="participation" className="mt-4">
            <ParticipationTab learnerId={id} />
          </TabsContent>
          <TabsContent value="interventions" className="mt-4">
            {can("welfare.view") ? <InterventionsTab learnerId={id} /> : <RestrictedPanel area="Interventions" />}
          </TabsContent>
          <TabsContent value="documents" className="mt-4">
            <DocumentsTab learnerId={id} />
          </TabsContent>
          <TabsContent value="timeline" className="mt-4">
            <TimelineTab learnerId={id} />
          </TabsContent>
        </Tabs>
      </div>

      <ReasonDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Revoke QR credential"
        description={`This will immediately stop ${learner.fullName}'s QR card from scanning attendance.`}
        staff={staffName}
        confirming={revokeMutation.isPending}
        onConfirm={(reason) => revokeMutation.mutate(reason)}
      />
      <ReasonDialog
        open={replaceOpen}
        onOpenChange={setReplaceOpen}
        title="Replace QR card"
        description={`Issue a new QR credential for ${learner.fullName}, e.g. because the card was lost or damaged.`}
        staff={staffName}
        confirming={replaceMutation.isPending}
        onConfirm={(reason) => replaceMutation.mutate(reason)}
      />
      <AbsenceDialog open={absenceOpen} onOpenChange={setAbsenceOpen} learnerId={id} learnerName={learner.fullName} className={learner.className} />
    </AppShell>
  );
}

const absenceSchema = z.object({
  reason: z.string().min(6, "Provide a brief reason"),
  category: z.enum(["Medical", "Family", "Official duty", "Sports", "Other"]),
  fromDate: z.string().min(1, "From date is required"),
  toDate: z.string().min(1, "To date is required"),
});
type AbsenceValues = z.infer<typeof absenceSchema>;

function AbsenceDialog({
  open, onOpenChange, learnerId, learnerName, className,
}: { open: boolean; onOpenChange: (v: boolean) => void; learnerId: string; learnerName: string; className: string }) {
  const form = useForm<AbsenceValues>({
    resolver: zodResolver(absenceSchema),
    defaultValues: { reason: "", category: "Medical", fromDate: "", toDate: "" },
  });
  const mutation = useMutation({
    mutationFn: (v: AbsenceValues) => supportService.authoriseAbsence({ learnerId, ...v }),
    onSuccess: () => {
      toast.success("Absence authorised", { description: `${learnerName}'s absence has been recorded and guardians notified.` });
      onOpenChange(false);
      form.reset();
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Authorise absence</DialogTitle>
          <DialogDescription>{learnerName} · {className}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <div className="space-y-3">
            <FormField control={form.control} name="reason" render={({ field }) => (
              <FormItem>
                <FormLabel>Reason<span className="text-danger">*</span></FormLabel>
                <FormControl><Textarea rows={2} placeholder="e.g. Attending a family introduction ceremony" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="fromDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>From<span className="text-danger">*</span></FormLabel>
                  <FormControl><input type="date" className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="toDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>To<span className="text-danger">*</span></FormLabel>
                  <FormControl><input type="date" className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </div>
        </Form>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" disabled={mutation.isPending} onClick={form.handleSubmit((v) => mutation.mutate(v))}>
            {mutation.isPending ? "Saving…" : "Authorise absence"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QrPlaceholder({ seed, size = 96 }: { seed: string; size?: number }) {
  return (
    <div className="grid shrink-0 place-items-center rounded-lg border border-border bg-card" style={{ width: size, height: size }}>
      <div className="grid grid-cols-6 grid-rows-6 gap-0.5 p-1" style={{ width: size * 0.72, height: size * 0.72 }}>
        {Array.from({ length: 36 }).map((_, i) => (
          <span key={i} className={cn("rounded-[1px]", (i * 7 + seed.length * 3) % 3 === 0 ? "bg-foreground" : "bg-muted")} />
        ))}
      </div>
    </div>
  );
}

function OverviewTab({
  learner, credentials, loading, onRevoke, onReplace,
}: { learner: import("@/types").Learner; credentials: any; loading: boolean; onRevoke: () => void; onReplace: () => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <SectionCard title="Guardian & emergency contact" description="Primary points of contact for this learner">
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Guardian</p>
            <p className="text-[13px] font-semibold text-foreground">{learner.guardian.name}</p>
            <p className="text-[12px] text-muted-foreground">{learner.guardian.relationship} · {learner.guardian.phone}</p>
            {learner.guardian.email ? <p className="text-[12px] text-muted-foreground">{learner.guardian.email}</p> : null}
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Emergency contact</p>
            <p className="text-[13px] font-semibold text-foreground">{learner.emergencyContact.name}</p>
            <p className="text-[12px] text-muted-foreground">{learner.emergencyContact.relationship} · {learner.emergencyContact.phone}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Date of birth</p>
            <p className="text-[13px] text-foreground">{learner.dateOfBirth} ({learner.age} years)</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Enrolled on</p>
            <p className="text-[13px] text-foreground">{learner.enrolledOn}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Attendance rate this term</p>
            <p className="text-[13px] text-foreground">{learner.attendanceRate}%</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">House</p>
            <p className="text-[13px] text-foreground">{learner.house}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="QR credential" description="Manage this learner's attendance card">
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-3">
            <QrPlaceholder seed={learner.qrSerial} />
            <div className="min-w-0">
              <p className="truncate font-mono text-[13px] font-semibold text-foreground">{learner.qrSerial}</p>
              <StatusBadge status={learner.qrStatus} className="mt-1" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => toast.success("Printing card", { description: "Sending the QR card to the default printer." })}>
              <Printer className="h-3.5 w-3.5" /> Print card
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => toast.success("Download started", { description: "The QR card image will download shortly." })}>
              <Download className="h-3.5 w-3.5" /> Download
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={onReplace}>
              <RefreshCcw className="h-3.5 w-3.5" /> Replace lost card
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-[12px] text-danger" onClick={onRevoke}>
              <ShieldAlert className="h-3.5 w-3.5" /> Revoke
            </Button>
          </div>
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-[11px] font-medium text-muted-foreground">Previous credentials</p>
            {loading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <ul className="space-y-2">
                {(credentials ?? []).map((c: any) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-[12px]">
                    <span className="min-w-0 truncate font-mono">{c.serial}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={c.status} />
                      <span className="text-muted-foreground">{c.issuedOn}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function AttendanceTab({ learnerId }: { learnerId: string }) {
  const query = useQuery({ queryKey: ["learner-attendance", learnerId], queryFn: () => learnerService.attendance(learnerId) });
  const chartData = useMemo(() => {
    const rows = query.data ?? [];
    const byDate: Record<string, { date: string; present: number; late: number; other: number }> = {};
    rows.forEach((r) => {
      byDate[r.date] ??= { date: r.date, present: 0, late: 0, other: 0 };
      if (r.status === "present") byDate[r.date]!.present += 1;
      else if (r.status === "late") byDate[r.date]!.late += 1;
      else byDate[r.date]!.other += 1;
    });
    return Object.values(byDate).slice(-14);
  }, [query.data]);

  if (query.isLoading) return <TableSkeleton rows={6} columns={5} />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  if (!query.data || query.data.length === 0) return <EmptyState title="No attendance recorded" description="No attendance events have been captured for this learner yet." icon={Calendar} />;

  return (
    <div className="space-y-4">
      <SectionCard title="Attendance trend" bodyClassName="p-3">
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="present" stackId="1" stroke="var(--color-success, #16a34a)" fill="var(--color-success, #16a34a)" fillOpacity={0.3} />
              <Area type="monotone" dataKey="late" stackId="1" stroke="#d97706" fill="#d97706" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>
      <SectionCard title="Recent attendance records">
        <div className="divide-y divide-border">
          {query.data.slice(0, 20).map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12px]">
              <span className="min-w-0 truncate text-foreground">{r.occasionName} · {r.date}</span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="text-muted-foreground">{r.scanTime ?? "—"}</span>
                <StatusBadge status={r.status} />
              </span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function AcademicsTab({ className }: { className: string }) {
  const subjectsQuery = useQuery({ queryKey: ["academics-subjects"], queryFn: () => academicsService.subjects() });
  const assessmentsQuery = useQuery({ queryKey: ["academics-assessments"], queryFn: () => academicsService.assessments() });
  if (subjectsQuery.isLoading || assessmentsQuery.isLoading) return <TableSkeleton rows={5} columns={4} />;
  if (subjectsQuery.isError || assessmentsQuery.isError) return <ErrorState onRetry={() => { void subjectsQuery.refetch(); void assessmentsQuery.refetch(); }} />;
  const subjects = (subjectsQuery.data ?? []).filter((s) => s.classes.includes(className));
  const assessments = (assessmentsQuery.data ?? []).filter((a) => a.className === className);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title="Subjects" description={`Subjects offered to ${className}`}>
        {subjects.length === 0 ? <EmptyState title="No subjects found" description="No subjects are mapped to this class yet." icon={Trophy} /> : (
          <ul className="divide-y divide-border">
            {subjects.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-2.5 text-[12px]">
                <span className="text-foreground">{s.name} <span className="text-muted-foreground">({s.code})</span></span>
                <span className="text-muted-foreground">{s.teacher}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <SectionCard title="Assessments" description="Class assessments and marks-entry status">
        {assessments.length === 0 ? <EmptyState title="No assessments" description="No assessments are scheduled for this class currently." icon={FileText} /> : (
          <ul className="divide-y divide-border">
            {assessments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[12px]">
                <span className="min-w-0 truncate text-foreground">{a.name} · {a.subject}</span>
                <StatusBadge status={a.status} tone={a.status === "published" ? "success" : a.status === "marks_entry" ? "warning" : "neutral"} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function ConductTab({ learnerId }: { learnerId: string }) {
  const query = useQuery({ queryKey: ["learner-cases", learnerId], queryFn: () => supportService.casesForLearner(learnerId) });
  if (query.isLoading) return <TableSkeleton rows={4} columns={4} />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  if (!query.data || query.data.length === 0) return <EmptyState title="No conduct cases" description="This learner has no recorded conduct cases." icon={ShieldCheck} />;
  return (
    <SectionCard title="Conduct cases">
      <ul className="divide-y divide-border">
        {query.data.map((c) => (
          <li key={c.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-medium text-foreground">{c.title} <span className="text-muted-foreground">({c.reference})</span></p>
              <StatusBadge status={c.stage} tone="neutral" />
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">{c.summary}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Opened {c.openedOn} · Reviewer {c.assignedReviewer}</p>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function WelfareTab({ learnerId }: { learnerId: string }) {
  const absencesQuery = useQuery({ queryKey: ["learner-absences", learnerId], queryFn: () => supportService.absencesForLearner(learnerId) });
  const obsQuery = useQuery({ queryKey: ["learner-observations", learnerId], queryFn: () => learnerService.observations(learnerId) });
  if (absencesQuery.isLoading || obsQuery.isLoading) return <TableSkeleton rows={4} columns={4} />;
  const concerns = (obsQuery.data ?? []).filter((o) => o.category === "Welfare concern");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title="Authorised absences">
        {(absencesQuery.data ?? []).length === 0 ? (
          <EmptyState title="No authorised absences" description="No absences have been authorised for this learner." icon={Calendar} />
        ) : (
          <ul className="divide-y divide-border">
            {absencesQuery.data!.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[12px]">
                <span className="text-foreground">{a.category} · {a.fromDate} – {a.toDate}</span>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <SectionCard title="Welfare concerns">
        {concerns.length === 0 ? (
          <EmptyState title="No welfare concerns recorded" description="No welfare concerns have been logged for this learner." icon={ShieldCheck} />
        ) : (
          <ul className="divide-y divide-border">
            {concerns.map((o) => (
              <li key={o.id} className="px-4 py-2.5 text-[12px]">
                <p className="text-foreground">{o.description}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{o.dateTime} · {o.recordedBy}</p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function HealthTab({ learnerId }: { learnerId: string }) {
  const query = useQuery({ queryKey: ["learner-health", learnerId], queryFn: () => supportService.healthForLearner(learnerId) });
  if (query.isLoading) return <TableSkeleton rows={4} columns={4} />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  if (!query.data || query.data.length === 0) return <EmptyState title="No health encounters" description="No sick bay visits have been recorded for this learner." icon={Stethoscope} />;
  return (
    <SectionCard title="Health encounters">
      <ul className="divide-y divide-border">
        {query.data.map((h) => (
          <li key={h.id} className="px-4 py-3 text-[12px]">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-foreground">{h.complaint}</p>
              <StatusBadge status={h.outcome} tone="neutral" />
            </div>
            <p className="mt-1 text-muted-foreground">{h.action} · Attended by {h.attendedBy}</p>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><HeartPulse className="h-3 w-3" /> {h.arrivedAt}</p>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function ParticipationTab({ learnerId }: { learnerId: string }) {
  const query = useQuery({ queryKey: ["learner-observations", learnerId], queryFn: () => learnerService.observations(learnerId) });
  if (query.isLoading) return <TableSkeleton rows={4} columns={3} />;
  const items = (query.data ?? []).filter((o) => o.category === "Positive conduct" || o.category === "General observation");
  if (items.length === 0) return <EmptyState title="No participation records" description="No clubs, sports or positive-conduct notes recorded yet." icon={Trophy} />;
  return (
    <SectionCard title="Participation & positive conduct">
      <ul className="divide-y divide-border">
        {items.map((o) => (
          <li key={o.id} className="px-4 py-2.5 text-[12px]">
            <p className="text-foreground">{o.description}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{o.dateTime} · {o.location}</p>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function InterventionsTab({ learnerId }: { learnerId: string }) {
  const query = useQuery({ queryKey: ["learner-interventions", learnerId], queryFn: () => supportService.interventionsForLearner(learnerId) });
  if (query.isLoading) return <TableSkeleton rows={4} columns={4} />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  if (!query.data || query.data.length === 0) return <EmptyState title="No interventions" description="No support interventions are currently open for this learner." icon={ShieldCheck} />;
  return (
    <SectionCard title="Interventions">
      <ul className="divide-y divide-border">
        {query.data.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[12px]">
            <div>
              <p className="text-foreground">{i.type} · {i.owner}</p>
              <p className="text-[11px] text-muted-foreground">{i.progressNote}</p>
            </div>
            <StatusBadge status={i.status} tone={i.status === "active" ? "info" : i.status === "overdue" ? "danger" : "success"} />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function DocumentsTab({ learnerId }: { learnerId: string }) {
  const query = useQuery({ queryKey: ["learner-documents", learnerId], queryFn: () => learnerService.documents(learnerId) });
  if (query.isLoading) return <TableSkeleton rows={4} columns={3} />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  return (
    <SectionCard title="Documents" action={
      <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => toast("Upload document", { description: "Choose a file to attach to this learner's record." })}>
        <FileText className="h-3.5 w-3.5" /> Upload
      </Button>
    }>
      {(query.data ?? []).length === 0 ? (
        <EmptyState title="No documents" description="No documents have been uploaded for this learner." icon={FileText} />
      ) : (
        <ul className="divide-y divide-border">
          {query.data!.map((d: any) => (
            <li key={d.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[12px]">
              <span className="min-w-0 truncate text-foreground">{d.name} <span className="text-muted-foreground">· {d.category}</span></span>
              <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                {d.uploadedOn}
                <Button size="icon" variant="ghost" className="h-6 w-6" aria-label={`Download ${d.name}`} onClick={() => toast.success("Download started", { description: d.name })}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function TimelineTab({ learnerId }: { learnerId: string }) {
  const obsQuery = useQuery({ queryKey: ["learner-observations", learnerId], queryFn: () => learnerService.observations(learnerId) });
  const attQuery = useQuery({ queryKey: ["learner-attendance", learnerId], queryFn: () => learnerService.attendance(learnerId) });
  if (obsQuery.isLoading || attQuery.isLoading) return <TableSkeleton rows={6} columns={2} />;
  const events = [
    ...((obsQuery.data ?? []).map((o) => ({ at: o.dateTime, label: `${o.category}: ${o.description}`, icon: FileText }))),
    ...((attQuery.data ?? []).slice(0, 10).map((a) => ({ at: `${a.date} ${a.scanTime ?? ""}`.trim(), label: `${a.occasionName} — ${a.status}`, icon: IdCard }))),
  ].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 30);
  if (events.length === 0) return <EmptyState title="No timeline events" description="No recorded activity for this learner yet." icon={Calendar} />;
  return (
    <SectionCard title="Timeline">
      <ol className="divide-y divide-border">
        {events.map((e, i) => (
          <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-[12px]">
            <e.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-foreground">{e.label}</p>
              <p className="text-[11px] text-muted-foreground">{e.at}</p>
            </div>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
