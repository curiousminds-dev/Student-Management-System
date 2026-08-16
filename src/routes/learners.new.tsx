import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  IdCard,
  QrCode,
  Save,
  ShieldCheck,
  User,
  Users,
  Bus,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, SectionCard } from "@/components/common/Primitives";
import { LearnerAvatar } from "@/components/common/LearnerAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { learnerService } from "@/services";
import { cn } from "@/lib/utils";
import type { Learner } from "@/types";

export const Route = createFileRoute("/learners/new")({
  head: () => ({
    meta: [
      { title: "Register a learner — Nile Crest SAPWMS" },
      {
        name: "description",
        content:
          "Multi-step wizard to enrol a new learner, capture guardian details and issue a QR credential.",
      },
      { property: "og:title", content: "Register a learner — Nile Crest SAPWMS" },
      {
        property: "og:description",
        content: "Enrol a new learner and issue a QR attendance credential.",
      },
    ],
  }),
  component: LearnerRegistrationPage,
});

const CLASS_OPTIONS = [
  "Senior One",
  "Senior Two",
  "Senior Three",
  "Senior Four",
  "Senior Five",
  "Senior Six",
] as const;
const STREAM_OPTIONS = ["East", "West", "North", "South"];
const HOUSE_OPTIONS = ["Nkuba", "Rwenzori", "Elgon", "Victoria"];

const personalSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  gender: z.enum(["Male", "Female"], { required_error: "Select a gender" }),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  lin: z.string().min(6, "LIN must be at least 6 characters"),
  unebNumber: z.string().optional(),
});

const enrolmentSchema = z.object({
  className: z.enum(CLASS_OPTIONS, { required_error: "Select a class" }),
  stream: z.string().min(1, "Select a stream"),
  house: z.string().min(1, "Select a house"),
  enrolledOn: z.string().min(1, "Enrolment date is required"),
});

const guardianSchema = z.object({
  name: z.string().min(2, "Guardian name is required"),
  relationship: z.string().min(2, "Relationship is required"),
  phone: z.string().regex(/^\+256\s?7\d{2}\s?\d{3}\s?\d{3}$/, "Use format +256 7XX XXX XXX"),
  alternatePhone: z.string().optional(),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  occupation: z.string().optional(),
});

const boardingSchema = z.object({
  residence: z.enum(["Day", "Boarding"], { required_error: "Select day or boarding" }),
  dormitory: z.string().optional(),
  transportRoute: z.string().optional(),
});

const emergencySchema = z.object({
  name: z.string().min(2, "Emergency contact name is required"),
  relationship: z.string().min(2, "Relationship is required"),
  phone: z.string().regex(/^\+256\s?7\d{2}\s?\d{3}\s?\d{3}$/, "Use format +256 7XX XXX XXX"),
});

const consentSchema = z.object({
  dataConsent: z.boolean().refine((v) => v, "Guardian consent is required to proceed"),
  photoConsent: z.boolean().optional(),
  medicalNotes: z.string().optional(),
});

type PersonalValues = z.infer<typeof personalSchema>;
type EnrolmentValues = z.infer<typeof enrolmentSchema>;
type GuardianValues = z.infer<typeof guardianSchema>;
type BoardingValues = z.infer<typeof boardingSchema>;
type EmergencyValues = z.infer<typeof emergencySchema>;
type ConsentValues = z.infer<typeof consentSchema>;

const STEPS = [
  { key: "personal", label: "Personal details", icon: User },
  { key: "enrolment", label: "Enrolment", icon: IdCard },
  { key: "guardian", label: "Guardian details", icon: Users },
  { key: "boarding", label: "Boarding & transport", icon: Bus },
  { key: "emergency", label: "Emergency contact", icon: Phone },
  { key: "consent", label: "Consent & privacy", icon: ShieldCheck },
  { key: "credential", label: "QR credential", icon: QrCode },
] as const;

function Required() {
  return <span className="text-danger">*</span>;
}

