import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, History, Power, RefreshCw, Search, Tablet, Wrench } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { MetricCard, PageHeader, SectionCard } from "@/components/common/Primitives";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deviceService } from "@/services";
import { cn } from "@/lib/utils";
import type { Device } from "@/types";

export const Route = createFileRoute("/devices")({
  head: () => ({
    meta: [
      { title: "Devices — synchronisation centre" },
      {
        name: "description",
        content:
          "Monitor device sync status, resolve conflicts and manage assigned scanning devices.",
      },
      { property: "og:title", content: "Devices — synchronisation centre" },
      {
        property: "og:description",
        content: "Device sync status, pending records, conflicts and history.",
      },
    ],
  }),
  component: DevicesPage,
});

function DevicesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<Device | null>(null);
  const [conflictsFor, setConflictsFor] = useState<Device | null>(null);
  const [disableFor, setDisableFor] = useState<Device | null>(null);

  const devicesQuery = useQuery({ queryKey: ["devices"], queryFn: () => deviceService.list() });
  const historyQuery = useQuery({
    queryKey: ["device-history"],
    queryFn: () => deviceService.history(),
    enabled: !!historyFor,
  });

  const rows = useMemo(() => {
    let list = devicesQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (q)
      list = list.filter((d) =>
        `${d.name} ${d.assignedUser} ${d.location}`.toLowerCase().includes(q),
      );
    if (status !== "all") list = list.filter((d) => d.status === status);
    return list;
  }, [devicesQuery.data, search, status]);

  const metrics = useMemo(() => {
    const all = devicesQuery.data ?? [];
    return {
      total: all.length,
      synced: all.filter((d) => d.status === "synced").length,
      pending: all.reduce((s, d) => s + d.pendingRecords, 0),
      conflicts: all.reduce((s, d) => s + d.conflicts, 0),
      failed: all.filter((d) => d.status === "failed").length,
    };
  }, [devicesQuery.data]);

  const runSync = async (device: Device) => {
    setSyncingId(device.id);
    try {
      await deviceService.sync(device.id);
      toast.success("Synchronisation complete", {
        description: `${device.name} is now up to date.`,
      });
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <AppShell permission="devices.view" area="device management">
      <PageHeader
        title="Devices"
        description={
          devicesQuery.isLoading
            ? "Loading devices…"
            : `${rows.length} devices match the current filters.`
        }
        actions={
          <Button
            size="sm"
            className="h-8 text-[12px]"
            onClick={() =>
              toast("Synchronising all devices", {
                description: "This may take a few minutes for devices with large pending queues.",
              })
            }
          >
            <RefreshCw className="h-3.5 w-3.5" /> Synchronise all
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="Registered devices" value={metrics.total} icon={Tablet} tone="navy" />
        <MetricCard label="Synced" value={metrics.synced} icon={RefreshCw} tone="success" />
        <MetricCard label="Pending records" value={metrics.pending} icon={History} tone="warning" />
        <MetricCard label="Conflicts" value={metrics.conflicts} icon={AlertTriangle} tone="info" />
        <MetricCard label="Failed devices" value={metrics.failed} icon={Wrench} tone="warning" />
      </div>

      <div className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search devices"
              placeholder="Search by device, user or location"
              className="h-8 pl-8 text-[13px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-auto min-w-[130px] text-[12px]" aria-label="Status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {["synced", "pending", "syncing", "failed", "conflict", "disabled"].map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {devicesQuery.isError ? (
          <ErrorState onRetry={() => void devicesQuery.refetch()} />
        ) : devicesQuery.isLoading ? (
          <TableSkeleton rows={7} columns={9} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No devices match these filters"
            description="Adjust the search or filters to see more devices."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-left text-[12.5px]">
              <thead className="sticky top-14 z-10 bg-card">
                <tr className="border-b border-border">
                  <Th>Device</Th>
                  <Th>Type</Th>
                  <Th>Assigned user</Th>
                  <Th>Location</Th>
                  <Th>Status</Th>
                  <Th>Last sync</Th>
                  <Th>Pending</Th>
                  <Th>Failed</Th>
                  <Th>Conflicts</Th>
                  <Th>Version</Th>
                  <Th>Last activity</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-b border-border/70 hover:bg-accent/50">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{d.name}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{d.type}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{d.assignedUser}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{d.location}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{d.lastSync}</td>
                    <td className="px-3 py-2">{d.pendingRecords}</td>
                    <td className="px-3 py-2">{d.failedRecords}</td>
                    <td className="px-3 py-2">{d.conflicts}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{d.version}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{d.lastActivity}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11.5px]"
                          disabled={syncingId === d.id}
                          onClick={() => void runSync(d)}
                        >
                          <RefreshCw
                            className={cn("h-3 w-3", syncingId === d.id && "animate-spin")}
                          />{" "}
                          {d.status === "failed" ? "Retry" : "Sync now"}
                        </Button>
                        {d.conflicts > 0 ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11.5px]"
                            onClick={() => setConflictsFor(d)}
                          >
                            <AlertTriangle className="h-3 w-3" /> Conflicts
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={`History for ${d.name}`}
                          onClick={() => setHistoryFor(d)}
                        >
                          <History className="h-3.5 w-3.5" />
                        </Button>
                        {d.status !== "disabled" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-danger"
                            aria-label={`Disable ${d.name}`}
                            onClick={() => setDisableFor(d)}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                      {syncingId === d.id ? <Progress value={64} className="mt-1.5 h-1" /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Sheet open={!!conflictsFor} onOpenChange={(o) => !o && setConflictsFor(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Conflicts — {conflictsFor?.name}</SheetTitle>
          </SheetHeader>
          <div className="space-y-2 px-4 pb-4">
            {Array.from({ length: conflictsFor?.conflicts ?? 0 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <p className="text-[12.5px] font-medium">
                  Attendance record #{1000 + i} — conflicting scan time
                </p>
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  Local record differs from the server copy for this occasion.
                </p>
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    className="h-7 text-[11.5px]"
                    onClick={() =>
                      toast.success("Conflict resolved", {
                        description: "The server copy has been kept as the source of truth.",
                      })
                    }
                  >
                    Resolve conflict
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Synchronisation history — {historyFor?.name}</DialogTitle>
            <DialogDescription>Recent synchronisation attempts for this device.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {(historyQuery.data ?? [])
              .filter((h) => h.deviceId === historyFor?.id)
              .map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between rounded-md bg-muted px-2.5 py-1.5 text-[12px]"
                >
                  <span>
                    {h.at} · {h.records} records
                  </span>
                  <StatusBadge
                    status={
                      h.result === "success"
                        ? "synced"
                        : h.result === "failed"
                          ? "failed"
                          : "pending"
                    }
                  />
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!disableFor} onOpenChange={(o) => !o && setDisableFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable {disableFor?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This device will no longer be able to submit attendance scans until re-enabled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={() => {
                toast.success("Device disabled", {
                  description: `${disableFor?.name} has been disabled.`,
                });
                setDisableFor(null);
              }}
            >
              Disable device
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase",
        className,
      )}
    >
      {children}
    </th>
  );
}
