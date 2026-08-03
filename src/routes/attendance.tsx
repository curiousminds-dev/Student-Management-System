import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarIcon, CheckCircle2, ClipboardCheck, Clock, Download, Printer, RotateCcw,
  Search, ShieldQuestion, Users, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { MetricCard, PageHeader, SectionCard } from "@/components/common/Primitives";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LearnerAvatar } from "@/components/common/LearnerAvatar";
import { TablePagination } from "@/components/common/TablePagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { attendanceService, deviceService } from "@/services";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { AttendanceRecord } from "@/types";

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — daily register and reconciliation" },
      {
        name: "description",
        content: "Review today's attendance, recent scans, unreconciled absences and device synchronisation status.",
      },
      { property: "og:title", content: "Attendance — daily register and reconciliation" },
      { property: "og:description", content: "Attendance workspace with reconciliation and device sync summaries." },
    ],
  }),
  component: AttendancePage,
});

const CLASS_OPTIONS = ["Senior One", "Senior Two", "Senior Three", "Senior Four", "Senior Five", "Senior Six"];
const STATUS_OPTIONS: AttendanceRecord["status"][] = ["present", "late", "excused", "unexplained", "pending"];
const PAGE_SIZE = 10;

function AttendancePage() {
  const { can } = useAuth();
  const canRecord = can("attendance.record");

  const [date, setDate] = useState<Date>(new Date(2026, 7, 3));
  const [className, setClassName] = useState("all");
  const [occasionId, setOccasionId] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tab, setTab] = useState("today");
  const [reconciledOverrides, setReconciledOverrides] = useState<Record<string, AttendanceRecord["reconciliation"]>>({});

  const recordsQuery = useQuery({
    queryKey: ["attendance-records", className, status, occasionId, search],
    queryFn: () => attendanceService.records({ search, className, status, occasionId }),
  });
  const occasionsQuery = useQuery({ queryKey: ["attendance-occasions"], queryFn: () => attendanceService.occasions() });
  const scansQuery = useQuery({ queryKey: ["attendance-scans"], queryFn: () => attendanceService.scans() });
  const devicesQuery = useQuery({ queryKey: ["devices"], queryFn: () => deviceService.list() });
  const historyQuery = useQuery({ queryKey: ["device-sync-history"], queryFn: () => deviceService.history() });

  const records = useMemo(
    () => (recordsQuery.data ?? []).map((r) => ({ ...r, reconciliation: reconciledOverrides[r.id] ?? r.reconciliation })),
    [recordsQuery.data, reconciledOverrides],
  );

  const summary = useMemo(() => {
    const src = recordsQuery.data ?? [];
    const expected = src.length;
    const present = src.filter((r) => r.status === "present").length;
    const late = src.filter((r) => r.status === "late").length;
    const excused = src.filter((r) => r.status === "excused").length;
    const unexplained = src.filter((r) => r.status === "unexplained").length;
    const pending = src.filter((r) => (reconciledOverrides[r.id] ?? r.reconciliation) === "pending").length;
    return { expected, present, late, excused, unexplained, pending };
  }, [recordsQuery.data, reconciledOverrides]);

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const pageRows = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pendingIds = pageRows.filter((r) => r.reconciliation === "pending").map((r) => r.id);
  const allPagePendingSelected = pendingIds.length > 0 && pendingIds.every((id) => selected.includes(id));

  const toggleSelectAll = () => {
    setSelected((prev) =>
      allPagePendingSelected ? prev.filter((id) => !pendingIds.includes(id)) : Array.from(new Set([...prev, ...pendingIds])),
    );
  };

  const confirmReconcile = () => {
    setReconciledOverrides((prev) => {
      const next = { ...prev };
      selected.forEach((id) => { next[id] = "reconciled"; });
      return next;
    });
    toast.success("Attendance reconciled", { description: `${selected.length} record${selected.length === 1 ? "" : "s"} marked as reconciled.` });
    setSelected([]);
    setConfirmOpen(false);
  };

  const unreconciled = records.filter((r) => r.reconciliation === "pending");
  const activeOccasions = (occasionsQuery.data ?? []).filter((o) => o.status === "active" || o.status === "paused");
  const closedOccasions = (occasionsQuery.data ?? []).filter((o) => o.status === "closed" || o.status === "reconciled");

  const resetFilters = () => {
    setClassName("all");
    setOccasionId("all");
    setStatus("all");
    setSearch("");
    setPage(1);
  };

  return (
    <AppShell permission={["attendance.view", "attendance.record"]} area="the attendance workspace">
      <PageHeader
        title="Attendance"
        description={recordsQuery.isLoading ? "Loading today's attendance…" : `${summary.expected} learners expected across today's occasions.`}
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[12px]"
              onClick={() => toast.success("Export started", { description: "The attendance register CSV will download shortly." })}
            >
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Expected" value={summary.expected} icon={Users} tone="navy" />
        <MetricCard label="Present" value={summary.present} icon={CheckCircle2} tone="success" />
        <MetricCard label="Late" value={summary.late} icon={Clock} tone="warning" />
        <MetricCard label="Excused" value={summary.excused} icon={ClipboardCheck} tone="info" />
        <MetricCard label="Unexplained" value={summary.unexplained} icon={XCircle} tone="warning" />
        <MetricCard label="Pending reconciliation" value={summary.pending} icon={ShieldQuestion} tone="navy" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-3 flex-wrap">
          <TabsTrigger value="today">Today's attendance</TabsTrigger>
          <TabsTrigger value="scans">Recent scans</TabsTrigger>
          <TabsTrigger value="unreconciled">Unreconciled absences</TabsTrigger>
          <TabsTrigger value="active">Active occasions</TabsTrigger>
          <TabsTrigger value="closed">Closed occasions</TabsTrigger>
          <TabsTrigger value="devices">Device synchronisation</TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <SectionCard className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Search attendance records"
                  placeholder="Search by learner name or admission number"
                  className="h-8 pl-8 text-[13px]"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-[12px]">
                    <CalendarIcon className="h-3.5 w-3.5" /> {format(date, "d MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} />
                </PopoverContent>
              </Popover>
              <Select value={className} onValueChange={(v) => { setClassName(v); setPage(1); }}>
                <SelectTrigger className="h-8 w-auto min-w-[110px] text-[12px]" aria-label="Class"><SelectValue placeholder="Class" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {CLASS_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={occasionId} onValueChange={(v) => { setOccasionId(v); setPage(1); }}>
                <SelectTrigger className="h-8 w-auto min-w-[140px] text-[12px]" aria-label="Occasion"><SelectValue placeholder="Occasion" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All occasions</SelectItem>
                  {(occasionsQuery.data ?? []).map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="h-8 w-auto min-w-[110px] text-[12px]" aria-label="Status"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="h-8 text-[12px]" onClick={resetFilters}>
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
              {canRecord ? (
                <Button
                  size="sm"
                  className="ml-auto h-8 text-[12px]"
                  disabled={selected.length === 0}
                  onClick={() => setConfirmOpen(true)}
                >
                  <ClipboardCheck className="h-3.5 w-3.5" /> Reconcile selected ({selected.length})
                </Button>
              ) : null}
            </div>

            {recordsQuery.isError ? (
              <ErrorState onRetry={() => void recordsQuery.refetch()} />
            ) : recordsQuery.isLoading ? (
              <TableSkeleton rows={8} columns={9} />
            ) : pageRows.length === 0 ? (
              <EmptyState title="No attendance records match these filters" description="Adjust the search or filters to see more results." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="w-9 px-3 py-2">
                        {canRecord ? (
                          <Checkbox
                            aria-label="Select all pending on this page"
                            checked={allPagePendingSelected}
                            disabled={pendingIds.length === 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        ) : null}
                      </th>
                      <th className="px-3 py-2 font-medium">Learner</th>
                      <th className="px-3 py-2 font-medium">Admission no.</th>
                      <th className="px-3 py-2 font-medium">Class</th>
                      <th className="px-3 py-2 font-medium">Occasion</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Scan time</th>
                      <th className="px-3 py-2 font-medium">Device</th>
                      <th className="px-3 py-2 font-medium">Recorded by</th>
                      <th className="px-3 py-2 font-medium">Reconciliation</th>
                      <th className="px-3 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pageRows.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/40">
                        <td className="px-3 py-2">
                          {canRecord ? (
                            <Checkbox
                              aria-label={`Select ${r.learnerName}`}
                              checked={selected.includes(r.id)}
                              disabled={r.reconciliation !== "pending"}
                              onCheckedChange={(c) =>
                                setSelected((prev) => (c ? [...prev, r.id] : prev.filter((id) => id !== r.id)))
                              }
                            />
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <LearnerAvatar name={r.learnerName} hue={r.photoHue} size={26} />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{r.learnerName}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{r.admissionNumber}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{r.admissionNumber}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.className} {r.stream}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.occasionName}</td>
                        <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                        <td className="px-3 py-2 text-muted-foreground">{r.scanTime ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.deviceName ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.recordedBy}</td>
                        <td className="px-3 py-2"><StatusBadge status={r.reconciliation} tone={r.reconciliation === "pending" ? "pending" : r.reconciliation === "reconciled" ? "success" : "neutral"} /></td>
                        <td className="px-3 py-2 text-right">
                          {canRecord && r.reconciliation === "pending" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px]"
                              onClick={() => { setSelected([r.id]); setConfirmOpen(true); }}
                            >
                              Reconcile
                            </Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {records.length > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={records.length} onPageChange={setPage} />
            ) : null}
          </SectionCard>
        </TabsContent>

        <TabsContent value="scans">
          <SectionCard title="Recent scans" description="Most recent scan events received from devices across campus.">
            {scansQuery.isLoading ? (
              <TableSkeleton rows={6} columns={6} />
            ) : (scansQuery.data ?? []).length === 0 ? (
              <EmptyState title="No scans recorded yet" description="Scans will appear here as devices submit attendance events." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Learner</th>
                      <th className="px-3 py-2 font-medium">Class</th>
                      <th className="px-3 py-2 font-medium">Occasion</th>
                      <th className="px-3 py-2 font-medium">Scan time</th>
                      <th className="px-3 py-2 font-medium">Device</th>
                      <th className="px-3 py-2 font-medium">Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(scansQuery.data ?? []).slice(0, 30).map((s) => (
                      <tr key={s.id} className="hover:bg-muted/40">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <LearnerAvatar name={s.learnerName} size={24} />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{s.learnerName}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{s.admissionNumber}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{s.className}</td>
                        <td className="px-3 py-2 text-muted-foreground">{s.occasionName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{s.scanTime}</td>
                        <td className="px-3 py-2 text-muted-foreground">{s.deviceName}</td>
                        <td className="px-3 py-2">
                          <StatusBadge
                            status={s.outcome}
                            tone={s.outcome === "accepted" ? "success" : s.outcome === "late" ? "late" : s.outcome === "duplicate" ? "warning" : "danger"}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="unreconciled">
          <SectionCard title="Unreconciled absences" description="Unexplained or pending records awaiting review by a member of staff.">
            {unreconciled.length === 0 ? (
              <EmptyState title="Nothing to reconcile" description="Every attendance record for the selected filters has been reconciled." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Learner</th>
                      <th className="px-3 py-2 font-medium">Class</th>
                      <th className="px-3 py-2 font-medium">Occasion</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {unreconciled.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/40">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <LearnerAvatar name={r.learnerName} hue={r.photoHue} size={24} />
                            <span className="font-medium text-foreground">{r.learnerName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{r.className} {r.stream}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.occasionName}</td>
                        <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                        <td className="px-3 py-2 text-right">
                          {canRecord ? (
                            <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => { setSelected([r.id]); setConfirmOpen(true); }}>
                              Reconcile
                            </Button>
                          ) : <span className="text-[11px] text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="active">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activeOccasions.length === 0 ? (
              <EmptyState title="No active occasions" description="There are no attendance occasions currently in progress." />
            ) : activeOccasions.map((o) => (
              <div key={o.id} className="surface-card p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold text-foreground">{o.name}</p>
                    <p className="text-[11px] text-muted-foreground">{o.category} · {o.startTime}–{o.endTime}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">{o.responsibleStaff} · {o.location}</p>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{o.scanned} / {o.expected} scanned</span>
                    <span>{Math.round((o.scanned / o.expected) * 100)}%</span>
                  </div>
                  <Progress value={Math.round((o.scanned / o.expected) * 100)} className="mt-1 h-1.5" />
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="closed">
          <SectionCard title="Closed occasions" description="Occasions that have ended and are awaiting or have completed reconciliation.">
            {closedOccasions.length === 0 ? (
              <EmptyState title="No closed occasions" description="Closed occasions for the selected date will appear here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Occasion</th>
                      <th className="px-3 py-2 font-medium">Category</th>
                      <th className="px-3 py-2 font-medium">Completion</th>
                      <th className="px-3 py-2 font-medium">Responsible staff</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {closedOccasions.map((o) => (
                      <tr key={o.id} className="hover:bg-muted/40">
                        <td className="px-3 py-2 font-medium text-foreground">{o.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{o.category}</td>
                        <td className="px-3 py-2 text-muted-foreground">{o.scanned}/{o.expected} ({Math.round((o.scanned / o.expected) * 100)}%)</td>
                        <td className="px-3 py-2 text-muted-foreground">{o.responsibleStaff}</td>
                        <td className="px-3 py-2"><StatusBadge status={o.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="devices">
          <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
            <SectionCard title="Devices" description="Scanning devices and their synchronisation state.">
              {devicesQuery.isLoading ? <TableSkeleton rows={5} columns={5} /> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-[12.5px]">
                    <thead>
                      <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Device</th>
                        <th className="px-3 py-2 font-medium">Location</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Pending</th>
                        <th className="px-3 py-2 font-medium">Last sync</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(devicesQuery.data ?? []).map((d) => (
                        <tr key={d.id} className="hover:bg-muted/40">
                          <td className="px-3 py-2 font-medium text-foreground">{d.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{d.location}</td>
                          <td className="px-3 py-2"><StatusBadge status={d.status} /></td>
                          <td className="px-3 py-2 text-muted-foreground">{d.pendingRecords}</td>
                          <td className="px-3 py-2 text-muted-foreground">{d.lastSync}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
            <SectionCard title="Sync history" description="Recent synchronisation batches from every device.">
              {historyQuery.isLoading ? <TableSkeleton rows={5} columns={4} /> : (
                <ul className="divide-y divide-border">
                  {(historyQuery.data ?? []).slice(0, 12).map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium text-foreground">{h.deviceName}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{h.detail}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <StatusBadge status={h.result} tone={h.result === "success" ? "success" : h.result === "failed" ? "danger" : "warning"} />
                        <p className="mt-0.5 text-[10.5px] text-muted-foreground">{h.at}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reconcile {selected.length} attendance record{selected.length === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This marks the selected records as reconciled. This action should only be taken once the absence or
              discrepancy has been verified with the class teacher, warden or guardian.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReconcile}>Reconcile</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
