import {
  ASSESSMENTS,
  ATTENDANCE_RECORDS,
  CLASS_ANALYSIS,
  COMPETENCY_RECORDS,
  GRADE_BOUNDARIES,
  LEARNER_PROGRESS,
  MISSING_WORK,
  SUBJECT_ANALYSIS,
  TEACHER_COMPLETION,
  ATTENDANCE_TREND,
  AUDIT_EVENTS,
  AUTHORIZED_ABSENCES,
  CASES,
  CLASS_RATES,
  DEVICES,
  HEALTH_ENCOUNTERS,
  INTERVENTIONS,
  LEARNERS,
  MESSAGES,
  OBSERVATIONS,
  OCCASIONS,
  SCANS,
  SCHOOL,
  STAFF,
  SUBJECTS,
  SYNC_HISTORY,
  TERMS,
} from "@/lib/mock/data";
import { ROLES } from "@/lib/roles";
import { mock, paginate, request, setAccessToken, USE_MOCK_DATA } from "./api-client";
import type {
  Assessment,
  AttendanceOccasion,
  ClassAnalysisRow,
  CompetencyRecord,
  GradeBoundary,
  LearnerProgressRow,
  MarksGrid,
  MissingWorkRow,
  SubjectAnalysisRow,
  TeacherCompletionRow,
  AttendanceRecord,
  AuditEvent,
  AuthorizedAbsence,
  ConductCase,
  DashboardSummary,
  Device,
  HealthEncounter,
  Intervention,
  Learner,
  NotificationMessage,
  Observation,
  Paginated,
  RoleKey,
  ScanEvent,
  Staff,
  Subject,
  SyncRecord,
  User,
} from "@/types";

/* ---------------------------------------------------------------- auth --- */
export class MfaRequiredError extends Error {
  constructor(public challengeToken: string) {
    super("MFA verification required");
  }
}

