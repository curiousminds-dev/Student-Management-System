import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CalendarPlus,
  ClipboardCheck,
  Eye,
  FileBarChart,
  RefreshCw,
  ScanLine,
  Tablet,
  UserPlus,
  Users,
  Upload,
  UserCog,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MetricCard, PageHeader, QuickLink, SectionCard } from "@/components/common/Primitives";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { dashboardService } from "@/services";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Nile Crest attendance and welfare overview" },
      {
        name: "description",
        content:
          "Daily attendance, welfare and device overview for Nile Crest Secondary School administrators and staff.",
      },
      { property: "og:title", content: "Dashboard — Nile Crest attendance and welfare overview" },
      {
        property: "og:description",
        content: "Daily attendance, welfare and device overview for school staff.",
      },
    ],
  }),
  component: DashboardPage,
});

const CHART_COLORS = ["var(--navy)", "var(--cyan)", "var(--success)", "var(--warning)"];

const QUICK_ACTIONS = [
  { label: "Add learner", to: "/learners/new", icon: UserPlus },
  { label: "Import learners", to: "/learners", icon: Upload },
  { label: "Create occasion", to: "/occasions", icon: CalendarPlus },
  { label: "Start scanning", to: "/scan", icon: ScanLine },
  { label: "Record observation", to: "/observations", icon: Eye },
  { label: "Authorise absence", to: "/welfare", icon: ClipboardCheck },
  { label: "Generate report", to: "/reports", icon: FileBarChart },
  { label: "Add staff member", to: "/staff", icon: UserCog },
];