function Stepper({ step, furthest }: { step: number; furthest: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-y-3">
      {STEPS.map((s, i) => {
        const state = i < furthest ? "done" : i === step ? "current" : "upcoming";
        const Icon = s.icon;
        return (
          <li key={s.key} className="flex items-center">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-semibold",
                  state === "done" && "border-primary bg-primary text-primary-foreground",
                  state === "current" && "border-primary text-primary",
                  state === "upcoming" && "border-border text-muted-foreground",
                )}
              >
                {state === "done" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </span>
              <span
                className={cn(
                  "hidden text-[12px] font-medium sm:inline",
                  state === "upcoming" ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 ? <span className="mx-2 h-px w-6 bg-border sm:w-8" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function LearnerRegistrationPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [submitted, setSubmitted] = useState<Learner | null>(null);

  const [personal, setPersonal] = useState<PersonalValues>({
    firstName: "",
    lastName: "",
    gender: "Female",
    dateOfBirth: "",
    lin: "",
    unebNumber: "",
  });
  const [enrolment, setEnrolment] = useState<EnrolmentValues>({
    className: "Senior One",
    stream: "East",
    house: "Nkuba",
    enrolledOn: new Date().toISOString().slice(0, 10),
  });
  const [guardian, setGuardian] = useState<GuardianValues>({
    name: "",
    relationship: "Mother",
    phone: "",
    alternatePhone: "",
    email: "",
    occupation: "",
  });
  const [boarding, setBoarding] = useState<BoardingValues>({
    residence: "Day",
    dormitory: "",
    transportRoute: "",
  });
  const [emergency, setEmergency] = useState<EmergencyValues>({
    name: "",
    relationship: "",
    phone: "",
  });
  const [consent, setConsent] = useState<ConsentValues>({
    dataConsent: false,
    photoConsent: true,
    medicalNotes: "",
  });

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Learner>) => learnerService.create(payload),
    onSuccess: (learner) => {
      setSubmitted(learner);
      toast.success("Learner registered", {
        description: `${learner.fullName} has been added to the register.`,
      });
    },
    onError: () =>
      toast.error("Registration failed", { description: "Please try submitting again." }),
  });

  const saveDraft = () =>
    toast("Draft saved", {
      description: "You can resume this registration later from Learners → Drafts.",
    });

  const goNext = () => {
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    setFurthest((f) => Math.max(f, step + 1));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const fullName = `${personal.firstName} ${personal.lastName}`.trim();

  const handleFinalSubmit = () => {
    const admissionNumber = `NCS-${enrolment.className.replace("Senior ", "S")}-${Math.floor(1000 + Math.random() * 9000)}`;
    const qrSerial = `QR-${Date.now().toString(36).toUpperCase()}`;
    createMutation.mutate({
      firstName: personal.firstName,
      lastName: personal.lastName,
      fullName,
      admissionNumber,
      lin: personal.lin,
      unebNumber: personal.unebNumber || undefined,
      className: enrolment.className,
      stream: enrolment.stream,
      house: enrolment.house,
      gender: personal.gender,
      residence: boarding.residence,
      dormitory: boarding.residence === "Boarding" ? boarding.dormitory || null : null,
      dateOfBirth: personal.dateOfBirth,
      enrolledOn: enrolment.enrolledOn,
      qrStatus: "active",
      qrSerial,
      status: "active",
      guardian: {
        name: guardian.name,
        relationship: guardian.relationship,
        phone: guardian.phone,
        alternatePhone: guardian.alternatePhone || undefined,
        email: guardian.email || undefined,
        occupation: guardian.occupation || undefined,
      },
      emergencyContact: {
        name: emergency.name,
        relationship: emergency.relationship,
        phone: emergency.phone,
      },
      medicalNotes: consent.medicalNotes || undefined,
    });
  };

  if (submitted) {
    return (
      <AppShell permission="learners.manage" area="learner registration">
        <PageHeader
          title="Learner registered"
          description="The learner has been added to the register with an active QR credential."
        />
        <div className="mx-auto max-w-xl">
          <SectionCard className="text-center" bodyClassName="px-6 py-8">
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-success-soft text-success">
              <Check className="h-7 w-7" />
            </span>
            <div className="mx-auto mb-4 flex items-center justify-center gap-3">
              <LearnerAvatar name={submitted.fullName} hue={submitted.photoHue ?? 210} size={56} />
              <div className="text-left">
                <p className="text-[15px] font-semibold text-foreground">{submitted.fullName}</p>
                <p className="text-[12px] text-muted-foreground">
                  {submitted.className} · {submitted.stream}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/40 p-4 text-left">
              <div>
                <p className="text-[11px] text-muted-foreground">Admission number</p>
                <p className="font-mono text-[13px] font-semibold text-foreground">
                  {submitted.admissionNumber}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">QR serial</p>
                <p className="font-mono text-[13px] font-semibold text-foreground">
                  {submitted.qrSerial}
                </p>
              </div>
            </div>
            <div className="mx-auto mt-5 grid h-28 w-28 place-items-center rounded-lg border border-border bg-card">
              <div
                aria-label="QR credential placeholder"
                className="grid h-20 w-20 grid-cols-5 grid-rows-5 gap-0.5 p-1"
              >
                {Array.from({ length: 25 }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "rounded-[1px]",
                      (i * 7 + submitted.fullName.length) % 3 === 0 ? "bg-foreground" : "bg-muted",
                    )}
                  />
                ))}
              </div>
            </div>
            <div className="mt-6 flex justify-center gap-2">
              <Button asChild size="sm">
                <Link to="/learners">Back to learners</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/learners/$id" params={{ id: submitted.id }}>
                  View learner profile
                </Link>
              </Button>
            </div>
          </SectionCard>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell permission="learners.manage" area="learner registration">
      <PageHeader
        title="Register a learner"
        description="Complete each step to enrol a new learner and issue a QR attendance credential."
        actions={
          <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={saveDraft}>
            <Save className="h-3.5 w-3.5" /> Save draft
          </Button>
        }
      />

      <SectionCard bodyClassName="px-4 py-3">
        <Stepper step={step} furthest={furthest} />
      </SectionCard>

      <div className="mt-4">
        {step === 0 && (
          <PersonalStep
            defaultValues={personal}
            onSubmit={(v) => {
              setPersonal(v);
              goNext();
            }}
          />
        )}
        {step === 1 && (
          <EnrolmentStep
            defaultValues={enrolment}
            onBack={goBack}
            onSubmit={(v) => {
              setEnrolment(v);
              goNext();
            }}
          />
        )}
        {step === 2 && (
          <GuardianStep
            defaultValues={guardian}
            onBack={goBack}
            onSubmit={(v) => {
              setGuardian(v);
              goNext();
            }}
          />
        )}
        {step === 3 && (
          <BoardingStep
            defaultValues={boarding}
            onBack={goBack}
            onSubmit={(v) => {
              setBoarding(v);
              goNext();
            }}
          />
        )}
        {step === 4 && (
          <EmergencyStep
            defaultValues={emergency}
            onBack={goBack}
            onSubmit={(v) => {
              setEmergency(v);
              goNext();
            }}
          />
        )}
        {step === 5 && (
          <ConsentStep
            defaultValues={consent}
            onBack={goBack}
            onSubmit={(v) => {
              setConsent(v);
              goNext();
            }}
          />
        )}
        {step === 6 && (
          <CredentialStep
            fullName={fullName || "New learner"}
            onBack={goBack}
            submitting={createMutation.isPending}
            onSubmit={handleFinalSubmit}
          />
        )}
      </div>
    </AppShell>
  );
}

function StepShell({
  title,
  description,
  onBack,
  onSubmit,
  submitLabel = "Save & continue",
  submitting,
  children,
}: {
  title: string;
  description: string;
  onBack?: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  submitting?: boolean;
  children: React.ReactNode;
}) {
  return (
    <SectionCard title={title} description={description}>
      <div className="space-y-4 px-4 py-4">{children}</div>
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-[12px]"
          onClick={onBack}
          disabled={!onBack}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Previous
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 text-[12px]"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? "Saving…" : submitLabel} <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </SectionCard>
  );
}

function PersonalStep({
  defaultValues,
  onSubmit,
}: {
  defaultValues: PersonalValues;
  onSubmit: (v: PersonalValues) => void;
}) {
  const form = useForm<PersonalValues>({ resolver: zodResolver(personalSchema), defaultValues });
  return (
    <Form {...form}>
      <StepShell
        title="Personal details"
        description="Capture the learner's identity as it appears on official records."
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  First name
                  <Required />
                </FormLabel>
                <FormControl>
                  <Input placeholder="Nakato" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Last name
                  <Required />
                </FormLabel>
                <FormControl>
                  <Input placeholder="Namuli" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Gender
                  <Required />
                </FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dateOfBirth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Date of birth
                  <Required />
                </FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Learner Identification Number (LIN)
                  <Required />
                </FormLabel>
                <FormControl>
                  <Input placeholder="UG-LIN-00219384" {...field} />
                </FormControl>
                <FormDescription>
                  Issued by UNEB / NIRA; ask the guardian for the learner's LIN slip.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="unebNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>UNEB number</FormLabel>
                <FormControl>
                  <Input placeholder="Optional, for Senior Four/Six candidates" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </StepShell>
    </Form>
  );
}

function EnrolmentStep({
  defaultValues,
  onBack,
  onSubmit,
}: {
  defaultValues: EnrolmentValues;
  onBack: () => void;
  onSubmit: (v: EnrolmentValues) => void;
}) {
  const form = useForm<EnrolmentValues>({ resolver: zodResolver(enrolmentSchema), defaultValues });
  return (
    <Form {...form}>
      <StepShell
        title="Enrolment"
        description="Assign the class, stream and house for this term."
        onBack={onBack}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="className"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Class
                  <Required />
                </FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CLASS_OPTIONS.map((c) => (
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
            name="stream"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Stream
                  <Required />
                </FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {STREAM_OPTIONS.map((c) => (
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
            name="house"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  House
                  <Required />
                </FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {HOUSE_OPTIONS.map((c) => (
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
            name="enrolledOn"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Enrolment date
                  <Required />
                </FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormDescription>Term Two 2026 begins 11 May 2026.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </StepShell>
    </Form>
  );
}

function GuardianStep({
  defaultValues,
  onBack,
  onSubmit,
}: {
  defaultValues: GuardianValues;
  onBack: () => void;
  onSubmit: (v: GuardianValues) => void;
}) {
  const form = useForm<GuardianValues>({ resolver: zodResolver(guardianSchema), defaultValues });
  return (
    <Form {...form}>
      <StepShell
        title="Guardian details"
        description="Primary guardian contact used for notifications and consent."
        onBack={onBack}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Full name
                  <Required />
                </FormLabel>
                <FormControl>
                  <Input placeholder="Mrs. Harriet Nansubuga" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="relationship"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Relationship to learner
                  <Required />
                </FormLabel>
                <FormControl>
                  <Input placeholder="Mother, Father, Aunt…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Phone number
                  <Required />
                </FormLabel>
                <FormControl>
                  <Input placeholder="+256 772 445 118" {...field} />
                </FormControl>
                <FormDescription>Format: +256 7XX XXX XXX</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="alternatePhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Alternate phone</FormLabel>
                <FormControl>
                  <Input placeholder="Optional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="Optional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="occupation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Occupation</FormLabel>
                <FormControl>
                  <Input placeholder="Optional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </StepShell>
    </Form>
  );
}

function BoardingStep({
  defaultValues,
  onBack,
  onSubmit,
}: {
  defaultValues: BoardingValues;
  onBack: () => void;
  onSubmit: (v: BoardingValues) => void;
}) {
  const form = useForm<BoardingValues>({ resolver: zodResolver(boardingSchema), defaultValues });
  const residence = form.watch("residence");
  return (
    <Form {...form}>
      <StepShell
        title="Boarding and transport"
        description="Indicate residence status and any transport arrangements."
        onBack={onBack}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="residence"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Residence
                  <Required />
                </FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Day">Day</SelectItem>
                    <SelectItem value="Boarding">Boarding</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {residence === "Boarding" ? (
            <FormField
              control={form.control}
              name="dormitory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dormitory</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Kaguta Dormitory, Room 4" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <FormField
              control={form.control}
              name="transportRoute"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transport route</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Ntinda–Bukoto shuttle" {...field} />
                  </FormControl>
                  <FormDescription>
                    Leave blank if the learner travels independently.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
      </StepShell>
    </Form>
  );
}

function EmergencyStep({
  defaultValues,
  onBack,
  onSubmit,
}: {
  defaultValues: EmergencyValues;
  onBack: () => void;
  onSubmit: (v: EmergencyValues) => void;
}) {
  const form = useForm<EmergencyValues>({ resolver: zodResolver(emergencySchema), defaultValues });
  return (
    <Form {...form}>
      <StepShell
        title="Emergency contact"
        description="A contact other than the primary guardian to reach in an emergency."
        onBack={onBack}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Full name
                  <Required />
                </FormLabel>
                <FormControl>
                  <Input placeholder="Mr. Peter Okello" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="relationship"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Relationship
                  <Required />
                </FormLabel>
                <FormControl>
                  <Input placeholder="Uncle, family friend…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Phone number
                  <Required />
                </FormLabel>
                <FormControl>
                  <Input placeholder="+256 701 223 456" {...field} />
                </FormControl>
                <FormDescription>Format: +256 7XX XXX XXX</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </StepShell>
    </Form>
  );
}

function ConsentStep({
  defaultValues,
  onBack,
  onSubmit,
}: {
  defaultValues: ConsentValues;
  onBack: () => void;
  onSubmit: (v: ConsentValues) => void;
}) {
  const form = useForm<ConsentValues>({ resolver: zodResolver(consentSchema), defaultValues });
  return (
    <Form {...form}>
      <StepShell
        title="Consent and privacy"
        description="Confirm the guardian's consent for data processing and any medical notes."
        onBack={onBack}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name="dataConsent"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start gap-2 space-y-0 rounded-lg border border-border p-3">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label="Guardian data consent"
                />
              </FormControl>
              <div>
                <FormLabel className="font-medium">
                  Guardian consents to data processing
                  <Required />
                </FormLabel>
                <FormDescription>
                  Required to store attendance, academic and welfare records for this learner.
                </FormDescription>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="photoConsent"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start gap-2 space-y-0 rounded-lg border border-border p-3">
              <FormControl>
                <Checkbox
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                  aria-label="Photo consent"
                />
              </FormControl>
              <div>
                <FormLabel className="font-medium">
                  Guardian consents to use of learner's photo
                </FormLabel>
                <FormDescription>
                  Used only for internal identification, e.g. QR credential and ID card.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="medicalNotes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Medical notes</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="e.g. Mild asthma — carries own inhaler"
                  {...field}
                />
              </FormControl>
              <FormDescription>Visible to nurse and welfare roles only.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </StepShell>
    </Form>
  );
}

function CredentialStep({
  fullName,
  onBack,
  onSubmit,
  submitting,
}: {
  fullName: string;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <SectionCard
      title="QR credential"
      description="A QR attendance credential will be generated automatically on submission."
    >
      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-6 text-center sm:flex-row sm:text-left">
          <div className="grid h-24 w-24 shrink-0 place-items-center rounded-lg border border-border bg-muted/40">
            <div className="grid h-16 w-16 grid-cols-5 grid-rows-5 gap-0.5 p-1">
              {Array.from({ length: 25 }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "rounded-[1px]",
                    (i * 5 + fullName.length) % 3 === 0 ? "bg-foreground" : "bg-muted",
                  )}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground">
              Preview credential for {fullName || "the new learner"}
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              The admission number and QR serial will be issued once you submit. The card can be
              printed from the learner's profile.
            </p>
          </div>
        </div>
        <div className="rounded-lg bg-navy-soft/60 px-3 py-2 text-[12px] text-foreground">
          <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-primary" /> No personal data is
          embedded in the visible QR pattern shown to staff — only an internal reference is encoded.
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-[12px]"
          onClick={onBack}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Previous
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 text-[12px]"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? "Submitting…" : "Submit registration"} <Check className="h-3.5 w-3.5" />
        </Button>
      </div>
    </SectionCard>
  );
}
