import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ArrowDownUp, Columns3, Download, Eye, IdCard, MessageCircle, PanelRightClose,
  QrCode, RotateCcw, Search, Upload, UserPlus, X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/Primitives";
import { EmptyState, ErrorState, SensitiveNotice, TableSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LearnerAvatar } from "@/components/common/LearnerAvatar";
import { TablePagination } from "@/components/common/TablePagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { learnerService, type LearnerQuery } from "@/services";
import { useAuth } from "@/lib/auth-context";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import type { Learner } from "@/types";

export const Route = createFileRoute("/learners/")({
  head: () => ({
    meta: [
      { title: "Learners — enrolment, QR cards and attendance" },
      {
        name: "description",
        content: "Search, filter and review every enrolled learner with QR card status, attendance and guardian contact.",
      },
      { property: "og:title", content: "Learners — enrolment, QR cards and attendance" },
      { property: "og:description", content: "Learner register with QR card status, attendance and guardian contact." },
    ],
  }),
  component: LearnersPage,
});

const CLASS_OPTIONS = ["Senior One", "Senior Two", "Senior Three", "Senior Four", "Senior Five", "Senior Six"];
const STREAM_OPTIONS = ["East", "West", "North", "South"];

const ALL_COLUMNS = [
  { key: "lin", label: "LIN" },
  { key: "stream", label: "Stream" },
  { key: "gender", label: "Gender" },
  { key: "residence", label: "Day/boarding" },
  { key: "todayStatus", label: "Today's status" },
  { key: "attendanceRate", label: "Attendance %" },
  { key: "qrStatus", label: "QR status" },
  { key: "guardian", label: "Guardian contact" },
] as const;
type ColumnKey = (typeof ALL_COLUMNS)[number]["key"];

const DEFAULT_FILTERS: LearnerQuery = {
  search: "", className: "all", stream: "all", residence: "all",
  gender: "all", status: "all", qrStatus: "all",
};

