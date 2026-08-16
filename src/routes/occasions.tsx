import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  LayoutGrid,
  ListFilter,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Square,
  Table as TableIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, SectionCard } from "@/components/common/Primitives";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LearnerAvatar } from "@/components/common/LearnerAvatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { attendanceService, learnerService } from "@/services";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { AttendanceOccasion, OccasionCategory } from "@/types";

export const Route = createFileRoute("/occasions")({
  head: () => ({
    meta: [
      { title: "Attendance occasions — gates, assemblies, lessons and more" },
      {
        name: "description",
        content:
          "Manage attendance occasions across gates, assemblies, lessons, dormitories, dining and transport.",
      },
      { property: "og:title", content: "Attendance occasions" },
      {
        property: "og:description",
        content: "Create, monitor and reconcile attendance occasions campus-wide.",
      },
    ],
  }),
  component: OccasionsPage,
});

const CATEGORIES: OccasionCategory[] = [
  "Gate entry",
  "Gate exit",
  "Morning assembly",
  "Evening assembly",
  "Class lesson",
  "Examination",
  "Morning prep",
  "Evening prep",
  "Dormitory roll call",
  "Dining",
  "Sick bay",
  "Transport",
  "Sports",
  "Clubs",
  "Trips",
  "Official duty",
];
const STATUSES: AttendanceOccasion["status"][] = [
  "scheduled",
  "active",
  "paused",
  "closed",
  "reconciled",
];

const occasionSchema = z.object({
  name: z.string().min(3, "Enter a descriptive occasion name"),
  category: z.enum(CATEGORIES as [OccasionCategory, ...OccasionCategory[]]),
  date: z.string().min(1, "Select a date"),
  startTime: z.string().min(1, "Enter a start time"),
  endTime: z.string().min(1, "Enter an end time"),
  location: z.string().min(2, "Enter a location"),
  responsibleStaff: z.string().min(2, "Assign a responsible staff member"),
  expected: z.coerce.number().int().min(1, "Expected group size must be at least 1"),
});
type OccasionForm = z.infer<typeof occasionSchema>;

function completion(o: AttendanceOccasion) {
  return o.expected > 0 ? Math.round((o.scanned / o.expected) * 100) : 0;
}

