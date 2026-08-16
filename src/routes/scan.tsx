import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Flashlight,
  Ban,
  ScanLine,
  Volume2,
  VolumeX,
  WifiOff,
  Wifi,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { LearnerAvatar } from "@/components/common/LearnerAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
import { attendanceService, deviceService, learnerService } from "@/services";
import { cn } from "@/lib/utils";
import { clearQueuedScans, queueScan, queuedScans } from "@/lib/offline-sync";
import { USE_MOCK_DATA } from "@/services/api-client";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Scanning mode — attendance checkpoint" },
      {
        name: "description",
        content:
          "Full-screen QR scanning workspace for gate, assembly, dormitory and class checkpoints.",
      },
      { property: "og:title", content: "Scanning mode — attendance checkpoint" },
      {
        property: "og:description",
        content: "Live checkpoint scanning workspace with instant learner confirmation.",
      },
    ],
  }),
  component: ScanPage,
});

type ScanState =
  | "success"
  | "late"
  | "duplicate"
  | "wrong_class"
  | "wrong_group"
  | "wrong_bus"
  | "revoked"
  | "unknown"
  | "not_expected"
  | "disabled_device"
  | "offline_queued";

const STATE_META: Record<
  ScanState,
  { label: string; tone: "success" | "warning" | "danger"; icon: typeof CheckCircle2 }
> = {
  success: { label: "Attendance recorded", tone: "success", icon: CheckCircle2 },
  late: { label: "Late arrival", tone: "warning", icon: AlertTriangle },
  duplicate: { label: "Duplicate scan", tone: "warning", icon: AlertTriangle },
  wrong_class: { label: "Wrong class for this occasion", tone: "warning", icon: AlertTriangle },
  wrong_group: { label: "Wrong group for this occasion", tone: "warning", icon: AlertTriangle },
  wrong_bus: { label: "Wrong bus route", tone: "warning", icon: AlertTriangle },
  revoked: { label: "Revoked card", tone: "danger", icon: Ban },
  unknown: { label: "Unknown QR code", tone: "danger", icon: XCircle },
  not_expected: { label: "Learner not expected here", tone: "warning", icon: AlertTriangle },
  disabled_device: { label: "Device disabled", tone: "danger", icon: Ban },
  offline_queued: { label: "Offline — scan queued", tone: "warning", icon: WifiOff },
};

const STATE_ORDER: ScanState[] = [
  "success",
  "late",
  "duplicate",
  "wrong_class",
  "wrong_group",
  "wrong_bus",
  "revoked",
  "unknown",
  "not_expected",
  "disabled_device",
  "offline_queued",
];

const TONE_CLASSES: Record<"success" | "warning" | "danger", string> = {
  success: "bg-success-soft text-success border-success/30",
  warning: "bg-warning-soft text-[oklch(0.52_0.12_74)] border-[oklch(0.52_0.12_74)]/30",
  danger: "bg-danger-soft text-danger border-danger/30",
};

interface ScanResult {
  id: string;
  learnerName: string;
  admissionNumber: string;
  className: string;
  stream: string;
  photoHue: number;
  state: ScanState;
  time: string;
}

