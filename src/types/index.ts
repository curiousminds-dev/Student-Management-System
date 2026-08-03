export type UUID = string;

export type RoleKey =
  | "administrator"
  | "headteacher"
  | "director_of_studies"
  | "teacher"
  | "security_officer"
  | "nurse"
  | "warden"
  | "transport_officer";

export type PermissionKey =
  | "dashboard.view"
  | "learners.view"
  | "learners.manage"
  | "learners.identity_only"
  | "attendance.view"
  | "attendance.record"
  | "occasions.manage"
  | "observations.view"
  | "observations.create"
  | "cases.view"
  | "cases.manage"
  | "welfare.view"
  | "welfare.manage"
  | "health.view"
  | "academics.view"
  | "academics.manage"
  | "reports.view"
  | "communication.view"
  | "staff.manage"
  | "devices.view"
  | "devices.manage"
  | "audit.view"
  | "settings.manage";

export interface Role {
  key: RoleKey;
  name: string;
  description: string;
  permissions: PermissionKey[];
}

export interface School {
  id: UUID;
  name: string;
  motto: string;
  centreNumber: string;
  address: string;
  phone: string;
  email: string;
  campuses: Campus[];
}

export interface Campus {
  id: UUID;
  name: string;
  district: string;
}

export interface AcademicYear {
  id: UUID;
  year: number;
  active: boolean;
  terms: Term[];
}

export interface Term {
  id: UUID;
  name: "Term One" | "Term Two" | "Term Three";
  year: number;
  startDate: string;
  endDate: string;
  active: boolean;
}

export interface User {
  id: UUID;
  staffId: UUID;
  name: string;
  email: string;
  role: RoleKey;
  roleName: string;
  campusId: UUID;
  permissions: PermissionKey[];
}

export interface Staff {
  id: UUID;
  name: string;
  staffNumber: string;
  department: string;
  role: RoleKey;
  roleName: string;
  assignedClasses: string[];
  assignedDeviceId: string | null;
  assignedDeviceName: string | null;
  accountStatus: "active" | "invited" | "suspended";
  lastLogin: string | null;
  phone: string;
  email: string;
  gender: "Male" | "Female";
  joinedOn: string;
}

export type LearnerClass =
  | "Senior One"
  | "Senior Two"
  | "Senior Three"
  | "Senior Four"
  | "Senior Five"
  | "Senior Six";

export type AttendanceStatus = "present" | "late" | "excused" | "unexplained" | "pending";

export interface Guardian {
  name: string;
  relationship: string;
  phone: string;
  alternatePhone?: string | undefined;
  email?: string | undefined;
  occupation?: string | undefined;
}

export interface QRCredential {
  id: UUID;
  learnerId: UUID;
  serial: string;
  status: "active" | "revoked" | "replaced" | "not_issued";
  issuedOn: string;
  issuedBy: string;
  revokedOn?: string;
  revokedReason?: string;
}

export interface Learner {
  id: UUID;
  firstName: string;
  lastName: string;
  fullName: string;
  admissionNumber: string;
  lin: string;
  unebNumber?: string | undefined;
  className: LearnerClass;
  stream: string;
  gender: "Male" | "Female";
  residence: "Day" | "Boarding";
  house: string;
  dormitory: string | null;
  dateOfBirth: string;
  age: number;
  todayStatus: AttendanceStatus;
  attendanceRate: number;
  qrStatus: QRCredential["status"];
  qrSerial: string;
  guardian: Guardian;
  emergencyContact: Guardian;
  status: "active" | "inactive" | "transferred";
  enrolledOn: string;
  campusId: UUID;
  photoHue: number;
  medicalNotes?: string | undefined;
}

export type OccasionCategory =
  | "Gate entry"
  | "Gate exit"
  | "Morning assembly"
  | "Evening assembly"
  | "Class lesson"
  | "Examination"
  | "Morning prep"
  | "Evening prep"
  | "Dormitory roll call"
  | "Dining"
  | "Sick bay"
  | "Transport"
  | "Sports"
  | "Clubs"
  | "Trips"
  | "Official duty";

export interface AttendanceOccasion {
  id: UUID;
  name: string;
  category: OccasionCategory;
  date: string;
  startTime: string;
  endTime: string;
  expected: number;
  scanned: number;
  responsibleStaff: string;
  location: string;
  status: "scheduled" | "active" | "paused" | "closed" | "reconciled";
}

export interface ScanEvent {
  id: UUID;
  learnerId: UUID;
  learnerName: string;
  admissionNumber: string;
  className: string;
  occasionId: UUID;
  occasionName: string;
  status: AttendanceStatus;
  scanTime: string;
  deviceId: string;
  deviceName: string;
  recordedBy: string;
  outcome: "accepted" | "duplicate" | "late" | "revoked_card" | "unknown_card" | "not_expected";
}

export interface AttendanceRecord {
  id: UUID;
  learnerId: UUID;
  learnerName: string;
  admissionNumber: string;
  className: string;
  stream: string;
  occasionId: UUID;
  occasionName: string;
  status: AttendanceStatus;
  scanTime: string | null;
  deviceName: string | null;
  recordedBy: string;
  reconciliation: "reconciled" | "pending" | "not_required";
  date: string;
  photoHue: number;
}