function OccasionsPage() {
  const { can } = useAuth();
  const canManage = can("occasions.manage");
  const queryClient = useQueryClient();

  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [detail, setDetail] = useState<AttendanceOccasion | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reopenTarget, setReopenTarget] = useState<AttendanceOccasion | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [overrides, setOverrides] = useState<Record<string, AttendanceOccasion["status"]>>({});

  const occasionsQuery = useQuery({
    queryKey: ["occasions-list"],
    queryFn: () => attendanceService.occasions(),
  });
  const learnersQuery = useQuery({
    queryKey: ["learners-mini"],
    queryFn: () => learnerService.list({ pageSize: 8 }),
  });

  const occasions = useMemo(
    () => (occasionsQuery.data ?? []).map((o) => ({ ...o, status: overrides[o.id] ?? o.status })),
    [occasionsQuery.data, overrides],
  );

  const filtered = occasions.filter((o) => {
    if (category !== "all" && o.category !== category) return false;
    if (status !== "all" && o.status !== status) return false;
    return true;
  });

  const setOccasionStatus = (
    o: AttendanceOccasion,
    next: AttendanceOccasion["status"],
    message: string,
  ) => {
    setOverrides((prev) => ({ ...prev, [o.id]: next }));
    toast.success(message, { description: o.name });
  };

  const form = useForm<OccasionForm>({
    resolver: zodResolver(occasionSchema),
    defaultValues: {
      name: "",
      category: "Class lesson",
      date: "2026-08-03",
      startTime: "08:00",
      endTime: "09:00",
      location: "",
      responsibleStaff: "",
      expected: 40,
    },
  });

  const onCreate = (values: OccasionForm) => {
    const newOccasion: AttendanceOccasion = {
      id: `occ-new-${Date.now()}`,
      name: values.name,
      category: values.category,
      date: values.date,
      startTime: values.startTime,
      endTime: values.endTime,
      expected: values.expected,
      scanned: 0,
      responsibleStaff: values.responsibleStaff,
      location: values.location,
      status: "scheduled",
    };
    queryClient.setQueryData<AttendanceOccasion[]>(["occasions-list"], (prev) => [
      newOccasion,
      ...(prev ?? []),
    ]);
    toast.success("Occasion created", { description: `${newOccasion.name} has been scheduled.` });
    setCreateOpen(false);
    form.reset();
  };

  const confirmReopen = () => {
    if (!reopenTarget) return;
    if (!reopenReason.trim()) {
      toast.error("A reason is required to reopen a closed occasion");
      return;
    }
    setOccasionStatus(reopenTarget, "active", `${reopenTarget.name} reopened`);
    setReopenTarget(null);
    setReopenReason("");
  };

  const sampleLearners = learnersQuery.data?.data ?? [];

  return (
    <AppShell permission={["attendance.view", "occasions.manage"]} area="attendance occasions">
      <PageHeader
        title="Attendance occasions"
        description={
          occasionsQuery.isLoading
            ? "Loading occasions…"
            : `${filtered.length} occasion${filtered.length === 1 ? "" : "s"} match the current filters.`
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[12px]"
              onClick={() =>
                toast.success("Export started", {
                  description: "Occasion register CSV will download shortly.",
                })
              }
            >
              <Download className="h-3.5 w-3.5" /> Export register
            </Button>
            {canManage ? (
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-8 text-[12px]">
                    <Plus className="h-3.5 w-3.5" /> Create occasion
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create attendance occasion</DialogTitle>
                    <DialogDescription>
                      Schedule a new occasion for gate, assembly, lesson, dormitory or another
                      checkpoint.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onCreate)} className="grid gap-3.5">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Occasion name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Senior Three geography lesson" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {CATEGORIES.map((c) => (
                                    <SelectItem key={c} value={c}>
                                      {c}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="startTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Start time</FormLabel>
                              <FormControl>
                                <Input type="time" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="endTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>End time</FormLabel>
                              <FormControl>
                                <Input type="time" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Laboratory 2" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="responsibleStaff"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Responsible staff</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Grace Nakabugo" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="expected"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expected group size</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCreateOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">Create occasion</Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            ) : null}
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ListFilter className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-8 w-auto min-w-[150px] text-[12px]" aria-label="Category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 w-auto min-w-[120px] text-[12px]" aria-label="Status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-[12px]"
          onClick={() => {
            setCategory("all");
            setStatus("all");
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </Button>
        <div className="ml-auto flex items-center gap-1 rounded-md border border-border p-0.5">
          <Button
            variant={view === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            aria-label="Grid view"
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={view === "table" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            aria-label="Table view"
            onClick={() => setView("table")}
          >
            <TableIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {occasionsQuery.isError ? (
        <ErrorState onRetry={() => void occasionsQuery.refetch()} />
      ) : occasionsQuery.isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No occasions match these filters"
          description="Adjust the category or status filters, or create a new occasion."
        />
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((o) => {
            const pct = completion(o);
            return (
              <div key={o.id} className="surface-card flex flex-col p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold text-foreground">{o.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {o.category} · {o.date} · {o.startTime}–{o.endTime}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {o.responsibleStaff} · {o.location}
                </p>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {o.scanned} / {o.expected} scanned
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <Progress value={pct} className="mt-1 h-1.5" />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => setDetail(o)}
                  >
                    <Eye className="h-3 w-3" /> View
                  </Button>
                  {canManage && o.status === "scheduled" ? (
                    <Button
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => setOccasionStatus(o, "active", "Occasion started")}
                    >
                      <Play className="h-3 w-3" /> Start
                    </Button>
                  ) : null}
                  {canManage && o.status === "active" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => setOccasionStatus(o, "paused", "Occasion paused")}
                    >
                      <Pause className="h-3 w-3" /> Pause
                    </Button>
                  ) : null}
                  {canManage && o.status === "paused" ? (
                    <Button
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => setOccasionStatus(o, "active", "Occasion resumed")}
                    >
                      <Play className="h-3 w-3" /> Resume
                    </Button>
                  ) : null}
                  {canManage && (o.status === "active" || o.status === "paused") ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => setOccasionStatus(o, "closed", "Occasion closed")}
                    >
                      <Square className="h-3 w-3" /> Close
                    </Button>
                  ) : null}
                  {canManage && o.status === "closed" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => setReopenTarget(o)}
                    >
                      <RotateCcw className="h-3 w-3" /> Reopen
                    </Button>
                  ) : null}
                  {canManage && o.status === "closed" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => setOccasionStatus(o, "reconciled", "Occasion reconciled")}
                    >
                      <ClipboardCheck className="h-3 w-3" /> Reconcile
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() =>
                      toast.success("Export started", {
                        description: `${o.name} register CSV will download shortly.`,
                      })
                    }
                  >
                    <Download className="h-3 w-3" /> Export
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <SectionCard className="min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Occasion</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Completion</th>
                  <th className="px-3 py-2 font-medium">Responsible staff</th>
                  <th className="px-3 py-2 font-medium">Location</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((o) => {
                  const pct = completion(o);
                  return (
                    <tr key={o.id} className="hover:bg-muted/40">
                      <td className="px-3 py-2 font-medium text-foreground">{o.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{o.category}</td>
                      <td className="px-3 py-2 text-muted-foreground">{o.date}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {o.startTime}–{o.endTime}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-1.5 w-16" />
                          <span>{pct}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{o.responsibleStaff}</td>
                      <td className="px-3 py-2 text-muted-foreground">{o.location}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() => setDetail(o)}
                        >
                          <Eye className="h-3 w-3" /> View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {detail ? (
            <div className="flex h-full flex-col">
              <SheetHeader>
                <SheetTitle>{detail.name}</SheetTitle>
                <SheetDescription>
                  {detail.category} · {detail.date} · {detail.startTime}–{detail.endTime} ·{" "}
                  {detail.location}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
                <div className="surface-card p-3">
                  <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                    <span>
                      {detail.scanned} of {detail.expected} scanned
                    </span>
                    <span>{completion(detail)}%</span>
                  </div>
                  <Progress value={completion(detail)} className="mt-1.5 h-1.5" />
                </div>
                <div>
                  <p className="mb-2 text-[12px] font-semibold text-foreground">Scanned</p>
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {sampleLearners.slice(0, 4).map((l) => (
                      <li key={l.id} className="flex items-center gap-2 px-3 py-2">
                        <LearnerAvatar name={l.fullName} hue={l.photoHue} size={26} />
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-medium text-foreground">
                            {l.fullName}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {l.admissionNumber} · {l.className}
                          </p>
                        </div>
                        <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-success" />
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-[12px] font-semibold text-foreground">Not yet scanned</p>
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {sampleLearners.slice(4, 8).map((l) => (
                      <li key={l.id} className="flex items-center gap-2 px-3 py-2">
                        <LearnerAvatar name={l.fullName} hue={l.photoHue} size={26} />
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-medium text-foreground">
                            {l.fullName}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {l.admissionNumber} · {l.className}
                          </p>
                        </div>
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          Not scanned
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={!!reopenTarget} onOpenChange={(open) => !open && setReopenTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reopen {reopenTarget?.name}</DialogTitle>
            <DialogDescription>
              Reopening a closed occasion requires a reason for the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="reopen-reason">Reason for reopening</Label>
            <Textarea
              id="reopen-reason"
              placeholder="e.g. Additional learners need to be marked after a device outage"
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenTarget(null)}>
              Cancel
            </Button>
            <Button onClick={confirmReopen}>Reopen occasion</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
