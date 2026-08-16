import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartHandshake, Plus, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { MetricCard, PageHeader, SectionCard } from "@/components/common/Primitives";
import { EmptyState, ErrorState, SensitiveNotice, TableSkeleton } from "@/components/common/States";
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
import { Textarea } from "@/components/ui/textarea";
import { learnerService, supportService } from "@/services";
import { useAuth } from "@/lib/auth-context";
import type { Observation } from "@/types";

export const Route = createFileRoute("/welfare")({
  head: () => ({ meta: [{ title: "Welfare support — Nile Crest SAPWMS" }] }),
  component: WelfarePage,
});

type WelfareRecord = Observation & { status?: "open" | "reviewing" | "closed"; reviewAt?: string };

function WelfarePage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [form, setForm] = useState({
    learnerId: "",
    category: "Welfare concern",
    severity: "medium",
    summary: "",
    details: "",
    reviewAt: "",
  });
  const recordsQuery = useQuery({
    queryKey: ["welfare-observations"],
    queryFn: supportService.observations,
  });
  const learnersQuery = useQuery({
    queryKey: ["welfare-learners"],
    queryFn: () => learnerService.list({ pageSize: 100 }),
  });
  const records = useMemo(() => (recordsQuery.data ?? []) as WelfareRecord[], [recordsQuery.data]);
  const filtered = useMemo(
    () =>
      records.filter((record) => {
        const q = search.toLowerCase();
        if (
          q &&
          !`${record.learnerName} ${record.description} ${record.reference}`
            .toLowerCase()
            .includes(q)
        )
          return false;
        return status === "all" || (record.status ?? "open") === status;
      }),
    [records, search, status],
  );
  const create = useMutation({
    mutationFn: () =>
      supportService.createObservation({
        learnerId: form.learnerId,
        category: form.category as Observation["category"],
        severity: form.severity as Observation["severity"],
        description: form.details,
        immediateAction: form.summary,
        dateTime: new Date().toISOString(),
        reviewAt: form.reviewAt || undefined,
      } as Partial<Observation> & { reviewAt?: string }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["welfare-observations"] });
      setOpen(false);
      setForm({
        learnerId: "",
        category: "Welfare concern",
        severity: "medium",
        summary: "",
        details: "",
        reviewAt: "",
      });
      toast.success("Welfare record saved", {
        description: "The case is now available for authorised review.",
      });
    },
    onError: (error: Error) =>
      toast.error("Could not save welfare record", { description: error.message }),
  });
  const update = useMutation({
    mutationFn: ({ id, next }: { id: string; next: "reviewing" | "closed" }) =>
      supportService.updateObservation(id, next),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["welfare-observations"] });
      toast.success("Welfare status updated");
    },
  });
  const openCount = records.filter((r) => (r.status ?? "open") === "open").length;
  const highCount = records.filter(
    (r) => r.severity === "high" && (r.status ?? "open") !== "closed",
  ).length;
  const reviewCount = records.filter((r) => (r.status ?? "open") === "reviewing").length;

  return (
    <AppShell permission="welfare.view" area="welfare support">
      <PageHeader
        title="Welfare support"
        description="Record, triage and follow up learner welfare concerns securely."
        actions={
          can("welfare.manage") ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              New welfare record
            </Button>
          ) : null
        }
      />
      <SensitiveNotice>
        Welfare records are confidential. Record factual information only and follow the school
        safeguarding procedure for urgent risks.
      </SensitiveNotice>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Open concerns" value={openCount} icon={HeartHandshake} tone="warning" />
        <MetricCard label="Under review" value={reviewCount} icon={ShieldCheck} tone="info" />
        <MetricCard label="High priority" value={highCount} icon={ShieldCheck} tone="navy" />
      </div>
      <SectionCard
        title="Welfare case register"
        description="Authorised learner-support records and review status"
        className="mt-4"
        bodyClassName="p-4"
      >
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search learner, reference or concern"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="reviewing">Reviewing</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {recordsQuery.isLoading ? (
          <TableSkeleton rows={5} columns={5} />
        ) : recordsQuery.isError ? (
          <ErrorState
            message={(recordsQuery.error as Error).message}
            onRetry={() => void recordsQuery.refetch()}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No welfare records found"
            description="Create a welfare record or adjust the filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Learner</th>
                  <th>Concern</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Recorded</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((record) => (
                  <tr key={record.id}>
                    <td className="py-3 pr-3">
                      <p className="font-medium">{record.learnerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {record.className} · {record.reference}
                      </p>
                    </td>
                    <td className="max-w-sm pr-3">
                      <p className="font-medium">{record.immediateAction}</p>
                      <p className="truncate text-xs text-muted-foreground">{record.description}</p>
                    </td>
                    <td>
                      <StatusBadge
                        status={record.severity}
                        tone={
                          record.severity === "high"
                            ? "danger"
                            : record.severity === "medium"
                              ? "warning"
                              : "neutral"
                        }
                      />
                    </td>
                    <td>
                      <StatusBadge status={record.status ?? "open"} />
                    </td>
                    <td className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(record.dateTime).toLocaleDateString()}
                    </td>
                    <td className="text-right">
                      {can("welfare.manage") && (record.status ?? "open") !== "closed" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={update.isPending}
                          onClick={() =>
                            update.mutate({
                              id: record.id,
                              next: (record.status ?? "open") === "open" ? "reviewing" : "closed",
                            })
                          }
                        >
                          {(record.status ?? "open") === "open" ? "Start review" : "Close"}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>New welfare record</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Learner</Label>
              <Select
                value={form.learnerId}
                onValueChange={(learnerId) => setForm((v) => ({ ...v, learnerId }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select learner" />
                </SelectTrigger>
                <SelectContent>
                  {learnersQuery.data?.data.map((learner) => (
                    <SelectItem key={learner.id} value={learner.id}>
                      {learner.fullName} · {learner.className}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(category) => setForm((v) => ({ ...v, category }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Welfare concern">Welfare concern</SelectItem>
                    <SelectItem value="Minor concern">Minor concern</SelectItem>
                    <SelectItem value="General observation">General observation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select
                  value={form.severity}
                  onValueChange={(severity) => setForm((v) => ({ ...v, severity }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Immediate action or summary</Label>
              <Input
                value={form.summary}
                onChange={(e) => setForm((v) => ({ ...v, summary: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Factual details</Label>
              <Textarea
                rows={4}
                value={form.details}
                onChange={(e) => setForm((v) => ({ ...v, details: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Review date</Label>
              <Input
                type="date"
                value={form.reviewAt}
                onChange={(e) => setForm((v) => ({ ...v, reviewAt: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !form.learnerId ||
                form.summary.length < 3 ||
                form.details.length < 3 ||
                create.isPending
              }
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Saving…" : "Save record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