function LearnersPage() {
  const { can } = useAuth();
  const identityOnly = !can("learners.view") && can("learners.identity_only");
  const isWide = useMediaQuery("(min-width: 1280px)");

  const [filters, setFilters] = useState<LearnerQuery>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<keyof Learner>("fullName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [density, setDensity] = useState<"compact" | "comfortable">("compact");
  const [hidden, setHidden] = useState<ColumnKey[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const query = useQuery({
    queryKey: ["learners", filters, page, sortBy, sortDir],
    queryFn: () => learnerService.list({ ...filters, page, pageSize: 12, sortBy, sortDir }),
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.data ?? [];
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);
  const visible = (key: ColumnKey) => !hidden.includes(key) && !(identityOnly && ["attendanceRate", "guardian"].includes(key));

  const update = (patch: Partial<LearnerQuery>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const toggleSort = (key: keyof Learner) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const cellPad = density === "compact" ? "py-2" : "py-3.5";

  return (
    <AppShell permission={["learners.view", "learners.identity_only"]} area="the learner register">
      <PageHeader
        title="Learners"
        description={
          query.isLoading ? "Loading the learner register…" : `${query.data?.total ?? 0} learners match the current filters.`
        }
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={() => toast("Import learners", { description: "Upload a CSV file exported from your previous register." })}>
              <Upload className="h-3.5 w-3.5" /> Import CSV
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={() => toast.success("Export started", { description: "The learner register CSV will download shortly." })}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            {can("learners.manage") ? (
              <Button asChild size="sm" className="h-8 text-[12px]">
                <Link to="/learners/new">
                  <UserPlus className="h-3.5 w-3.5" /> Add learner
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      {identityOnly ? (
        <SensitiveNotice className="mb-3">
          Your role shows learner identity only. Attendance percentages, guardian contacts and welfare information are
          hidden.
        </SensitiveNotice>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="surface-card min-w-0 overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search learners"
                placeholder="Search by name, admission number or LIN"
                className="h-8 pl-8 text-[13px]"
                value={filters.search ?? ""}
                onChange={(e) => update({ search: e.target.value })}
              />
            </div>
            {[
              { label: "Class", key: "className" as const, options: CLASS_OPTIONS },
              { label: "Stream", key: "stream" as const, options: STREAM_OPTIONS },
              { label: "Residence", key: "residence" as const, options: ["Day", "Boarding"] },
              { label: "Gender", key: "gender" as const, options: ["Female", "Male"] },
              { label: "Status", key: "status" as const, options: ["active", "inactive", "transferred"] },
              { label: "QR card", key: "qrStatus" as const, options: ["active", "revoked", "not_issued"] },
            ].map((f) => (
              <Select key={f.key} value={(filters[f.key] as string) ?? "all"} onValueChange={(v) => update({ [f.key]: v })}>
                <SelectTrigger className="h-8 w-auto min-w-[110px] text-[12px]" aria-label={f.label}>
                  <SelectValue placeholder={f.label} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {f.label.toLowerCase()}</SelectItem>
                  {f.options.map((o) => (
                    <SelectItem key={o} value={o} className="capitalize">
                      {o.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
            <Button variant="ghost" size="sm" className="h-8 text-[12px]" onClick={() => { setFilters(DEFAULT_FILTERS); setPage(1); }}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-[12px]">
                  <Columns3 className="h-3.5 w-3.5" /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-[12px]">Visible columns</DropdownMenuLabel>
                {ALL_COLUMNS.map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.key}
                    checked={!hidden.includes(c.key)}
                    onCheckedChange={(checked) =>
                      setHidden((h) => (checked ? h.filter((k) => k !== c.key) : [...h, c.key]))
                    }
                  >
                    {c.label}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuLabel className="text-[12px]">Density</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={density} onValueChange={(v) => setDensity(v as "compact" | "comfortable")}>
                  <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Table */}
          {query.isError ? (
            <ErrorState onRetry={() => void query.refetch()} />
          ) : query.isLoading ? (
            <TableSkeleton rows={10} columns={7} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No learners match these filters"
              description="Adjust the search or filters, or reset them to see the full register."
              action={
                <Button variant="outline" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
                  Reset filters
                </Button>
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left">
                  <thead className="sticky top-14 z-10 bg-card">
                    <tr className="border-b border-border">
                      <th className="w-9 px-3 py-2">
                        <Checkbox aria-label="Select all learners on this page" />
                      </th>
                      <SortableHeader label="Student" active={sortBy === "fullName"} dir={sortDir} onClick={() => toggleSort("fullName")} />
                      <SortableHeader label="Admission no." active={sortBy === "admissionNumber"} dir={sortDir} onClick={() => toggleSort("admissionNumber")} />
                      {visible("lin") ? <Th>LIN</Th> : null}
                      <SortableHeader label="Class" active={sortBy === "className"} dir={sortDir} onClick={() => toggleSort("className")} />
                      {visible("stream") ? <Th>Stream</Th> : null}
                      {visible("gender") ? <Th>Gender</Th> : null}
                      {visible("residence") ? <Th>Day/boarding</Th> : null}
                      {visible("todayStatus") ? <Th>Today</Th> : null}
                      {visible("attendanceRate") ? (
                        <SortableHeader label="Attendance" active={sortBy === "attendanceRate"} dir={sortDir} onClick={() => toggleSort("attendanceRate")} />
                      ) : null}
                      {visible("qrStatus") ? <Th>QR card</Th> : null}
                      {visible("guardian") ? <Th>Guardian contact</Th> : null}
                      <Th className="text-right">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((l) => {
                      const isSelected = l.id === selectedId;
                      return (
                        <tr
                          key={l.id}
                          tabIndex={0}
                          onClick={() => { setSelectedId(l.id); setPanelOpen(true); }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedId(l.id);
                              setPanelOpen(true);
                            }
                          }}
                          className={cn(
                            "cursor-pointer border-b border-border/70 text-[12.5px] transition-colors outline-none",
                            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                            isSelected ? "bg-cyan text-white" : "hover:bg-accent/60",
                          )}
                        >
                          <td className={cn("px-3", cellPad)} onClick={(e) => e.stopPropagation()}>
                            <Checkbox aria-label={`Select ${l.fullName}`} />
                          </td>
                          <td className={cn("px-3", cellPad)}>
                            <div className="flex min-w-0 items-center gap-2.5">
                              <LearnerAvatar name={l.fullName} hue={l.photoHue} size={30} ring={isSelected} />
                              <div className="min-w-0">
                                <p className="truncate font-medium">{l.fullName}</p>
                                <p className={cn("truncate text-[11px]", isSelected ? "text-white/80" : "text-muted-foreground")}>
                                  {l.admissionNumber}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className={cn("px-3 whitespace-nowrap", cellPad)}>{l.admissionNumber}</td>
                          {visible("lin") ? <td className={cn("px-3 whitespace-nowrap", cellPad)}>{l.lin}</td> : null}
                          <td className={cn("px-3 whitespace-nowrap", cellPad)}>{l.className}</td>
                          {visible("stream") ? <td className={cn("px-3", cellPad)}>{l.stream}</td> : null}
                          {visible("gender") ? <td className={cn("px-3", cellPad)}>{l.gender}</td> : null}
                          {visible("residence") ? <td className={cn("px-3", cellPad)}>{l.residence}</td> : null}
                          {visible("todayStatus") ? (
                            <td className={cn("px-3", cellPad)}>
                              {isSelected ? (
                                <span className="text-[11px] font-medium capitalize">{l.todayStatus}</span>
                              ) : (
                                <StatusBadge status={l.todayStatus} />
                              )}
                            </td>
                          ) : null}
                          {visible("attendanceRate") ? (
                            <td className={cn("px-3", cellPad)}>
                              <div className="flex items-center gap-2">
                                <Progress value={l.attendanceRate} className={cn("h-1.5 w-14", isSelected && "bg-white/30")} />
                                <span className="text-[11px]">{l.attendanceRate}%</span>
                              </div>
                            </td>
                          ) : null}
                          {visible("qrStatus") ? (
                            <td className={cn("px-3", cellPad)}>
                              {isSelected ? (
                                <span className="text-[11px] font-medium capitalize">{l.qrStatus.replace("_", " ")}</span>
                              ) : (
                                <StatusBadge status={l.qrStatus} />
                              )}
                            </td>
                          ) : null}
                          {visible("guardian") ? (
                            <td className={cn("px-3 whitespace-nowrap", cellPad)}>
                              <p className="truncate">{l.guardian.name}</p>
                              <p className={cn("text-[11px]", isSelected ? "text-white/80" : "text-muted-foreground")}>
                                {l.guardian.phone}
                              </p>
                            </td>
                          ) : null}
                          <td className={cn("px-3 text-right whitespace-nowrap", cellPad)} onClick={(e) => e.stopPropagation()}>
                            <Button asChild variant="ghost" size="icon" className={cn("h-7 w-7", isSelected && "text-white hover:bg-white/20")}>
                              <Link to="/learners/$id" params={{ id: l.id }} aria-label={`Open ${l.fullName}'s profile`}>
                                <Eye className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <TablePagination
                page={page}
                pageSize={query.data?.pageSize ?? 12}
                total={query.data?.total ?? 0}
                onPageChange={setPage}
              />
            </>
          )}
        </div>

        {/* Details panel — desktop */}
        <aside className="hidden xl:block">
          {panelOpen ? (
            <div className="sticky top-[72px]">
              <LearnerPanel learner={selected} identityOnly={identityOnly} onClose={() => setPanelOpen(false)} />
            </div>
          ) : (
            <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={() => setPanelOpen(true)}>
              <PanelRightClose className="h-3.5 w-3.5 rotate-180" /> Show details panel
            </Button>
          )}
        </aside>
      </div>

      {/* Details drawer — tablet and mobile */}
      <Sheet open={!isWide && !!selected && panelOpen} onOpenChange={(o) => setPanelOpen(o)}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-md">
          <SheetTitle className="sr-only">Learner details</SheetTitle>
          <LearnerPanel learner={selected} identityOnly={identityOnly} onClose={() => setPanelOpen(false)} embedded />
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase", className)}>
      {children}
    </th>
  );
}

function SortableHeader({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  return (
    <th className="px-3 py-2">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
        <ArrowDownUp className={cn("h-3 w-3", active && dir === "desc" && "rotate-180")} />
      </button>
    </th>
  );
}

function LearnerPanel({
  learner,
  identityOnly,
  onClose,
  embedded,
}: {
  learner: Learner | null;
  identityOnly: boolean;
  onClose: () => void;
  embedded?: boolean;
}) {
  if (!learner) {
    return (
      <div className={cn(!embedded && "surface-card")}>
        <EmptyState
          icon={IdCard}
          title="No learner selected"
          description="Select a row in the register to see the learner's photograph, identity and support summary."
        />
      </div>
    );
  }

  const facts: [string, string][] = [
    ["Class and stream", `${learner.className} ${learner.stream}`],
    ["Today", learner.todayStatus],
    ["QR card", learner.qrStatus.replace("_", " ")],
    ["Residence", learner.residence],
    ["Age", `${learner.age} years`],
    ["House", learner.house],
    ["Dormitory", learner.dormitory ?? "Not applicable"],
    ["LIN", learner.lin],
  ];

  return (
    <div className={cn("overflow-hidden", !embedded && "surface-card")}>
      <div className="relative border-b border-border px-4 pt-6 pb-4 text-center">
        <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7" aria-label="Close details panel" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground">{learner.admissionNumber}</p>
        <div className="mt-3 flex justify-center">
          <LearnerAvatar name={learner.fullName} hue={learner.photoHue} size={96} />
        </div>
        <h2 className="mt-3 text-[16px] font-semibold">{learner.fullName}</h2>
        <p className="text-[12px] text-muted-foreground">
          {learner.className} {learner.stream} · {learner.residence}
        </p>
        <div className="mt-3 flex justify-center gap-1.5">
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Contact guardian" onClick={() => toast.success(`Calling ${learner.guardian.phone}`)}>
            <MessageCircle className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="View QR card" onClick={() => toast("QR card", { description: `Serial ${learner.qrSerial}` })}>
            <QrCode className="h-3.5 w-3.5" />
          </Button>
          <Button asChild variant="outline" size="icon" className="h-8 w-8" aria-label="Open full profile">
            <Link to="/learners/$id" params={{ id: learner.id }}>
              <Eye className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="px-4 py-3">
        <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">About</p>
        <dl className="grid grid-cols-2 gap-y-2.5">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] text-muted-foreground">{k}</dt>
              <dd className="text-[12.5px] font-medium capitalize">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {identityOnly ? (
        <div className="px-4 pb-4">
          <SensitiveNotice>
            Guardian contact, attendance history and welfare notes are restricted for your role.
          </SensitiveNotice>
        </div>
      ) : (
        <>
          <div className="border-t border-border px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Attendance</p>
            <div className="flex items-center gap-2">
              <Progress value={learner.attendanceRate} className="h-1.5 flex-1" />
              <span className="text-[12px] font-semibold">{learner.attendanceRate}%</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Term Two 2026 to date</p>
          </div>

          <div className="border-t border-border px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Guardian</p>
            <p className="text-[12.5px] font-medium">{learner.guardian.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {learner.guardian.relationship} · {learner.guardian.phone}
            </p>
            <p className="mt-2 text-[12.5px] font-medium">{learner.emergencyContact.name}</p>
            <p className="text-[11px] text-muted-foreground">
              Emergency · {learner.emergencyContact.phone}
            </p>
          </div>

          <div className="border-t border-border px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Quick actions</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                ["Record attendance", "/attendance"],
                ["Record observation", "/observations"],
                ["Authorise absence", "/welfare"],
                ["Full profile", `/learners/${learner.id}`],
              ].map(([label, to]) => (
                <Button key={label} asChild variant="outline" size="sm" className="h-8 justify-start text-[12px]">
                  <Link to={to as string}>{label}</Link>
                </Button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
