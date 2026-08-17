import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fingerprint, ScanFace, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { MetricCard, PageHeader, SectionCard } from "@/components/common/Primitives";
import { EmptyState, ErrorState, SensitiveNotice, TableSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { biometricService, attendanceService, deviceService, learnerService } from "@/services";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/biometrics")({
  head: () => ({ meta: [{ title: "Biometric attendance — Nile Crest SAPWMS" }] }),
  component: BiometricsPage,
});

function BiometricsPage() {
  const { can } = useAuth();
  const client = useQueryClient();
  const [learnerId, setLearnerId] = useState("");
  const [modality, setModality] = useState<"face" | "fingerprint">("face");
  const [providerReference, setProviderReference] = useState("");
  const [consentBy, setConsentBy] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [occasionId, setOccasionId] = useState("");
  const [deviceSecret, setDeviceSecret] = useState("");
  const [confidence, setConfidence] = useState("0.96");
  const [liveness, setLiveness] = useState("0.92");
  const learners = useQuery({
    queryKey: ["biometric-learners"],
    queryFn: () => learnerService.list({ pageSize: 100 }),
  });
  const credentials = useQuery({
    queryKey: ["biometric-credentials"],
    queryFn: () => biometricService.credentials(),
  });
  const captures = useQuery({
    queryKey: ["biometric-captures"],
    queryFn: biometricService.captures,
  });
  const devices = useQuery({ queryKey: ["biometric-devices"], queryFn: deviceService.list });
  const occasions = useQuery({
    queryKey: ["biometric-occasions"],
    queryFn: attendanceService.occasions,
  });
  const active = useMemo(
    () => credentials.data?.filter((item) => item.status === "active") ?? [],
    [credentials.data],
  );
  const pending = captures.data?.filter((item) => item.reviewStatus === "pending") ?? [];
  const enrolledLearners = useMemo(
    () => new Set(active.map((item) => item.learnerId)).size,
    [active],
  );
  const refresh = async () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ["biometric-credentials"] }),
      client.invalidateQueries({ queryKey: ["biometric-captures"] }),
    ]);
  const enroll = useMutation({
    mutationFn: () =>
      biometricService.enroll(learnerId, {
        modality,
        provider: "device-adapter",
        ...(providerReference ? { providerReference } : {}),
        qualityScore: 0.95,
        consentRecorded: true,
        consentBy,
      }),
    onSuccess: async () => {
      await refresh();
      toast.success("Biometric enrollment saved");
      setProviderReference("");
    },
    onError: (error: Error) => toast.error("Enrollment failed", { description: error.message }),
  });
  const verify = useMutation({
    mutationFn: async () => {
      const device = devices.data?.find((item) => item.id === deviceId);
      if (!device) throw new Error("Select a registered device");
      await deviceService.authenticate(device.publicId ?? "NCS-GATE-01", deviceSecret);
      return biometricService.verify({
        learnerId,
        occasionId,
        deviceId,
        modality,
        provider: "device-adapter",
        confidence: Number(confidence),
        ...(modality === "face" ? { livenessScore: Number(liveness) } : {}),
      });
    },
    onSuccess: async (result) => {
      await refresh();
      if (result.accepted) toast.success("Attendance recorded");
      else toast.warning(`Capture result: ${result.outcome}`);
    },
    onError: (error: Error) => toast.error("Verification failed", { description: error.message }),
  });
  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "rejected" }) =>
      biometricService.review(
        id,
        decision,
        decision === "approved"
          ? "Identity confirmed by authorised staff"
          : "Identity could not be confirmed",
      ),
    onSuccess: async () => {
      await refresh();
      toast.success("Review decision recorded");
    },
  });

  return (
    <AppShell permission="devices.view" area="biometric attendance">
      <PageHeader
        title="Biometric attendance"
        description="Enroll biometric references, test trusted device adapters and review uncertain matches."
      />
      <SensitiveNotice>
        Raw face photographs and fingerprint images must remain inside the approved biometric
        device/provider. This platform stores only enrollment references, scores, decisions and
        audit evidence.
      </SensitiveNotice>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Active credentials"
          value={active.length}
          icon={Fingerprint}
          tone="navy"
        />
        <MetricCard
          label="Enrolled learners"
          value={enrolledLearners}
          icon={ScanFace}
          tone="cyan"
        />
        <MetricCard
          label="Awaiting review"
          value={pending.length}
          icon={ShieldCheck}
          tone="warning"
        />
      </div>
      <Tabs defaultValue="enrollment" className="mt-4">
        <TabsList>
          <TabsTrigger value="enrollment">Enrollment</TabsTrigger>
          <TabsTrigger value="adapter">Device adapter test</TabsTrigger>
          <TabsTrigger value="review">Review queue</TabsTrigger>
        </TabsList>
        <TabsContent value="enrollment">
          <SectionCard
            title="Enroll learner biometrics"
            description="Record consent and link the learner to a template held by the approved provider"
            bodyClassName="p-4"
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <Field label="Learner">
                  <Select value={learnerId} onValueChange={setLearnerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose learner" />
                    </SelectTrigger>
                    <SelectContent>
                      {learners.data?.data.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.fullName} · {item.admissionNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Modality">
                  <Select
                    value={modality}
                    onValueChange={(value) => setModality(value as typeof modality)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="face">Face with liveness</SelectItem>
                      <SelectItem value="fingerprint">Fingerprint</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Provider template reference">
                  <Input
                    value={providerReference}
                    onChange={(event) => setProviderReference(event.target.value)}
                    placeholder="Returned by device SDK after enrollment"
                  />
                </Field>
                <Field label="Consent recorded from">
                  <Input
                    value={consentBy}
                    onChange={(event) => setConsentBy(event.target.value)}
                    placeholder="Guardian or eligible learner name"
                  />
                </Field>
                {can("learners.manage") ? (
                  <Button
                    disabled={!learnerId || !consentBy || enroll.isPending}
                    onClick={() => enroll.mutate()}
                  >
                    <UserPlus className="h-4 w-4" />
                    {enroll.isPending ? "Saving…" : "Save enrollment"}
                  </Button>
                ) : null}
              </div>
              <CredentialList loading={credentials.isLoading} items={credentials.data ?? []} />
            </div>
          </SectionCard>
        </TabsContent>
        <TabsContent value="adapter">
          <SectionCard
            title="Trusted device-adapter test"
            description="Simulates the signed result that a face or fingerprint SDK sends after local matching"
            bodyClassName="p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Learner">
                <Select value={learnerId} onValueChange={setLearnerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose enrolled learner" />
                  </SelectTrigger>
                  <SelectContent>
                    {learners.data?.data.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Modality">
                <Select
                  value={modality}
                  onValueChange={(value) => setModality(value as typeof modality)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="face">Face</SelectItem>
                    <SelectItem value="fingerprint">Fingerprint</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Attendance occasion">
                <Select value={occasionId} onValueChange={setOccasionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose occasion" />
                  </SelectTrigger>
                  <SelectContent>
                    {occasions.data?.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Approved device">
                <Select value={deviceId} onValueChange={setDeviceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose device" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.data?.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Device secret">
                <Input
                  type="password"
                  value={deviceSecret}
                  onChange={(event) => setDeviceSecret(event.target.value)}
                />
              </Field>
              <Field label="Match confidence (0–1)">
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={confidence}
                  onChange={(event) => setConfidence(event.target.value)}
                />
              </Field>
              {modality === "face" ? (
                <Field label="Liveness score (0–1)">
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={liveness}
                    onChange={(event) => setLiveness(event.target.value)}
                  />
                </Field>
              ) : null}
            </div>
            <Button
              className="mt-4"
              disabled={!learnerId || !occasionId || !deviceId || !deviceSecret || verify.isPending}
              onClick={() => verify.mutate()}
            >
              {modality === "face" ? (
                <ScanFace className="h-4 w-4" />
              ) : (
                <Fingerprint className="h-4 w-4" />
              )}
              {verify.isPending ? "Verifying…" : "Submit adapter verification"}
            </Button>
          </SectionCard>
        </TabsContent>
        <TabsContent value="review">
          <SectionCard
            title="Biometric exception review"
            description="Human review is required for uncertain or below-threshold captures"
            bodyClassName="p-4"
          >
            {captures.isLoading ? (
              <TableSkeleton rows={5} columns={5} />
            ) : captures.isError ? (
              <ErrorState message={(captures.error as Error).message} />
            ) : pending.length === 0 ? (
              <EmptyState
                title="No captures need review"
                description="Below-threshold biometric attempts will appear here."
              />
            ) : (
              <div className="space-y-2">
                {pending.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {item.learner
                          ? `${item.learner.firstName} ${item.learner.lastName}`
                          : "Unresolved identity"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.modality} · confidence {Math.round((item.confidence ?? 0) * 100)}% ·{" "}
                        {item.device?.name}
                      </p>
                    </div>
                    <StatusBadge status={item.outcome} tone="warning" />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => review.mutate({ id: item.id, decision: "rejected" })}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => review.mutate({ id: item.id, decision: "approved" })}
                    >
                      Approve
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function CredentialList({
  loading,
  items,
}: {
  loading: boolean;
  items: Awaited<ReturnType<typeof biometricService.credentials>>;
}) {
  if (loading) return <TableSkeleton rows={4} columns={3} />;
  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <EmptyState
          title="No biometric credentials"
          description="Enroll the first face or fingerprint reference."
        />
      ) : (
        items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
            {item.modality === "face" ? (
              <ScanFace className="h-5 w-5" />
            ) : (
              <Fingerprint className="h-5 w-5" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {item.learner
                  ? `${item.learner.firstName} ${item.learner.lastName}`
                  : item.learnerId}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.provider} · {item.providerReference ?? "awaiting provider enrollment"}
              </p>
            </div>
            <StatusBadge status={item.status} />
          </div>
        ))
      )}
    </div>
  );
}