export interface AuthorizedAbsence {
  id: UUID;
  learnerId: UUID;
  learnerName: string;
  className: string;
  reason: string;
  category: "Medical" | "Family" | "Official duty" | "Sports" | "Other";
  fromDate: string;
  toDate: string;
  approvedBy: string;
  status: "approved" | "pending" | "expired";
}

export interface Observation {
  id: UUID;
  reference: string;
  learnerId: UUID;
  learnerName: string;
  className: string;
  category:
    | "Positive conduct"
    | "Academic observation"
    | "Minor concern"
    | "Welfare concern"
    | "General observation"
    | "Serious alleged incident";
  severity: "low" | "medium" | "high";
  dateTime: string;
  location: string;
  relatedOccasion: string | null;
  description: string;
  immediateAction: string;
  recommendedFollowUp: string;
  witnesses: string[];
  parentContactRecommended: boolean;
  recordedBy: string;
  confidential: boolean;
}

export type CaseStage =
  | "Submitted"
  | "Assigned"
  | "Learner response"
  | "Evidence review"
  | "Finding"
  | "Intervention"
  | "Review"
  | "Closure";

export interface CaseTimelineEntry {
  id: UUID;
  stage: CaseStage | "Note";
  actor: string;
  at: string;
  note: string;
}

export interface ConductCase {
  id: UUID;
  reference: string;
  learnerId: UUID;
  learnerName: string;
  className: string;
  title: string;
  summary: string;
  stage: CaseStage;
  finding: "Confirmed" | "Unconfirmed" | "Dismissed" | "Referred" | null;
  assignedReviewer: string;
  learnerResponse: string | null;
  evidenceCount: number;
  parentContacted: boolean;
  openedOn: string;
  reviewDate: string | null;
  closed: boolean;
  confidential: boolean;
  timeline: CaseTimelineEntry[];
}

export interface Intervention {
  id: UUID;
  learnerId: UUID;
  learnerName: string;
  className: string;
  type: "Counselling" | "Academic support" | "Mentorship" | "Guardian meeting" | "Support plan";
  owner: string;
  startedOn: string;
  reviewOn: string;
  status: "active" | "completed" | "overdue";
  progressNote: string;
  confidential: boolean;
}

export interface HealthEncounter {
  id: UUID;
  learnerId: UUID;
  learnerName: string;
  className: string;
  complaint: string;
  action: string;
  attendedBy: string;
  arrivedAt: string;
  outcome: "Returned to class" | "Resting" | "Referred to clinic" | "Guardian collected";
  confidential: boolean;
}

export interface Device {
  id: UUID;
  name: string;
  type: "Tablet" | "Phone" | "Laptop" | "USB scanner";
  assignedUser: string;
  location: string;
  status: "synced" | "pending" | "syncing" | "failed" | "conflict" | "disabled";
  lastSync: string;
  pendingRecords: number;
  failedRecords: number;
  conflicts: number;
  version: string;
  lastActivity: string;
  connection: "online" | "offline";
}

export interface SyncRecord {
  id: UUID;
  deviceId: UUID;
  deviceName: string;
  at: string;
  records: number;
  result: "success" | "failed" | "partial";
  detail: string;
}

export interface Subject {
  id: UUID;
  code: string;
  name: string;
  level: "O-Level" | "A-Level";
  teacher: string;
  classes: string[];
  completion: number;
}

export interface Assessment {
  id: UUID;
  name: string;
  subject: string;
  className: string;
  term: string;
  dueDate: string;
  entered: number;
  expected: number;
  status: "open" | "marks_entry" | "published";
}

export interface NotificationMessage {
  id: UUID;
  template: string;
  audience: string;
  channel: "SMS" | "Email";
  body: string;
  sentAt: string;
  recipients: number;
  delivered: number;
  failed: number;
  status: "sent" | "queued" | "failed";
}

export interface AuditEvent {
  id: UUID;
  at: string;
  user: string;
  role: string;
  action: string;
  module: string;
  record: string;
  device: string;
  ip: string;
  reason: string | null;
  result: "success" | "denied" | "failed";
  before?: Record<string, string> | undefined;
  after?: Record<string, string> | undefined;
}

export interface DashboardSummary {
  greetingName: string;
  date: string;
  term: string;
  metrics: {
    key: string;
    label: string;
    value: number | string;
    change: string;
    trend: "up" | "down" | "flat";
    tone: "navy" | "cyan" | "success" | "warning" | "info";
  }[];
  attendanceTrend: { day: string; present: number; late: number; absent: number }[];
  statusDistribution: { name: string; value: number }[];
  attendanceByClass: { className: string; rate: number }[];
  caseStatus: { name: string; open: number; closed: number }[];
  todaysOccasions: AttendanceOccasion[];
  unexplainedAbsences: AttendanceRecord[];
  seriousCases: ConductCase[];
  deviceIssues: Device[];
  recentStaffActions: AuditEvent[];
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