export const authService = {
  async login(
    role: RoleKey,
    name: string,
    email: string,
    password = "demo-password",
  ): Promise<User> {
    if (!USE_MOCK_DATA) {
      const result = await request<{
        token?: string;
        user?: User;
        mfaRequired?: boolean;
        challengeToken?: string;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (result.mfaRequired && result.challengeToken)
        throw new MfaRequiredError(result.challengeToken);
      if (!result.token || !result.user) throw new Error("Invalid authentication response");
      setAccessToken(result.token);
      return result.user;
    }
    const r = ROLES[role];
    const staff = STAFF.find((s) => s.role === role);
    return mock<User>({
      id: `usr-${role}`,
      staffId: staff?.id ?? "stf-001",
      name,
      email,
      role,
      roleName: r.name,
      campusId: "cmp-1",
      permissions: r.permissions,
    });
  },
  async verifyMfa(challengeToken: string, code: string) {
    const result = await request<{ token: string; user: User }>("/auth/mfa/verify", {
      method: "POST",
      body: JSON.stringify({ challengeToken, code }),
    });
    setAccessToken(result.token);
    return result.user;
  },
  async me(): Promise<User | null> {
    if (!USE_MOCK_DATA) {
      try {
        const refreshed = await request<{ token: string }>("/auth/refresh", { method: "POST" });
        setAccessToken(refreshed.token);
        return request<User>("/auth/me");
      } catch {
        return null;
      }
    }
    return mock<User | null>(null, 0);
  },
  logout() {
    if (!USE_MOCK_DATA) void request("/auth/logout", { method: "POST" }).catch(() => undefined);
    setAccessToken(null);
  },
};

/* ----------------------------------------------------------- dashboard --- */

export const dashboardService = {
  async summary(roleName: string): Promise<DashboardSummary> {
    if (!USE_MOCK_DATA) return request<DashboardSummary>("/dashboard");
    const present = ATTENDANCE_RECORDS.filter((r) => r.status === "present").length;
    const late = ATTENDANCE_RECORDS.filter((r) => r.status === "late").length;
    const unexplained = ATTENDANCE_RECORDS.filter((r) => r.status === "unexplained");
    return mock<DashboardSummary>(() => ({
      greetingName: roleName,
      date: "Monday, 3 August 2026",
      term: "Term Two · 2026",
      metrics: [
        {
          key: "learners",
          label: "Active learners",
          value: LEARNERS.length,
          change: "+6 this term",
          trend: "up",
          tone: "navy",
        },
        {
          key: "present",
          label: "Present today",
          value: present,
          change: "94.2% of expected",
          trend: "up",
          tone: "cyan",
        },
        {
          key: "late",
          label: "Late today",
          value: late,
          change: "-4 vs yesterday",
          trend: "down",
          tone: "warning",
        },
        {
          key: "unexplained",
          label: "Unexplained absences",
          value: unexplained.length,
          change: "Awaiting reconciliation",
          trend: "flat",
          tone: "warning",
        },
        {
          key: "welfare",
          label: "Open welfare concerns",
          value: OBSERVATIONS.filter((o) => o.category === "Welfare concern").length,
          change: "3 under review",
          trend: "flat",
          tone: "info",
        },
        {
          key: "devices",
          label: "Devices awaiting sync",
          value: DEVICES.filter((d) => d.status !== "synced").length,
          change: "1 with conflicts",
          trend: "down",
          tone: "success",
        },
      ],
      attendanceTrend: ATTENDANCE_TREND,
      statusDistribution: [
        { name: "Present", value: present },
        { name: "Late", value: late },
        { name: "Excused", value: ATTENDANCE_RECORDS.filter((r) => r.status === "excused").length },
        { name: "Unexplained", value: unexplained.length },
      ],
      attendanceByClass: CLASS_RATES,
      caseStatus: [
        { name: "Observations", open: OBSERVATIONS.length, closed: 22 },
        {
          name: "Cases",
          open: CASES.filter((c) => !c.closed).length,
          closed: CASES.filter((c) => c.closed).length,
        },
        {
          name: "Interventions",
          open: INTERVENTIONS.filter((i) => i.status === "active").length,
          closed: INTERVENTIONS.filter((i) => i.status === "completed").length,
        },
      ],
      todaysOccasions: OCCASIONS.slice(0, 6),
      unexplainedAbsences: unexplained.slice(0, 6),
      seriousCases: CASES.filter((c) => !c.closed).slice(0, 4),
      deviceIssues: DEVICES.filter((d) => d.status !== "synced").slice(0, 4),
      recentStaffActions: AUDIT_EVENTS.slice(0, 6),
    }));
  },
};

/* ------------------------------------------------------------ learners --- */

export interface LearnerQuery {
  search?: string;
  className?: string;
  stream?: string;
  residence?: string;
  gender?: string;
  status?: string;
  qrStatus?: string;
  sortBy?: keyof Learner;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export const learnerService = {
  async list(query: LearnerQuery = {}): Promise<Paginated<Learner>> {
    if (!USE_MOCK_DATA) return request<Paginated<Learner>>(`/learners`);
    const {
      search = "",
      className = "all",
      stream = "all",
      residence = "all",
      gender = "all",
      status = "all",
      qrStatus = "all",
      sortBy = "fullName",
      sortDir = "asc",
      page = 1,
      pageSize = 12,
    } = query;
    const q = search.trim().toLowerCase();
    let rows = LEARNERS.filter((l) => {
      if (q && !`${l.fullName} ${l.admissionNumber} ${l.lin}`.toLowerCase().includes(q))
        return false;
      if (className !== "all" && l.className !== className) return false;
      if (stream !== "all" && l.stream !== stream) return false;
      if (residence !== "all" && l.residence !== residence) return false;
      if (gender !== "all" && l.gender !== gender) return false;
      if (status !== "all" && l.status !== status) return false;
      if (qrStatus !== "all" && l.qrStatus !== qrStatus) return false;
      return true;
    });
    rows = [...rows].sort((a, b) => {
      const av = a[sortBy] as string | number;
      const bv = b[sortBy] as string | number;
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return mock(paginate(rows, page, pageSize));
  },
  async byId(id: string): Promise<Learner> {
    if (!USE_MOCK_DATA) return request<Learner>(`/learners/${id}`);
    const learner = LEARNERS.find((l) => l.id === id);
    if (!learner) throw new Error("Learner not found");
    return mock(learner);
  },
  async create(payload: Partial<Learner>): Promise<Learner> {
    if (!USE_MOCK_DATA)
      return request<Learner>("/learners", { method: "POST", body: JSON.stringify(payload) });
    return mock({ ...LEARNERS[0]!, ...payload, id: `lnr-new-${Date.now()}` } as Learner, 600);
  },
  async credentials(id: string) {
    if (!USE_MOCK_DATA) return request(`/learners/${id}/qr-credentials`);
    const learner = LEARNERS.find((l) => l.id === id)!;
    return mock([
      {
        id: "qr-1",
        learnerId: id,
        serial: learner.qrSerial,
        status: learner.qrStatus,
        issuedOn: "2026-02-06",
        issuedBy: "Grace Nakabugo",
      },
      {
        id: "qr-0",
        learnerId: id,
        serial: `QR-OLD-${learner.qrSerial.slice(-4)}`,
        status: "replaced" as const,
        issuedOn: "2025-02-11",
        issuedBy: "Grace Nakabugo",
        revokedOn: "2026-02-05",
        revokedReason: "Card reported lost",
      },
    ]);
  },
  async observations(id: string) {
    return mock(OBSERVATIONS.filter((o) => o.learnerId === id));
  },
  async attendance(id: string) {
    return mock(ATTENDANCE_RECORDS.filter((r) => r.learnerId === id));
  },
  async documents(id: string) {
    return mock([
      {
        id: `doc-${id}-1`,
        name: "Birth certificate",
        category: "Identity",
        uploadedOn: "2026-01-14",
        uploadedBy: "Grace Nakabugo",
      },
      {
        id: `doc-${id}-2`,
        name: "Primary Leaving Examination certificate",
        category: "Academic",
        uploadedOn: "2026-01-14",
        uploadedBy: "Grace Nakabugo",
      },
      {
        id: `doc-${id}-3`,
        name: "Guardian consent form",
        category: "Consent",
        uploadedOn: "2026-01-15",
        uploadedBy: "Grace Nakabugo",
      },
      {
        id: `doc-${id}-4`,
        name: "Immunisation record",
        category: "Medical",
        uploadedOn: "2026-01-15",
        uploadedBy: "Nurse Immaculate Achen",
      },
    ]);
  },
  async issueCredential(id: string) {
    const learner = LEARNERS.find((l) => l.id === id);
    return mock(
      {
        id: `qr-${Date.now()}`,
        learnerId: id,
        serial: `QR-${Date.now().toString(36).toUpperCase()}`,
        status: "active" as const,
        issuedOn: new Date().toISOString().slice(0, 10),
        issuedBy: learner?.guardian.name ?? "Front office",
      },
      500,
    );
  },
  async revokeCredential(id: string, reason: string) {
    return mock(
      { id, reason, revokedOn: new Date().toISOString(), revokedBy: "Current staff member" },
      500,
    );
  },
  async replaceCredential(id: string, reason: string) {
    return mock(
      {
        id,
        reason,
        serial: `QR-${Date.now().toString(36).toUpperCase()}`,
        issuedOn: new Date().toISOString().slice(0, 10),
      },
      500,
    );
  },
};

/* ---------------------------------------------------------- attendance --- */

export const attendanceService = {
  async records(
    filters: { search?: string; className?: string; status?: string; occasionId?: string } = {},
  ): Promise<AttendanceRecord[]> {
    if (!USE_MOCK_DATA) return request<AttendanceRecord[]>("/attendance");
    const q = (filters.search ?? "").toLowerCase();
    return mock(
      ATTENDANCE_RECORDS.filter((r) => {
        if (q && !`${r.learnerName} ${r.admissionNumber}`.toLowerCase().includes(q)) return false;
        if (filters.className && filters.className !== "all" && r.className !== filters.className)
          return false;
        if (filters.status && filters.status !== "all" && r.status !== filters.status) return false;
        if (
          filters.occasionId &&
          filters.occasionId !== "all" &&
          r.occasionId !== filters.occasionId
        )
          return false;
        return true;
      }),
    );
  },
  async occasions(): Promise<AttendanceOccasion[]> {
    if (!USE_MOCK_DATA) return request<AttendanceOccasion[]>("/attendance/occasions");
    return mock(OCCASIONS);
  },
  async scans(): Promise<ScanEvent[]> {
    if (!USE_MOCK_DATA) return request<ScanEvent[]>("/attendance/scans");
    return mock(SCANS);
  },
  async scan(payload: {
    credential: string;
    occasionId: string;
    deviceId?: string;
    clientEventId?: string;
    recordedAt?: string;
  }) {
    return request<{
      outcome: string;
      accepted: boolean;
      learner?: Learner;
      record?: AttendanceRecord;
    }>("/attendance/scan", {
      method: "POST",
      headers: deviceService.authHeaders(),
      body: JSON.stringify(payload),
    });
  },
  async sync(payload: {
    clientBatchId: string;
    events: Array<{
      credential: string;
      occasionId: string;
      deviceId: string;
      clientEventId: string;
      recordedAt: string;
    }>;
  }) {
    return request("/attendance/sync", {
      method: "POST",
      headers: deviceService.authHeaders(),
      body: JSON.stringify(payload),
    });
  },
  async authorizedAbsences(): Promise<AuthorizedAbsence[]> {
    return mock(AUTHORIZED_ABSENCES);
  },
};

/* ------------------------------------------------------------- devices --- */

export const deviceService = {
  token: null as string | null,
  authHeaders() {
    return this.token ? { "X-Device-Token": this.token } : {};
  },
  async authenticate(publicId: string, secret: string) {
    const result = await request<{ token: string; deviceId: string }>("/devices/auth", {
      method: "POST",
      body: JSON.stringify({ publicId, secret }),
    });
    this.token = result.token;
    return result;
  },
  async list(): Promise<Device[]> {
    if (!USE_MOCK_DATA) return request<Device[]>("/devices");
    return mock(DEVICES);
  },
  async history(): Promise<SyncRecord[]> {
    if (!USE_MOCK_DATA) return request<SyncRecord[]>("/attendance/sync");
    return mock(SYNC_HISTORY);
  },
  async sync(deviceId: string) {
    return mock({ deviceId, ok: true }, 900);
  },
};

/* --------------------------------------------------- support & welfare --- */

interface WelfareObservationApi {
  id: string;
  learnerId: string;
  learner: { firstName: string; lastName: string; className: string; stream: string };
  reporter: { name: string };
  category: Observation["category"];
  severity: Observation["severity"];
  summary: string;
  details: string;
  status: "open" | "reviewing" | "closed";
  occurredAt: string;
  reviewAt?: string;
}

export const supportService = {
  async observations(): Promise<Observation[]> {
    if (!USE_MOCK_DATA) {
      const rows = await request<WelfareObservationApi[]>("/welfare/observations");
      return rows.map((row) => ({
        id: row.id,
        reference: `WEL-${row.id.slice(-6).toUpperCase()}`,
        learnerId: row.learnerId,
        learnerName: `${row.learner.firstName} ${row.learner.lastName}`,
        className: `${row.learner.className} ${row.learner.stream}`,
        category: row.category,
        severity: row.severity,
        dateTime: row.occurredAt,
        location: "School campus",
        relatedOccasion: null,
        description: row.details,
        immediateAction: row.summary,
        recommendedFollowUp: row.reviewAt ? `Review on ${row.reviewAt}` : "Monitor and review",
        witnesses: [],
        parentContactRecommended: row.severity === "high",
        recordedBy: row.reporter.name,
        confidential: row.category === "Welfare concern",
        status: row.status,
        reviewAt: row.reviewAt,
      })) as Observation[];
    }
    return mock(OBSERVATIONS);
  },
  async updateObservation(id: string, status: "open" | "reviewing" | "closed") {
    return request(`/welfare/observations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },
  async createObservation(payload: Partial<Observation>) {
    if (!USE_MOCK_DATA)
      return request("/welfare/observations", {
        method: "POST",
        body: JSON.stringify({
          learnerId: payload.learnerId,
          category: payload.category,
          severity: payload.severity,
          summary: payload.immediateAction ?? payload.description ?? payload.category,
          details: payload.description ?? "Observation recorded",
          occurredAt: payload.dateTime ?? new Date().toISOString(),
          reviewAt: (payload as Partial<Observation> & { reviewAt?: string }).reviewAt,
        }),
      });
    return mock({ ...OBSERVATIONS[0]!, ...payload, id: `obs-${Date.now()}` }, 600);
  },
  async cases(): Promise<ConductCase[]> {
    if (!USE_MOCK_DATA) return request<ConductCase[]>("/conduct/cases");
    return mock(CASES);
  },
  async interventions(): Promise<Intervention[]> {
    if (!USE_MOCK_DATA) return request<Intervention[]>("/interventions");
    return mock(INTERVENTIONS);
  },
  async welfare(): Promise<{
    absences: AuthorizedAbsence[];
    health: HealthEncounter[];
    concerns: Observation[];
    interventions: Intervention[];
  }> {
    if (!USE_MOCK_DATA) return request("/welfare");
    return mock({
      absences: AUTHORIZED_ABSENCES,
      health: HEALTH_ENCOUNTERS,
      concerns: OBSERVATIONS.filter((o) => o.category === "Welfare concern"),
      interventions: INTERVENTIONS,
    });
  },
  async casesForLearner(learnerId: string): Promise<ConductCase[]> {
    return mock(CASES.filter((c) => c.learnerId === learnerId));
  },
  async interventionsForLearner(learnerId: string): Promise<Intervention[]> {
    return mock(INTERVENTIONS.filter((i) => i.learnerId === learnerId));
  },
  async healthForLearner(learnerId: string): Promise<HealthEncounter[]> {
    return mock(HEALTH_ENCOUNTERS.filter((h) => h.learnerId === learnerId));
  },
  async absencesForLearner(learnerId: string): Promise<AuthorizedAbsence[]> {
    return mock(AUTHORIZED_ABSENCES.filter((a) => a.learnerId === learnerId));
  },
  async authoriseAbsence(payload: {
    learnerId: string;
    reason: string;
    category: AuthorizedAbsence["category"];
    fromDate: string;
    toDate: string;
  }) {
    return mock(
      {
        ...payload,
        id: `abs-${Date.now()}`,
        status: "approved" as const,
        approvedBy: "Current staff member",
      },
      500,
    );
  },
  async recordFinding(payload: {
    caseId: string;
    finding: NonNullable<ConductCase["finding"]>;
    rationale: string;
  }) {
    if (!USE_MOCK_DATA)
      return request(`/conduct/cases/${payload.caseId}/decision`, {
        method: "POST",
        body: JSON.stringify({
          finding:
            payload.finding === "Confirmed"
              ? "substantiated"
              : payload.finding === "Dismissed"
                ? "not_substantiated"
                : "inconclusive",
          rationale: payload.rationale,
        }),
      });
    return mock({ ...payload, recordedAt: new Date().toISOString() }, 500);
  },
};

/* ----------------------------------------------------------- academics --- */

interface AssessmentApi {
  id: string;
  name: string;
  subject: string;
  className: string;
  term: string;
  maximumMark: number;
  assessmentDate: string;
  publishedAt?: string;
  _count?: { marks: number };
}

export const academicsService = {
  async subjects(): Promise<Subject[]> {
    if (!USE_MOCK_DATA) return request<Subject[]>("/academics");
    return mock(SUBJECTS);
  },
  async assessments(): Promise<Assessment[]> {
    if (!USE_MOCK_DATA) {
      const rows = await request<AssessmentApi[]>("/academics/assessments");
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        subject: row.subject,
        className: row.className,
        term: row.term,
        dueDate: row.assessmentDate,
        entered: row._count?.marks ?? 0,
        expected: row._count?.marks ?? 0,
        status: row.publishedAt ? "published" : row._count?.marks ? "marks_entry" : "open",
        maximumMark: row.maximumMark,
      })) as Assessment[];
    }
    return mock(ASSESSMENTS);
  },
  async createAssessment(payload: {
    name: string;
    subject: string;
    className: string;
    term: string;
    maximumMark: number;
    assessmentDate: string;
  }) {
    return request("/academics/assessments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async gradeBoundaries(): Promise<GradeBoundary[]> {
    return mock(GRADE_BOUNDARIES);
  },
  async competencies(): Promise<CompetencyRecord[]> {
    return mock(COMPETENCY_RECORDS);
  },
  async marksGrid(assessmentId: string): Promise<MarksGrid> {
    if (!USE_MOCK_DATA) return request<MarksGrid>(`/academics/assessments/${assessmentId}/marks`);
    const assessment = ASSESSMENTS.find((a) => a.id === assessmentId) ?? ASSESSMENTS[0]!;
    let h = 0;
    for (const ch of assessment.id) h = (h * 31 + ch.charCodeAt(0)) % 1000;
    const learners = LEARNERS.filter((l) => l.className === assessment.className).slice(0, 20);
    return mock({
      assessmentId: assessment.id,
      assessmentName: assessment.name,
      subject: assessment.subject,
      className: assessment.className,
      maxMark: 100,
      cells: learners.map((l, i) => {
        h = (h * 31 + i) % 1000;
        const skip = h % 9 === 0;
        return {
          learnerId: l.id,
          learnerName: l.fullName,
          admissionNumber: l.admissionNumber,
          mark: skip ? null : 32 + (h % 65),
        };
      }),
    });
  },
  async publish(assessmentId: string) {
    return request(`/academics/assessments/${assessmentId}/publish`, { method: "POST" });
  },
  async saveMarks(assessmentId: string, cells: { learnerId: string; mark: number | null }[]) {
    if (!USE_MOCK_DATA)
      return request(`/academics/assessments/${assessmentId}/marks`, {
        method: "PUT",
        body: JSON.stringify(
          cells.map((cell) => ({ learnerId: cell.learnerId, score: cell.mark })),
        ),
      });
    return mock({ assessmentId, saved: true, count: cells.length }, 500);
  },
  async subjectAnalysis(): Promise<SubjectAnalysisRow[]> {
    return mock(SUBJECT_ANALYSIS);
  },
  async classAnalysis(): Promise<ClassAnalysisRow[]> {
    return mock(CLASS_ANALYSIS);
  },
  async learnerProgress(): Promise<LearnerProgressRow[]> {
    return mock(LEARNER_PROGRESS);
  },
  async missingWork(): Promise<MissingWorkRow[]> {
    return mock(MISSING_WORK);
  },
  async teacherCompletion(): Promise<TeacherCompletionRow[]> {
    return mock(TEACHER_COMPLETION);
  },
};

/* --------------------------------------------------------------- staff --- */

export const staffService = {
  async list(): Promise<Staff[]> {
    if (!USE_MOCK_DATA) return request<Staff[]>("/staff");
    return mock(STAFF);
  },
  async roles() {
    if (!USE_MOCK_DATA) return request("/roles");
    return mock(Object.values(ROLES));
  },
};

/* ------------------------------------------- communication & audit etc --- */

export const communicationService = {
  async messages(): Promise<NotificationMessage[]> {
    if (!USE_MOCK_DATA) return request<NotificationMessage[]>("/notifications");
    return mock(MESSAGES);
  },
  async send(payload: { template: string; audience: string; body: string }) {
    if (!USE_MOCK_DATA)
      return request("/communications", {
        method: "POST",
        body: JSON.stringify({
          channel: "sms",
          recipients: [payload.audience],
          subject: payload.template,
          body: payload.body,
        }),
      });
    return mock({ ...payload, id: `msg-${Date.now()}` }, 700);
  },
};

export const auditService = {
  async list(): Promise<AuditEvent[]> {
    if (!USE_MOCK_DATA) {
      const rows = await request<
        Array<{
          id: string;
          createdAt: string;
          actor?: { name?: string };
          action: string;
          entityType: string;
          entityId?: string;
          ipAddress?: string;
        }>
      >("/audit-logs");
      return rows.map((row) => ({
        id: row.id,
        at: row.createdAt,
        user: row.actor?.name ?? "System",
        role: "",
        action: row.action,
        module: row.entityType,
        record: row.entityId ?? "",
        device: "",
        ip: row.ipAddress ?? "",
        reason: null,
        result: "success",
      }));
    }
    return mock(AUDIT_EVENTS);
  },
};

export const settingsService = {
  async school() {
    if (!USE_MOCK_DATA) return request("/settings");
    return mock({ school: SCHOOL, terms: TERMS });
  },
  async save(section: string) {
    if (!USE_MOCK_DATA)
      return request(`/settings/${encodeURIComponent(section)}`, {
        method: "PUT",
        body: JSON.stringify({ value: { updatedAt: new Date().toISOString() } }),
      });
    return mock({ section, saved: true }, 700);
  },
};

export const reportService = {
  async generate(reportId: string) {
    if (!USE_MOCK_DATA)
      return request(`/reports/attendance-summary?reportId=${encodeURIComponent(reportId)}`);
    return mock({ reportId, url: "#", generatedAt: new Date().toISOString() }, 900);
  },
};
