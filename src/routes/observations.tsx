import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, Paperclip, Plus, RotateCcw, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, SectionCard } from "@/components/common/Primitives";
import { EmptyState, ErrorState, SensitiveNotice, TableSkeleton } from "@/components/common/States";
import { StatusBadge, type BadgeTone } from "@/components/common/StatusBadge";
import { LearnerAvatar } from "@/components/common/LearnerAvatar";
import { TablePagination } from "@/components/common/TablePagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supportService, learnerService } from "@/services";
import { useAuth } from "@/lib/auth-context";
import type { Observation } from "@/types";

export const Route = createFileRoute("/observations")({
  head: () => ({
    meta: [
      { title: "Observations — factual learner conduct records" },
      {
        name: "description",
        content:
          "Record and review factual, non-permanent observations of learner conduct, welfare and academic behaviour at Nile Crest Secondary School.",
      },
      { property: "og:title", content: "Observations — factual learner conduct records" },
      {
        property: "og:description",
        content: "Factual observation records with category, severity and follow-up tracking.",
      },
    ],
  }),
  component: ObservationsPage,
});

const CATEGORIES: Observation["category"][] = [
  "Positive conduct",
  "Academic observation",
  "Minor concern",
  "Welfare concern",
  "General observation",
  "Serious alleged incident",
];
const SEVERITIES: Observation["severity"][] = ["low", "medium", "high"];
const SEVERITY_TONE: Record<Observation["severity"], BadgeTone> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

const DEFAULT_FILTERS = { search: "", category: "all", severity: "all", from: "", to: "" };

const formSchema = z.object({
  learnerName: z.string().min(2, "Enter the learner's name"),
  category: z.enum(CATEGORIES as [string, ...string[]]),
  severity: z.enum(SEVERITIES as [string, ...string[]]),
  dateTime: z.string().min(1, "Select a date and time"),
  location: z.string().min(2, "Enter a location"),
  relatedOccasion: z.string().optional(),
  description: z.string().min(20, "Provide a factual description of at least 20 characters"),
  immediateAction: z.string().min(5, "Describe the immediate action taken"),
  recommendedFollowUp: z.string().min(5, "Describe the recommended follow-up"),
  witnesses: z.string().optional(),
  parentContactRecommended: z.boolean(),
});
type FormValues = z.infer<typeof formSchema>;

function isConfidentialToUser(o: Observation, canWelfare: boolean, canCases: boolean) {
  if (!o.confidential) return false;
  if (o.category === "Welfare concern") return !canWelfare;
  if (o.category === "Serious alleged incident") return !canCases;
  return false;
}

function RecordObservationDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      learnerName: "",
      category: "General observation",
      severity: "low",
      dateTime: "",
      location: "",
      relatedOccasion: "",
      description: "",
      immediateAction: "",
      recommendedFollowUp: "",
      witnesses: "",
      parentContactRecommended: false,
    },
  });

  const onSubmit = async (values: FormValues) => {
    await supportService.createObservation({
      learnerName: values.learnerName,
      category: values.category as Observation["category"],
      severity: values.severity as Observation["severity"],
      dateTime: values.dateTime,
      location: values.location,
      relatedOccasion: values.relatedOccasion || null,
      description: values.description,
      immediateAction: values.immediateAction,
      recommendedFollowUp: values.recommendedFollowUp,
      witnesses: values.witnesses
        ? values.witnesses
            .split(",")
            .map((w) => w.trim())
            .filter(Boolean)
        : [],
      parentContactRecommended: values.parentContactRecommended,
    });
    toast.success("Observation recorded", {
      description: `A factual record for ${values.learnerName} has been saved.`,
    });
    form.reset();
    setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 text-[12px]">
          <Plus className="h-3.5 w-3.5" /> Record observation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record an observation</DialogTitle>
          <DialogDescription>
            Record a factual, non-permanent account of what was observed. Avoid characterising the
            learner; describe events only.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="learnerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Learner</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Patricia Nakato" {...field} />
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
                name="severity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severity</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SEVERITIES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="dateTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date &amp; time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Dining Hall" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="relatedOccasion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Related occasion (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Evening prep" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Factual description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Describe exactly what was observed, without judgement."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="immediateAction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Immediate action taken</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="recommendedFollowUp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recommended follow-up</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="witnesses"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Witnesses (comma separated, optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Faith Atim, Joshua Kato" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-[12px] text-muted-foreground">
              <Paperclip className="h-3.5 w-3.5" /> Attachments — file upload will be available once
              document storage is connected.
            </div>
            <FormField
              control={form.control}
              name="parentContactRecommended"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(c) => field.onChange(Boolean(c))}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0 text-[13px] font-normal">
                    Recommend parent/guardian contact
                  </FormLabel>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : "Save observation"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ObservationsPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canWelfare = can("welfare.view");
  const canCases = can("cases.view");

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pageSize = 10;

  const query = useQuery({
    queryKey: ["observations"],
    queryFn: () => supportService.observations(),
  });
  const learnersQuery = useQuery({
    queryKey: ["learners-lite"],
    queryFn: () => learnerService.list({ pageSize: 240 }),
  });

  const rows = useMemo(() => query.data ?? [], [query.data]);
  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return rows.filter((o) => {
      if (q && !`${o.learnerName} ${o.reference}`.toLowerCase().includes(q)) return false;
      if (filters.category !== "all" && o.category !== filters.category) return false;
      if (filters.severity !== "all" && o.severity !== filters.severity) return false;
      if (filters.from && o.dateTime.slice(0, 10) < filters.from) return false;
      if (filters.to && o.dateTime.slice(0, 10) > filters.to) return false;
      return true;
    });
  }, [rows, filters]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const selectedHidden = selected ? isConfidentialToUser(selected, canWelfare, canCases) : false;

  const learnerHue = (name: string) =>
    learnersQuery.data?.data.find((l) => l.fullName === name)?.photoHue ?? 210;

  const update = (patch: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  return (
    <AppShell permission={["observations.view", "observations.create"]} area="observations">
      <PageHeader
        title="Observations"
        description={
          query.isLoading
            ? "Loading observation records…"
            : `${filtered.length} observation${filtered.length === 1 ? "" : "s"} match the current filters.`
        }
        actions={
          can("observations.create") ? (
            <RecordObservationDialog
              onCreated={() => void queryClient.invalidateQueries({ queryKey: ["observations"] })}
            />
          ) : null
        }
      />

      {!canWelfare || !canCases ? (
        <SensitiveNotice className="mb-3">
          Welfare concerns and serious alleged incidents are confidential. Records outside your
          permissions are hidden from lists and cannot be opened.
        </SensitiveNotice>
      ) : null}

      <SectionCard>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search observations"
              placeholder="Search by learner or reference"
              className="h-8 pl-8 text-[13px]"
              value={filters.search}
              onChange={(e) => update({ search: e.target.value })}
            />
          </div>
          <Select value={filters.category} onValueChange={(v) => update({ category: v })}>
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
          <Select value={filters.severity} onValueChange={(v) => update({ severity: v })}>
            <SelectTrigger className="h-8 w-auto min-w-[110px] text-[12px]" aria-label="Severity">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              {SEVERITIES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            aria-label="From date"
            className="h-8 w-auto text-[12px]"
            value={filters.from}
            onChange={(e) => update({ from: e.target.value })}
          />
          <Input
            type="date"
            aria-label="To date"
            className="h-8 w-auto text-[12px]"
            value={filters.to}
            onChange={(e) => update({ to: e.target.value })}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-[12px]"
            onClick={() => {
              setFilters(DEFAULT_FILTERS);
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
            title="No observations found"
            description="Adjust your filters or record a new observation."
            icon={Eye}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    <th className="px-4 py-2.5">Learner</th>
                    <th className="px-4 py-2.5">Reference</th>
                    <th className="px-4 py-2.5">Category</th>
                    <th className="px-4 py-2.5">Severity</th>
                    <th className="px-4 py-2.5">Date/time</th>
                    <th className="px-4 py-2.5">Location</th>
                    <th className="px-4 py-2.5">Recorded by</th>
                    <th className="px-4 py-2.5">Follow-up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paged.map((o) => {
                    const hidden = isConfidentialToUser(o, canWelfare, canCases);
                    return (
                      <tr
                        key={o.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => setSelectedId(o.id)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open observation ${o.reference}`}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <LearnerAvatar
                              name={o.learnerName}
                              hue={learnerHue(o.learnerName)}
                              size={26}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">
                                {o.learnerName}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {o.className}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[12px] text-muted-foreground">
                          {o.reference}
                        </td>
                        <td className="px-4 py-2.5">
                          {hidden ? (
                            <Badge variant="outline" className="text-[11px]">
                              Confidential
                            </Badge>
                          ) : (
                            <span>{o.category}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={o.severity} tone={SEVERITY_TONE[o.severity]} />
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{o.dateTime}</td>
                        <td className="px-4 py-2.5">{hidden ? "—" : o.location}</td>
                        <td className="px-4 py-2.5">{o.recordedBy}</td>
                        <td className="px-4 py-2.5">
                          {hidden ? (
                            "—"
                          ) : (
                            <span className="text-[12px] text-muted-foreground">
                              {o.recommendedFollowUp === "No further action required."
                                ? "Closed"
                                : "In progress"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.reference}</SheetTitle>
                <SheetDescription>
                  {selected.learnerName} · {selected.className}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6">
                {selectedHidden ? (
                  <SensitiveNotice>
                    This is a confidential {selected.category.toLowerCase()} record. Your role does
                    not have permission to view welfare or case details.
                  </SensitiveNotice>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{selected.category}</Badge>
                      <StatusBadge
                        status={selected.severity}
                        tone={SEVERITY_TONE[selected.severity]}
                      />
                      {selected.confidential ? <Badge variant="outline">Confidential</Badge> : null}
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-[12px]">
                      <div>
                        <dt className="text-muted-foreground">Date &amp; time</dt>
                        <dd className="font-medium text-foreground">{selected.dateTime}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Location</dt>
                        <dd className="font-medium text-foreground">{selected.location}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Related occasion</dt>
                        <dd className="font-medium text-foreground">
                          {selected.relatedOccasion ?? "None"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Recorded by</dt>
                        <dd className="font-medium text-foreground">{selected.recordedBy}</dd>
                      </div>
                    </dl>
                    <div>
                      <h3 className="mb-1 text-[12px] font-semibold text-foreground">
                        Factual description
                      </h3>
                      <p className="text-[13px] text-muted-foreground">{selected.description}</p>
                    </div>
                    <div>
                      <h3 className="mb-1 text-[12px] font-semibold text-foreground">
                        Immediate action
                      </h3>
                      <p className="text-[13px] text-muted-foreground">
                        {selected.immediateAction}
                      </p>
                    </div>
                    <div>
                      <h3 className="mb-1 text-[12px] font-semibold text-foreground">
                        Recommended follow-up
                      </h3>
                      <p className="text-[13px] text-muted-foreground">
                        {selected.recommendedFollowUp}
                      </p>
                    </div>
                    <div>
                      <h3 className="mb-1 text-[12px] font-semibold text-foreground">Witnesses</h3>
                      <p className="text-[13px] text-muted-foreground">
                        {selected.witnesses.length
                          ? selected.witnesses.join(", ")
                          : "None recorded"}
                      </p>
                    </div>
                    <div>
                      <h3 className="mb-1 text-[12px] font-semibold text-foreground">
                        Attachments
                      </h3>
                      <p className="text-[13px] text-muted-foreground">No attachments uploaded.</p>
                    </div>
                    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[12px]">
                      Parent/guardian contact{" "}
                      {selected.parentContactRecommended
                        ? "is recommended for this record."
                        : "is not currently recommended."}
                    </div>
                  </>
                )}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
