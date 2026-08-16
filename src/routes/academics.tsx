import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, ClipboardList, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { MetricCard, PageHeader, SectionCard } from "@/components/common/Primitives";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { academicsService } from "@/services";
import { useAuth } from "@/lib/auth-context";
import type { Assessment, MarksGrid } from "@/types";

export const Route = createFileRoute("/academics")({
  head: () => ({ meta: [{ title: "Academics — Nile Crest SAPWMS" }] }),
  component: AcademicsPage,
});

function AcademicsPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Assessment | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: "",
    subject: "",
    className: "Senior One",
    term: "Term One 2026",
    maximumMark: "100",
    assessmentDate: new Date().toISOString().slice(0, 10),
  });
  const assessmentsQuery = useQuery({
    queryKey: ["academic-assessments"],
    queryFn: academicsService.assessments,
  });
  const marksQuery = useQuery({
    queryKey: ["assessment-marks", selected?.id],
    queryFn: () => academicsService.marksGrid(selected!.id),
    enabled: Boolean(selected),
  });
  useEffect(() => {
    if (marksQuery.data)
      setMarks(
        Object.fromEntries(
          marksQuery.data.cells.map((cell) => [
            cell.learnerId,
            cell.mark === null ? "" : String(cell.mark),
          ]),
        ),
      );
  }, [marksQuery.data]);
  const assessments = useMemo(() => assessmentsQuery.data ?? [], [assessmentsQuery.data]);
  const filtered = useMemo(
    () =>
      assessments.filter((a) =>
        `${a.name} ${a.subject} ${a.className}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [assessments, search],
  );
  const create = useMutation({
    mutationFn: () =>
      academicsService.createAssessment({ ...form, maximumMark: Number(form.maximumMark) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["academic-assessments"] });
      setCreateOpen(false);
      toast.success("Assessment created");
    },
    onError: (e: Error) => toast.error("Could not create assessment", { description: e.message }),
  });
  const save = useMutation({
    mutationFn: (grid: MarksGrid) =>
      academicsService.saveMarks(
        grid.assessmentId,
        grid.cells.map((cell) => ({
          learnerId: cell.learnerId,
          mark: marks[cell.learnerId] === "" ? null : Number(marks[cell.learnerId]),
        })),
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assessment-marks"] }),
        queryClient.invalidateQueries({ queryKey: ["academic-assessments"] }),
      ]);
      toast.success("Marks saved");
    },
    onError: (e: Error) => toast.error("Could not save marks", { description: e.message }),
  });
  const publish = useMutation({
    mutationFn: academicsService.publish,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["academic-assessments"] });
      setSelected(null);
      toast.success("Assessment published");
    },
  });
  const published = assessments.filter((a) => a.status === "published").length;
  const entered = assessments.reduce((sum, a) => sum + a.entered, 0);

  return (
    <AppShell permission="academics.view" area="academics">
      <PageHeader
        title="Academics"
        description="Create assessments, enter verified marks and publish results."
        actions={
          can("academics.manage") ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              New assessment
            </Button>
          ) : null
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Assessments"
          value={assessments.length}
          icon={ClipboardList}
          tone="navy"
        />
        <MetricCard label="Marks entered" value={entered} icon={BookOpen} tone="cyan" />
        <MetricCard label="Published" value={published} icon={CheckCircle2} tone="success" />
      </div>
      <SectionCard
        title="Assessment register"
        description="Term assessments and marks-entry progress"
        className="mt-4"
        bodyClassName="p-4"
      >
        <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search assessment, subject or class"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {assessmentsQuery.isLoading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : assessmentsQuery.isError ? (
          <ErrorState
            message={(assessmentsQuery.error as Error).message}
            onRetry={() => void assessmentsQuery.refetch()}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No assessments found"
            description="Create the first assessment for this term."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Assessment</th>
                  <th>Subject</th>
                  <th>Class</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="text-right">Marks</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td className="py-3 pr-3">
                      <p className="font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.term}</p>
                    </td>
                    <td>{a.subject}</td>
                    <td>{a.className}</td>
                    <td>{new Date(a.dueDate).toLocaleDateString()}</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setSelected(a)}>
                        {can("academics.manage") && a.status !== "published"
                          ? "Enter marks"
                          : "View marks"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create assessment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Assessment name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
                placeholder="Beginning of term test"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Subject</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm((v) => ({ ...v, subject: e.target.value }))}
                  placeholder="Mathematics"
                />
              </div>
              <div className="grid gap-2">
                <Label>Class</Label>
                <Select
                  value={form.className}
                  onValueChange={(className) => setForm((v) => ({ ...v, className }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Senior One",
                      "Senior Two",
                      "Senior Three",
                      "Senior Four",
                      "Senior Five",
                      "Senior Six",
                    ].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>Term</Label>
                <Input
                  value={form.term}
                  onChange={(e) => setForm((v) => ({ ...v, term: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Maximum mark</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.maximumMark}
                  onChange={(e) => setForm((v) => ({ ...v, maximumMark: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.assessmentDate}
                  onChange={(e) => setForm((v) => ({ ...v, assessmentDate: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={form.name.length < 2 || form.subject.length < 2 || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Creating…" : "Create assessment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet
        open={Boolean(selected)}
        onOpenChange={(value) => {
          if (!value) setSelected(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{marksQuery.data?.assessmentName ?? selected?.name}</SheetTitle>
            <SheetDescription>
              {marksQuery.data
                ? `${marksQuery.data.subject} · ${marksQuery.data.className} · Maximum ${marksQuery.data.maxMark}`
                : "Loading marks register…"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-5">
            {marksQuery.isLoading ? (
              <TableSkeleton rows={6} columns={3} />
            ) : marksQuery.isError ? (
              <ErrorState
                message={(marksQuery.error as Error).message}
                onRetry={() => void marksQuery.refetch()}
              />
            ) : marksQuery.data ? (
              <>
                <div className="space-y-2">
                  {marksQuery.data.cells.map((cell) => (
                    <div
                      key={cell.learnerId}
                      className="grid grid-cols-[1fr_110px] items-center gap-3 rounded-lg border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{cell.learnerName}</p>
                        <p className="text-xs text-muted-foreground">{cell.admissionNumber}</p>
                      </div>
                      <Input
                        aria-label={`Mark for ${cell.learnerName}`}
                        type="number"
                        min="0"
                        max={marksQuery.data.maxMark}
                        disabled={!can("academics.manage") || selected?.status === "published"}
                        value={marks[cell.learnerId] ?? ""}
                        onChange={(e) =>
                          setMarks((v) => ({ ...v, [cell.learnerId]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                </div>
                {can("academics.manage") && selected?.status !== "published" ? (
                  <div className="mt-5 flex justify-end gap-2">
                    <Button
                      variant="outline"
                      disabled={save.isPending}
                      onClick={() => save.mutate(marksQuery.data!)}
                    >
                      {save.isPending ? "Saving…" : "Save draft"}
                    </Button>
                    <Button
                      disabled={publish.isPending}
                      onClick={() => publish.mutate(selected!.id)}
                    >
                      Publish results
                    </Button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
