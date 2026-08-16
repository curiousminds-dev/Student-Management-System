import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gavel, RotateCcw, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, SectionCard } from "@/components/common/Primitives";
import {
  EmptyState,
  ErrorState,
  PermissionDenied,
  SensitiveNotice,
  TableSkeleton,
} from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { TablePagination } from "@/components/common/TablePagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supportService } from "@/services";
import { useAuth } from "@/lib/auth-context";
import type { CaseStage, ConductCase } from "@/types";

export const Route = createFileRoute("/cases")({
  head: () => ({
    meta: [
      { title: "Cases — fair conduct case review" },
      {
        name: "description",
        content:
          "Track fair conduct case reviews through submission, evidence review, finding, intervention and closure.",
      },
      { property: "og:title", content: "Cases — fair conduct case review" },
      {
        property: "og:description",
        content: "Fair conduct case pipeline with findings, evidence and audit history.",
      },
    ],
  }),
  component: CasesPage,
});

const STAGES: CaseStage[] = [
  "Submitted",
  "Assigned",
  "Learner response",
  "Evidence review",
  "Finding",
  "Intervention",
  "Review",
  "Closure",
];
const FINDINGS: NonNullable<ConductCase["finding"]>[] = [
  "Confirmed",
  "Unconfirmed",
  "Dismissed",
  "Referred",
];