function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard", user?.role],
    queryFn: () => dashboardService.summary(user?.roleName ?? "Administrator"),
  });

  return (
    <AppShell permission="dashboard.view" area="the dashboard">
      <PageHeader
        title={`Good morning, ${user?.name.split(" ")[0] ?? "there"}`}
        description={
          isLoading
            ? "Loading today's school attendance and learner-support overview…"
            : `${data?.date} · ${data?.term} — here is today's school attendance and learner-support overview.`
        }
      />

      {isError ? (
        <div className="surface-card">
          <ErrorState onRetry={() => void refetch()} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-[92px] rounded-lg" />
                ))
              : data!.metrics.map((m) => (
                  <MetricCard
                    key={m.key}
                    label={m.label}
                    value={m.value}
                    change={m.change}
                    trend={m.trend}
                    tone={m.tone}
                    icon={
                      m.key === "learners"
                        ? Users
                        : m.key === "devices"
                          ? Tablet
                          : m.key === "unexplained"
                            ? AlertTriangle
                            : m.key === "welfare"
                              ? Eye
                              : ClipboardCheck
                    }
                  />
                ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <SectionCard
              title="Seven-day attendance trend"
              description="Present, late and absent learners"
              className="xl:col-span-2"
            >
              <div className="h-[240px] p-3">
                {isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data!.attendanceTrend}
                      margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="present" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--cyan)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--cyan)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11 }}
                        stroke="var(--muted-foreground)"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        stroke="var(--muted-foreground)"
                        tickLine={false}
                        axisLine={false}
                      />
                      <RTooltip
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="present"
                        stroke="var(--cyan)"
                        strokeWidth={2}
                        fill="url(#present)"
                      />
                      <Area
                        type="monotone"
                        dataKey="late"
                        stroke="var(--warning)"
                        strokeWidth={2}
                        fill="transparent"
                      />
                      <Area
                        type="monotone"
                        dataKey="absent"
                        stroke="var(--navy)"
                        strokeWidth={2}
                        fill="transparent"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Attendance status distribution"
              description="Records captured today"
            >
              <div className="h-[240px] p-3">
                {isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data!.statusDistribution}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={48}
                        outerRadius={74}
                        paddingAngle={2}
                      >
                        {data!.statusDistribution.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Attendance by class" description="Percentage present this week">
              <div className="h-[220px] p-3">
                {isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data!.attendanceByClass}
                      margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="className"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        domain={[60, 100]}
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="rate" fill="var(--navy)" radius={[4, 4, 0, 0]} barSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Cases and interventions" description="Open compared with closed">
              <div className="h-[220px] p-3">
                {isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data!.caseStatus}
                      margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="open" fill="var(--cyan)" radius={[4, 4, 0, 0]} barSize={18} />
                      <Bar
                        dataKey="closed"
                        fill="var(--success)"
                        radius={[4, 4, 0, 0]}
                        barSize={18}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Quick actions" description="Common daily tasks">
              <div className="grid grid-cols-1 gap-1.5 p-3 sm:grid-cols-2">
                {QUICK_ACTIONS.map((a) => (
                  <QuickLink key={a.label} to={a.to} label={a.label} icon={a.icon} />
                ))}
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard
              title="Today's occasions"
              description="Registers currently scheduled, active or closed"
              action={
                <Link to="/occasions" className="text-[12px] font-medium text-info hover:underline">
                  View all
                </Link>
              }
            >
              {isLoading ? (
                <TableSkeleton rows={5} columns={3} />
              ) : (
                <ul className="divide-y divide-border">
                  {data!.todaysOccasions.map((o) => (
                    <li
                      key={o.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">{o.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {o.startTime}–{o.endTime} · {o.location} · {o.responsibleStaff}
                        </p>
                        <Progress value={(o.scanned / o.expected) * 100} className="mt-1.5 h-1" />
                      </div>
                      <div className="text-right">
                        <StatusBadge status={o.status} />
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {o.scanned}/{o.expected}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard
              title="Recent unexplained absences"
              description="Awaiting reconciliation by staff"
              action={
                <Link
                  to="/attendance"
                  className="text-[12px] font-medium text-info hover:underline"
                >
                  Reconcile
                </Link>
              }
            >
              {isLoading ? (
                <TableSkeleton rows={5} columns={3} />
              ) : data!.unexplainedAbsences.length === 0 ? (
                <EmptyState
                  title="No unexplained absences"
                  description="Every learner is accounted for today."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {data!.unexplainedAbsences.map((r) => (
                    <li
                      key={r.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">{r.learnerName}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {r.admissionNumber} · {r.className} {r.stream} · {r.occasionName}
                        </p>
                      </div>
                      <StatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard
              title="Cases requiring review"
              description="Summary only — details are restricted"
              action={
                <Link to="/cases" className="text-[12px] font-medium text-info hover:underline">
                  Open cases
                </Link>
              }
            >
              {isLoading ? (
                <TableSkeleton rows={4} columns={3} />
              ) : (
                <ul className="divide-y divide-border">
                  {data!.seriousCases.map((c) => (
                    <li
                      key={c.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">{c.reference}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {c.className} · reviewer {c.assignedReviewer} · review{" "}
                          {c.reviewDate ?? "—"}
                        </p>
                      </div>
                      <StatusBadge status={c.stage} tone="info" />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard
              title="Devices with synchronisation problems"
              description="Records still held on devices"
              action={
                <Link to="/devices" className="text-[12px] font-medium text-info hover:underline">
                  Sync centre
                </Link>
              }
            >
              {isLoading ? (
                <TableSkeleton rows={4} columns={3} />
              ) : (
                <ul className="divide-y divide-border">
                  {data!.deviceIssues.map((d) => (
                    <li
                      key={d.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" /> {d.name}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {d.location} · {d.pendingRecords} pending · last sync {d.lastSync}
                        </p>
                      </div>
                      <StatusBadge status={d.status} />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard
              title="Recent staff actions"
              description="From the audit trail"
              className="xl:col-span-2"
              action={
                <Link to="/audit" className="text-[12px] font-medium text-info hover:underline">
                  Audit logs
                </Link>
              }
            >
              {isLoading ? (
                <TableSkeleton rows={5} columns={4} />
              ) : (
                <ul className="divide-y divide-border">
                  {data!.recentStaffActions.map((a) => (
                    <li
                      key={a.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px]">
                          <span className="font-medium">{a.user}</span> — {a.action}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {a.module} · {a.record} · {a.device}
                        </p>
                      </div>
                      <span className="text-[11px] whitespace-nowrap text-muted-foreground">
                        {a.at}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </AppShell>
  );
}