function ScanPage() {
  const occasionsQuery = useQuery({
    queryKey: ["scan-occasions"],
    queryFn: () => attendanceService.occasions(),
  });
  const devicesQuery = useQuery({
    queryKey: ["scan-devices"],
    queryFn: () => deviceService.list(),
  });
  const learnersQuery = useQuery({
    queryKey: ["scan-learners"],
    queryFn: () => learnerService.list({ pageSize: 40 }),
  });

  const [occasionId, setOccasionId] = useState<string>("");
  const [deviceId, setDeviceId] = useState<string>("");
  const [staffMember, setStaffMember] = useState("Moses Ochieng");
  const [online, setOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(() => queuedScans().length);
  const [sound, setSound] = useState(true);
  const [flash, setFlash] = useState(false);
  const [camera, setCamera] = useState<"rear" | "front">("rear");
  const [closeOpen, setCloseOpen] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [current, setCurrent] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const cycleRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (occasionsQuery.data?.length && !occasionId) setOccasionId(occasionsQuery.data[0]!.id);
  }, [occasionsQuery.data, occasionId]);
  useEffect(() => {
    if (devicesQuery.data?.length && !deviceId) setDeviceId(devicesQuery.data[0]!.id);
  }, [devicesQuery.data, deviceId]);

  const occasion = occasionsQuery.data?.find((o) => o.id === occasionId);
  const device = devicesQuery.data?.find((d) => d.id === deviceId);
  const learners = learnersQuery.data?.data ?? [];

  const showResult = (learner: (typeof learners)[number], state: ScanState) => {
    const time = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const result: ScanResult = {
      id: `res-${Date.now()}`,
      learnerName: learner.fullName,
      admissionNumber: learner.admissionNumber,
      className: learner.className,
      stream: learner.stream,
      photoHue: learner.photoHue,
      state,
      time,
    };
    setCurrent(result);
    setHistory((h) => [result, ...h].slice(0, 25));
    if (sound)
      toast(STATE_META[state].label, {
        description: `${learner.fullName} · ${learner.admissionNumber}`,
      });
  };

  const triggerMockScan = (forcedState?: ScanState) => {
    if (learners.length === 0) return;
    const idx = cycleRef.current % learners.length;
    const learner = learners[idx]!;
    cycleRef.current += 1;
    const state = forcedState ?? STATE_ORDER[cycleRef.current % STATE_ORDER.length]!;
    const resultState = online ? state : "offline_queued";
    if (!online) setPendingSync((p) => p + 1);
    showResult(learner, resultState);
  };

  const handleManualSubmit = async () => {
    if (!manualInput.trim()) return;
    if (USE_MOCK_DATA) {
      triggerMockScan();
      setManualInput("");
      return;
    }
    if (!occasionId || !deviceId) {
      toast.error("Select an occasion and device first");
      return;
    }
    const event = {
      credential: manualInput.trim(),
      occasionId,
      deviceId,
      clientEventId: crypto.randomUUID(),
      recordedAt: new Date().toISOString(),
    };
    if (!online) {
      setPendingSync(queueScan(event));
      const learner = learners[0];
      if (learner) showResult(learner, "offline_queued");
      setManualInput("");
      return;
    }
    try {
      const response = await attendanceService.scan(event);
      const learner = response.learner;
      if (learner)
        showResult(
          learner,
          response.outcome === "accepted"
            ? "success"
            : response.outcome === "revoked_card"
              ? "revoked"
              : (response.outcome as ScanState),
        );
      else
        toast.error(
          STATE_META[response.outcome === "unknown_card" ? "unknown" : "not_expected"].label,
        );
    } catch {
      queueScan(event);
      setPendingSync(queuedScans().length);
      toast.warning("Network unavailable — scan queued safely");
    }
    setManualInput("");
  };

  useEffect(() => {
    if (!online || USE_MOCK_DATA || pendingSync === 0) return;
    const events = queuedScans();
    if (!events.length) return;
    void attendanceService
      .sync({ clientBatchId: crypto.randomUUID(), events })
      .then(() => {
        clearQueuedScans();
        setPendingSync(0);
        toast.success("Offline scans synchronized");
      })
      .catch(() => undefined);
  }, [online, pendingSync]);

  const meta = current ? STATE_META[current.state] : null;
  const Icon = meta?.icon ?? ScanLine;

  return (
    <AppShell
      fullBleed
      permission={["attendance.record", "attendance.view"]}
      area="the scanning workspace"
    >
      <div className="flex min-h-[calc(100vh-56px)] flex-col bg-primary text-primary-foreground">
        {/* Header strip */}
        <div className="flex flex-wrap items-center gap-2 border-b border-primary-foreground/10 bg-primary px-4 py-2.5">
          <Select value={occasionId} onValueChange={setOccasionId}>
            <SelectTrigger
              className="h-9 w-auto min-w-[190px] border-primary-foreground/20 bg-primary-foreground/10 text-[12.5px] text-primary-foreground"
              aria-label="Occasion"
            >
              <SelectValue placeholder="Occasion" />
            </SelectTrigger>
            <SelectContent>
              {(occasionsQuery.data ?? []).map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={deviceId} onValueChange={setDeviceId}>
            <SelectTrigger
              className="h-9 w-auto min-w-[170px] border-primary-foreground/20 bg-primary-foreground/10 text-[12.5px] text-primary-foreground"
              aria-label="Device"
            >
              <SelectValue placeholder="Device" />
            </SelectTrigger>
            <SelectContent>
              {(devicesQuery.data ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            aria-label="Staff member"
            value={staffMember}
            onChange={(e) => setStaffMember(e.target.value)}
            className="h-9 w-[160px] border-primary-foreground/20 bg-primary-foreground/10 text-[12.5px] text-primary-foreground placeholder:text-primary-foreground/60"
          />
          <div className="ml-auto flex items-center gap-3 text-[12px]">
            <span className="hidden text-primary-foreground/70 sm:inline">
              {device?.location ?? "Checkpoint"}
            </span>
            <button
              type="button"
              onClick={() => setOnline((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium",
                online
                  ? "border-success/40 bg-success-soft text-success"
                  : "border-warning/40 bg-warning-soft text-[oklch(0.52_0.12_74)]",
              )}
            >
              {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {online ? "Online" : "Offline"}
            </button>
            <span className="rounded-full bg-primary-foreground/10 px-2.5 py-1 font-medium">
              {pendingSync} pending sync
            </span>
          </div>
        </div>

        <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1.5fr)_360px]">
          {/* Scanner viewport */}
          <div className="flex flex-col gap-4">
            <div className="relative flex min-h-[320px] flex-1 items-center justify-center overflow-hidden rounded-2xl border border-primary-foreground/15 bg-[oklch(0.18_0.03_255)]">
              <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-dashed border-primary-foreground/25" />
              <div className="scan-line pointer-events-none absolute inset-x-6 h-0.5 bg-cyan shadow-[0_0_16px_2px_var(--color-cyan)]" />
              <div className="flex flex-col items-center gap-3 text-primary-foreground/70">
                <ScanLine className="h-14 w-14" />
                <p className="text-[13px]">Position the learner's QR card within the frame</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 p-3">
              <Input
                ref={inputRef}
                autoFocus
                aria-label="Manual credential entry"
                placeholder="Scan or type QR serial, then press Enter (simulates USB scanner input)"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleManualSubmit()}
                className="h-11 flex-1 border-primary-foreground/20 bg-primary-foreground/10 text-[13.5px] text-primary-foreground placeholder:text-primary-foreground/50"
              />
              <Button size="lg" className="h-11" onClick={() => void handleManualSubmit()}>
                {USE_MOCK_DATA ? "Simulate scan" : "Record scan"}
              </Button>
            </div>

            {/* Result card */}
            <div
              className={cn(
                "flex flex-1 items-center gap-5 rounded-2xl border-2 p-6",
                meta
                  ? TONE_CLASSES[meta.tone]
                  : "border-primary-foreground/15 bg-primary-foreground/5 text-primary-foreground/60",
              )}
            >
              {current ? (
                <>
                  <LearnerAvatar name={current.learnerName} hue={current.photoHue} size={92} ring />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-6 w-6 shrink-0" />
                      <p className="truncate text-lg font-semibold">{meta!.label}</p>
                    </div>
                    <p className="mt-1 truncate text-xl font-bold">{current.learnerName}</p>
                    <p className="text-[13px] opacity-80">
                      {current.admissionNumber} · {current.className} {current.stream}
                    </p>
                    <p className="mt-1 text-[13px] opacity-80">
                      {occasion?.name ?? "Occasion"} · Scanned at {current.time}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex w-full flex-col items-center justify-center gap-2 text-center">
                  <ScanLine className="h-8 w-8" />
                  <p className="text-[13px]">Awaiting first scan for this session</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 p-3">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-primary-foreground/70">
                Controls
              </p>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center justify-between rounded-lg bg-primary-foreground/5 px-3 py-2">
                  <span className="flex items-center gap-2 text-[13px]">
                    {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}{" "}
                    Sound
                  </span>
                  <Switch checked={sound} onCheckedChange={setSound} aria-label="Toggle sound" />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-primary-foreground/5 px-3 py-2">
                  <span className="flex items-center gap-2 text-[13px]">
                    <Flashlight className="h-4 w-4" /> Flash
                  </span>
                  <Switch checked={flash} onCheckedChange={setFlash} aria-label="Toggle flash" />
                </div>
                <Button
                  variant="outline"
                  className="h-9 justify-start gap-2 border-primary-foreground/20 bg-primary-foreground/10 text-[13px] text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={() => setCamera((c) => (c === "rear" ? "front" : "rear"))}
                >
                  <Camera className="h-4 w-4" /> Switch camera ({camera})
                </Button>
                <Button
                  variant="destructive"
                  className="h-9 gap-2"
                  onClick={() => setCloseOpen(true)}
                >
                  Close occasion
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 p-3">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-primary-foreground/70">
                State simulator
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {STATE_ORDER.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => triggerScan(s)}
                    className={cn(
                      "rounded-md border px-2 py-1.5 text-left text-[11px] font-medium",
                      TONE_CLASSES[STATE_META[s].tone],
                    )}
                  >
                    {STATE_META[s].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-hidden rounded-xl border border-primary-foreground/15 bg-primary-foreground/5">
              <p className="border-b border-primary-foreground/10 px-3 py-2 text-[12px] font-semibold uppercase tracking-wide text-primary-foreground/70">
                Recent scans
              </p>
              <ul className="max-h-[360px] divide-y divide-primary-foreground/10 overflow-y-auto">
                {history.length === 0 ? (
                  <li className="px-3 py-6 text-center text-[12px] text-primary-foreground/50">
                    No scans yet this session.
                  </li>
                ) : (
                  history.map((h) => (
                    <li key={h.id} className="flex items-center gap-2 px-3 py-2">
                      <LearnerAvatar name={h.learnerName} hue={h.photoHue} size={26} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium">{h.learnerName}</p>
                        <p className="truncate text-[11px] text-primary-foreground/60">
                          {h.admissionNumber} · {h.time}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                          TONE_CLASSES[STATE_META[h.state].tone],
                        )}
                      >
                        {STATE_META[h.state].label}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close {occasion?.name ?? "this occasion"}?</AlertDialogTitle>
            <AlertDialogDescription>
              No further scans will be accepted for this occasion once closed. Any learners not yet
              scanned will be marked unexplained pending reconciliation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toast.success("Occasion closed", { description: occasion?.name });
                setCloseOpen(false);
              }}
            >
              Close occasion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <style>{`
        @keyframes scan-line-move { 0% { top: 8%; } 50% { top: 88%; } 100% { top: 8%; } }
        .scan-line { animation: scan-line-move 2.4s ease-in-out infinite; }
      `}</style>
    </AppShell>
  );
}