function FindingDialog({ caseRef, onRecorded }: { caseRef: ConductCase; onRecorded: () => void }) {
  const [open, setOpen] = useState(false);
  const [finding, setFinding] = useState<NonNullable<ConductCase["finding"]>>("Confirmed");
  const [rationale, setRationale] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (rationale.trim().length < 15) {
      toast.error("Rationale required", {
        description: "Provide at least 15 characters explaining the finding.",
      });
      return;
    }
    setSubmitting(true);
    await supportService.recordFinding({ caseId: caseRef.id, finding, rationale });
    setSubmitting(false);
    toast.success("Finding recorded", {
      description: `${caseRef.reference} marked as ${finding}.`,
    });
    setOpen(false);
    setRationale("");
    onRecorded();
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => setOpen(true)}>
        <Gavel className="h-3.5 w-3.5" /> Record finding
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Record a finding for {caseRef.reference}</AlertDialogTitle>
          <AlertDialogDescription>
            This decision will be added to the audit history and cannot be silently changed
            afterwards.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <Select
            value={finding}
            onValueChange={(v) => setFinding(v as NonNullable<ConductCase["finding"]>)}
          >
            <SelectTrigger className="h-8 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FINDINGS.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            rows={3}
            placeholder="Required rationale explaining this finding"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={submitting}
            onClick={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {submitting ? "Saving…" : "Confirm finding"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CasesPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canViewCases = can("cases.view");
  const canManage = can("cases.manage");

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pageSize = 10;

  const query = useQuery({
    queryKey: ["cases"],
    queryFn: () => supportService.cases(),
    enabled: canViewCases,
  });
  const rows = useMemo(() => query.data ?? [], [query.data]);

  const counts = useMemo(() => {
    const map = new Map<CaseStage, number>();
    STAGES.forEach((s) => map.set(s, 0));
    rows.forEach((c) => map.set(c.stage, (map.get(c.stage) ?? 0) + 1));
    return map;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((c) => {
      if (q && !`${c.learnerName} ${c.reference} ${c.title}`.toLowerCase().includes(q))
        return false;
      if (stageFilter !== "all" && c.stage !== stageFilter) return false;
      return true;
    });
  }, [rows, search, stageFilter]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  if (!canViewCases) {
    return (
      <AppShell area="fair conduct case review">
        <PermissionDenied area="fair conduct case review" />
      </AppShell>
    );
  }

  return (
    <AppShell permission="cases.view" area="fair conduct case review">
      <PageHeader
        title="Cases"
        description={
          query.isLoading
            ? "Loading case reviews…"
            : `${filtered.length} case${filtered.length === 1 ? "" : "s"} match the current filters.`
        }
      />

      <SensitiveNotice className="mb-3">
        Case summaries and descriptions are confidential. Only your reference, stage and, where
        permitted, full detail are shown — nothing is summarised on general lists.
      </SensitiveNotice>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {STAGES.map((s) => (
          <button
            key={s}
            onClick={() => {
              setStageFilter(stageFilter === s ? "all" : s);
              setPage(1);
            }}
            className={`surface-card px-3 py-2.5 text-left transition ${stageFilter === s ? "ring-2 ring-primary" : ""}`}
          >
            <p className="text-[11px] font-medium text-muted-foreground">{s}</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{counts.get(s) ?? 0}</p>
          </button>
        ))}
      </div>

      <SectionCard>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search cases"
              placeholder="Search by learner, reference or title"
              className="h-8 pl-8 text-[13px]"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={stageFilter}
            onValueChange={(v) => {
              setStageFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-auto min-w-[150px] text-[12px]" aria-label="Stage">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s}>
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
              setSearch("");
              setStageFilter("all");
              setPage(1);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>

        {query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : query.isLoading ? (
          <TableSkeleton rows={8} columns={8} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No cases found"
            description="Adjust your filters to see more case reviews."
            icon={Gavel}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    <th className="px-4 py-2.5">Reference</th>
                    <th className="px-4 py-2.5">Learner</th>
                    <th className="px-4 py-2.5">Class</th>
                    <th className="px-4 py-2.5">Title</th>
                    <th className="px-4 py-2.5">Stage</th>
                    <th className="px-4 py-2.5">Reviewer</th>
                    <th className="px-4 py-2.5">Opened</th>
                    <th className="px-4 py-2.5">Review date</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paged.map((c) => (
                    <tr
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/40"
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(c.id)}
                      aria-label={`Open case ${c.reference}`}
                    >
                      <td className="px-4 py-2.5 font-mono text-[12px] text-muted-foreground">
                        {c.reference}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-foreground">{c.learnerName}</td>
                      <td className="px-4 py-2.5">{c.className}</td>
                      <td className="px-4 py-2.5 max-w-[220px] truncate">{c.title}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="secondary" className="text-[11px]">
                          {c.stage}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">{c.assignedReviewer}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.openedOn}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.reviewDate ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={c.closed ? "closed" : "open"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
            />
          </>
        )}
      </SectionCard>

      <Sheet open={Boolean(selected)} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.reference}</SheetTitle>
                <SheetDescription>
                  {selected.learnerName} · {selected.className} · {selected.title}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{selected.stage}</Badge>
                  <StatusBadge status={selected.closed ? "closed" : "open"} />
                  {selected.finding ? (
                    <Badge variant="outline">Finding: {selected.finding}</Badge>
                  ) : null}
                  {canManage && !selected.closed ? (
                    <FindingDialog
                      caseRef={selected}
                      onRecorded={() => void queryClient.invalidateQueries({ queryKey: ["cases"] })}
                    />
                  ) : null}
                </div>
                <div>
                  <h3 className="mb-1 text-[12px] font-semibold text-foreground">Summary</h3>
                  <p className="text-[13px] text-muted-foreground">{selected.summary}</p>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-[12px]">
                  <div>
                    <dt className="text-muted-foreground">Assigned reviewer</dt>
                    <dd className="font-medium text-foreground">{selected.assignedReviewer}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Evidence items</dt>
                    <dd className="font-medium text-foreground">{selected.evidenceCount}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Opened on</dt>
                    <dd className="font-medium text-foreground">{selected.openedOn}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Review date</dt>
                    <dd className="font-medium text-foreground">{selected.reviewDate ?? "—"}</dd>
                  </div>
                </dl>
                <div>
                  <h3 className="mb-1 text-[12px] font-semibold text-foreground">
                    Learner response
                  </h3>
                  <p className="text-[13px] text-muted-foreground">
                    {selected.learnerResponse ?? "No response recorded yet."}
                  </p>
                </div>
                <div>
                  <h3 className="mb-1 text-[12px] font-semibold text-foreground">
                    Parent contact history
                  </h3>
                  <p className="text-[13px] text-muted-foreground">
                    {selected.parentContacted
                      ? "Parent/guardian has been contacted regarding this case."
                      : "Parent/guardian has not yet been contacted."}
                  </p>
                </div>
                <div>
                  <h3 className="mb-2 text-[12px] font-semibold text-foreground">
                    Activity timeline &amp; audit history
                  </h3>
                  <ol className="space-y-2 border-l border-border pl-3">
                    {selected.timeline.map((t) => (
                      <li key={t.id} className="relative text-[12px]">
                        <span className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-primary" />
                        <p className="font-medium text-foreground">
                          {t.stage} — {t.actor}
                        </p>
                        <p className="text-muted-foreground">{t.at}</p>
                        <p className="text-muted-foreground">{t.note}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
