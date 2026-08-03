import type {
  Assessment,
  AttendanceOccasion,
  AttendanceRecord,
  AttendanceStatus,
  AuditEvent,
  AuthorizedAbsence,
  Campus,
  ConductCase,
  Device,
  HealthEncounter,
  Intervention,
  Learner,
  LearnerClass,
  NotificationMessage,
  Observation,
  ScanEvent,
  School,
  Staff,
  Subject,
  SyncRecord,
  Term,
} from "@/types";
import { ROLES } from "@/lib/roles";

/* Deterministic pseudo-random so mock data is stable between renders. */
let seed = 20260803;
function rnd() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)]!;
}
function int(min: number, max: number) {
  return Math.floor(rnd() * (max - min + 1)) + min;
}
function pad(n: number, len = 3) {
  return String(n).padStart(len, "0");
}

const FIRST_F = [
  "Amina","Sarah","Faith","Lydia","Prossy","Ritah","Doreen","Joan","Patricia","Sylvia","Betty","Harriet","Immaculate","Sandra","Winnie","Esther","Cathy","Brenda","Justine","Shamim",
];
const FIRST_M = [
  "Daniel","Joshua","Brian","Moses","Emmanuel","Isaac","Peter","Ivan","Timothy","Andrew","Ronald","Denis","Arnold","Herbert","Julius","Enock","Godfrey","Simon","Allan","Solomon",
];
const LAST = [
  "Nansubuga","Okello","Namusoke","Kato","Atim","Ssemanda","Nabirye","Ochieng","Mugisha","Nakato","Wasswa","Kirabo","Tumusiime","Aturinda","Nalwoga","Byaruhanga","Alupo","Kigongo","Namutebi","Ssebugwawo","Achieng","Kyomuhendo","Odongo","Nakamya","Muhwezi",
];
const CLASSES: LearnerClass[] = [
  "Senior One","Senior Two","Senior Three","Senior Four","Senior Five","Senior Six",
];
const STREAMS = ["East", "West", "North", "South"];
const HOUSES = ["Nile", "Rwenzori", "Elgon", "Kagera"];
const DORMS = ["Kabalega", "Mutesa", "Nakayima", "Kintu", null];
const STATUSES: AttendanceStatus[] = ["present", "present", "present", "present", "late", "excused", "unexplained"];

export const SCHOOL: School = {
  id: "sch-1",
  name: "Nile Crest Secondary School",
  motto: "Discipline, Diligence, Dignity",
  centreNumber: "U0231",
  address: "Plot 14, Nsambya Road, Kampala",
  phone: "+256 772 480 115",
  email: "office@nilecrest.ac.ug",
  campuses: [
    { id: "cmp-1", name: "Kampala Campus", district: "Kampala" },
    { id: "cmp-2", name: "Mukono Campus", district: "Mukono" },
  ] as Campus[],
};

export const TERMS: Term[] = [
  { id: "t1", name: "Term One", year: 2026, startDate: "2026-02-02", endDate: "2026-05-01", active: false },
  { id: "t2", name: "Term Two", year: 2026, startDate: "2026-05-25", endDate: "2026-08-21", active: true },
  { id: "t3", name: "Term Three", year: 2026, startDate: "2026-09-14", endDate: "2026-12-04", active: false },
];

function phone() {
  return `+256 7${int(0, 9)}${int(0, 9)} ${pad(int(100, 999))} ${pad(int(100, 999))}`;
}

function makeLearner(i: number): Learner {
  const gender = rnd() > 0.5 ? "Female" : "Male";
  const first = gender === "Female" ? pick(FIRST_F) : pick(FIRST_M);
  const last = pick(LAST);
  const className = pick(CLASSES);
  const residence = rnd() > 0.45 ? "Boarding" : "Day";
  const dorm = residence === "Boarding" ? pick(DORMS.filter(Boolean) as string[]) : null;
  const age = int(13, 19);
  const qrRoll = rnd();
  const guardianLast = pick(LAST);
  return {
    id: `lnr-${pad(i, 4)}`,
    firstName: first,
    lastName: last,
    fullName: `${first} ${last}`,
    admissionNumber: `NC/${2020 + int(0, 6)}/${pad(1000 + i, 4)}`,
    lin: `U${int(10000000, 99999999)}`,
    unebNumber: className === "Senior Four" || className === "Senior Six" ? `U0231/${pad(i, 3)}` : undefined,
    className,
    stream: pick(STREAMS),
    gender,
    residence,
    house: pick(HOUSES),
    dormitory: dorm,
    dateOfBirth: `${2026 - age}-0${int(1, 9)}-${pad(int(10, 28), 2)}`,
    age,
    todayStatus: pick(STATUSES),
    attendanceRate: int(72, 100),
    qrStatus: qrRoll > 0.92 ? "revoked" : qrRoll > 0.86 ? "not_issued" : "active",
    qrSerial: `QR-${pad(i, 4)}-${int(1000, 9999)}`,
    guardian: {
      name: `${rnd() > 0.5 ? pick(FIRST_F) : pick(FIRST_M)} ${guardianLast}`,
      relationship: pick(["Mother", "Father", "Guardian", "Aunt", "Uncle"]),
      phone: phone(),
      alternatePhone: phone(),
      occupation: pick(["Teacher", "Trader", "Farmer", "Nurse", "Engineer", "Civil servant"]),
    },
    emergencyContact: {
      name: `${pick(FIRST_F)} ${pick(LAST)}`,
      relationship: pick(["Aunt", "Grandmother", "Neighbour", "Uncle"]),
      phone: phone(),
    },
    status: "active",
    enrolledOn: `${2020 + int(0, 6)}-02-05`,
    campusId: "cmp-1",
    photoHue: int(0, 359),
  };
}

export const LEARNERS: Learner[] = Array.from({ length: 240 }, (_, i) => makeLearner(i + 1));

export const STAFF: Staff[] = [
  ["Grace Nakabugo", "administrator", "Administration", ["All"], "Admin Laptop"],
  ["Samuel Wamala", "headteacher", "Administration", ["All"], null],
  ["Esther Akello", "director_of_studies", "Academics", ["Senior Five", "Senior Six"], null],
  ["Brian Ssemanda", "teacher", "Sciences", ["Senior Three East", "Senior Four West"], null],
  ["Sarah Namusoke", "teacher", "Languages", ["Senior One East", "Senior Two North"], null],
  ["Joshua Kato", "teacher", "Mathematics", ["Senior Five West"], null],
  ["Moses Ochieng", "security_officer", "Security", [], "Main Gate Tablet 01"],
  ["Faith Atim", "nurse", "Health", [], "Sick Bay Laptop"],
  ["Lydia Nabirye", "warden", "Boarding", ["Girls' Dormitory"], "Girls' Dormitory Phone"],
  ["Daniel Okello", "transport_officer", "Transport", [], "School Bus 03 Tablet"],
  ["Amina Nansubuga", "teacher", "Humanities", ["Senior Two East"], null],
  ["Ivan Mugisha", "warden", "Boarding", ["Boys' Dormitory"], "Boys' Dormitory Phone"],
].map(([name, role, department, classes, device], i) => ({
  id: `stf-${pad(i + 1)}`,
  name: name as string,
  staffNumber: `NC-S${pad(120 + i)}`,
  department: department as string,
  role: role as Staff["role"],
  roleName: ROLES[role as Staff["role"]].name,
  assignedClasses: classes as string[],
  assignedDeviceId: device ? `dev-${i}` : null,
  assignedDeviceName: (device as string | null) ?? null,
  accountStatus: (i === 10 ? "invited" : i === 5 ? "suspended" : "active") as Staff["accountStatus"],
  lastLogin: i === 10 ? null : `2026-08-0${int(1, 3)} 0${int(6, 9)}:${pad(int(10, 59), 2)}`,
  phone: phone(),
  email: `${(name as string).split(" ")[0]!.toLowerCase()}@nilecrest.ac.ug`,
  gender: (i % 2 === 0 ? "Female" : "Male") as Staff["gender"],
  joinedOn: `${2018 + (i % 7)}-01-15`,
}));

export const DEVICES: Device[] = [
  ["Main Gate Tablet 01", "Tablet", "Moses Ochieng", "Main Gate", "synced", "online"],
  ["Assembly Scanner 02", "Tablet", "Brian Ssemanda", "Assembly Ground", "pending", "online"],
  ["Boys' Dormitory Phone", "Phone", "Ivan Mugisha", "Boys' Dormitory", "failed", "offline"],
  ["Girls' Dormitory Phone", "Phone", "Lydia Nabirye", "Girls' Dormitory", "synced", "online"],
  ["School Bus 03 Tablet", "Tablet", "Daniel Okello", "Route: Ntinda – Kireka", "conflict", "offline"],
  ["Sick Bay Laptop", "Laptop", "Faith Atim", "Sick Bay", "syncing", "online"],
  ["Dining Hall Scanner", "USB scanner", "Sarah Namusoke", "Dining Hall", "disabled", "offline"],
].map(([name, type, user, location, status, connection], i) => ({
  id: `dev-${i}`,
  name: name as string,
  type: type as Device["type"],
  assignedUser: user as string,
  location: location as string,
  status: status as Device["status"],
  lastSync: status === "synced" ? "3 minutes ago" : status === "syncing" ? "Now" : `${int(2, 26)} hours ago`,
  pendingRecords: status === "synced" ? 0 : int(4, 96),
  failedRecords: status === "failed" ? int(3, 18) : 0,
  conflicts: status === "conflict" ? int(1, 6) : 0,
  version: `2.${int(3, 6)}.${int(0, 9)}`,
  lastActivity: `2026-08-03 0${int(6, 9)}:${pad(int(10, 59), 2)}`,
  connection: connection as Device["connection"],
}));

export const SYNC_HISTORY: SyncRecord[] = DEVICES.flatMap((d, i) =>
  Array.from({ length: 3 }, (_, j) => ({
    id: `syn-${i}-${j}`,
    deviceId: d.id,
    deviceName: d.name,
    at: `2026-08-0${3 - j} 0${int(6, 9)}:${pad(int(10, 59), 2)}`,
    records: int(10, 220),
    result: (j === 1 && d.status === "failed" ? "failed" : j === 2 ? "partial" : "success") as SyncRecord["result"],
    detail:
      j === 1 && d.status === "failed"
        ? "Upload interrupted — connection lost mid-batch"
        : "Batch uploaded and acknowledged by the server",
  })),
);

const OCCASION_DEFS: [string, AttendanceOccasion["category"], string, string, string, string][] = [
  ["Main gate entry", "Gate entry", "06:30", "08:00", "Moses Ochieng", "Main Gate"],
  ["Morning assembly", "Morning assembly", "07:40", "08:10", "Samuel Wamala", "Assembly Ground"],
  ["Senior Four physics lesson", "Class lesson", "08:20", "09:40", "Brian Ssemanda", "Laboratory 2"],
  ["Mid-term examination — Mathematics", "Examination", "09:00", "11:00", "Esther Akello", "Main Hall"],
  ["Lunch service", "Dining", "12:40", "13:40", "Sarah Namusoke", "Dining Hall"],
  ["Sick bay attendance", "Sick bay", "08:00", "17:00", "Faith Atim", "Sick Bay"],
  ["Afternoon sports", "Sports", "16:00", "17:30", "Joshua Kato", "Playground"],
  ["Evening prep", "Evening prep", "19:00", "21:30", "Amina Nansubuga", "Classroom Block B"],
  ["Girls' dormitory roll call", "Dormitory roll call", "21:45", "22:15", "Lydia Nabirye", "Girls' Dormitory"],
  ["Boys' dormitory roll call", "Dormitory roll call", "21:45", "22:15", "Ivan Mugisha", "Boys' Dormitory"],
  ["Bus route 03 boarding", "Transport", "17:00", "17:45", "Daniel Okello", "Bus Bay"],
  ["Main gate exit", "Gate exit", "16:30", "18:00", "Moses Ochieng", "Main Gate"],
  ["Morning prep", "Morning prep", "05:30", "06:45", "Ivan Mugisha", "Classroom Block A"],
  ["Evening assembly", "Evening assembly", "18:00", "18:30", "Samuel Wamala", "Assembly Ground"],
  ["Debate club", "Clubs", "15:00", "16:30", "Sarah Namusoke", "Room 12"],
  ["Geography field trip — Jinja", "Trips", "07:00", "18:00", "Joshua Kato", "Off campus"],
  ["Zonal games official duty", "Official duty", "08:00", "16:00", "Esther Akello", "Off campus"],
];

export const OCCASIONS: AttendanceOccasion[] = OCCASION_DEFS.map(
  ([name, category, startTime, endTime, staff, location], i) => {
    const expected = int(80, 620);
    const status: AttendanceOccasion["status"] =
      i < 2 ? "closed" : i < 5 ? "active" : i === 5 ? "paused" : i < 10 ? "scheduled" : i < 13 ? "reconciled" : "closed";
    return {
      id: `occ-${pad(i + 1)}`,
      name,
      category,
      date: "2026-08-03",
      startTime,
      endTime,
      expected,
      scanned: status === "scheduled" ? 0 : Math.round(expected * (0.62 + rnd() * 0.36)),
      responsibleStaff: staff,
      location,
      status,
    };
  },
);

export const ATTENDANCE_RECORDS: AttendanceRecord[] = LEARNERS.slice(0, 160).map((l, i) => {
  const occ = OCCASIONS[i % 6]!;
  const status = l.todayStatus;
  return {
    id: `att-${pad(i + 1, 4)}`,
    learnerId: l.id,
    learnerName: l.fullName,
    admissionNumber: l.admissionNumber,
    className: l.className,
    stream: l.stream,
    occasionId: occ.id,
    occasionName: occ.name,
    status,
    scanTime: status === "unexplained" || status === "excused" ? null : `0${int(6, 9)}:${pad(int(10, 59), 2)}`,
    deviceName: status === "unexplained" ? null : pick(DEVICES).name,
    recordedBy: occ.responsibleStaff,
    reconciliation: status === "unexplained" ? "pending" : status === "excused" ? "reconciled" : "not_required",
    date: "2026-08-03",
    photoHue: l.photoHue,
  };
});

export const SCANS: ScanEvent[] = LEARNERS.slice(0, 40).map((l, i) => ({
  id: `scn-${pad(i + 1)}`,
  learnerId: l.id,
  learnerName: l.fullName,
  admissionNumber: l.admissionNumber,
  className: `${l.className} ${l.stream}`,
  occasionId: OCCASIONS[0]!.id,
  occasionName: OCCASIONS[0]!.name,
  status: i % 9 === 0 ? "late" : "present",
  scanTime: `0${6 + (i % 3)}:${pad(10 + (i % 49), 2)}`,
  deviceId: DEVICES[0]!.id,
  deviceName: DEVICES[0]!.name,
  recordedBy: "Moses Ochieng",
  outcome: i % 13 === 0 ? "duplicate" : i % 9 === 0 ? "late" : i % 17 === 0 ? "revoked_card" : "accepted",
}));

export const AUTHORIZED_ABSENCES: AuthorizedAbsence[] = LEARNERS.slice(20, 34).map((l, i) => ({
  id: `abs-${pad(i + 1)}`,
  learnerId: l.id,
  learnerName: l.fullName,
  className: `${l.className} ${l.stream}`,
  reason: pick([
    "Attending a scheduled clinic review at Nsambya Hospital",
    "Family bereavement in Mbale",
    "Representing the school at the zonal athletics meet",
    "National music festival rehearsals",
    "Passport appointment with guardian",
  ]),
  category: pick(["Medical", "Family", "Official duty", "Sports", "Other"]),
  fromDate: "2026-08-0" + int(1, 3),
  toDate: "2026-08-0" + int(4, 9),
  approvedBy: pick(["Samuel Wamala", "Grace Nakabugo", "Esther Akello"]),
  status: i % 5 === 0 ? "pending" : i % 7 === 0 ? "expired" : "approved",
}));

export const OBSERVATIONS: Observation[] = LEARNERS.slice(5, 45).map((l, i) => {
  const category = pick([
    "Positive conduct",
    "Academic observation",
    "Minor concern",
    "Welfare concern",
    "General observation",
    "Serious alleged incident",
  ] as Observation["category"][]);
  return {
    id: `obs-${pad(i + 1)}`,
    reference: `OBS-2026-${pad(300 + i)}`,
    learnerId: l.id,
    learnerName: l.fullName,
    className: `${l.className} ${l.stream}`,
    category,
    severity: category === "Serious alleged incident" ? "high" : category === "Minor concern" ? "medium" : "low",
    dateTime: `2026-08-0${int(1, 3)} ${pad(int(7, 20), 2)}:${pad(int(0, 59), 2)}`,
    location: pick(["Classroom Block A", "Dining Hall", "Playground", "Library", "Main Gate", "Dormitory"]),
    relatedOccasion: pick([...OCCASIONS.map((o) => o.name), null]),
    description: pick([
      "Learner assisted a classmate who had fallen during the morning assembly and reported it to the duty teacher.",
      "Learner arrived after the gate closing time and stated that the bus was delayed at Kireka stage.",
      "Learner submitted the mathematics assignment two days after the agreed deadline.",
      "Learner appeared withdrawn during prep and declined the evening meal.",
      "Learner led the class clean-up rota without supervision.",
      "An allegation was raised by another learner and is being recorded factually for review.",
    ]),
    immediateAction: pick([
      "Spoke with the learner and recorded the account in the presence of the class teacher.",
      "Referred the learner to the class teacher for follow-up.",
      "Commended the learner in front of the class.",
      "Escorted the learner to the sick bay for a welfare check.",
    ]),
    recommendedFollowUp: pick([
      "Guardian to be informed during the routine contact round.",
      "Monitor over the next two weeks.",
      "Refer to the counselling team for a supportive conversation.",
      "No further action required.",
    ]),
    witnesses: [pick(STAFF).name],
    parentContactRecommended: i % 3 === 0,
    recordedBy: pick(STAFF).name,
    confidential: category === "Welfare concern" || category === "Serious alleged incident",
  };
});

export const CASES: ConductCase[] = LEARNERS.slice(50, 68).map((l, i) => {
  const stages: ConductCase["stage"][] = [
    "Submitted","Assigned","Learner response","Evidence review","Finding","Intervention","Review","Closure",
  ];
  const stage = stages[i % stages.length]!;
  const closed = stage === "Closure";
  return {
    id: `case-${pad(i + 1)}`,
    reference: `CS-2026-${pad(120 + i)}`,
    learnerId: l.id,
    learnerName: l.fullName,
    className: `${l.className} ${l.stream}`,
    title: pick([
      "Repeated late arrival at the main gate",
      "Alleged unauthorised exit during prep",
      "Reported disagreement in the dining hall",
      "Missing laboratory equipment enquiry",
      "Alleged use of a prohibited item in the dormitory",
    ]),
    summary:
      "A review has been opened to establish the facts. The learner has been informed and will be given an opportunity to respond before any finding is made.",
    stage,
    finding: closed ? pick(["Confirmed", "Unconfirmed", "Dismissed", "Referred"]) : null,
    assignedReviewer: pick(["Samuel Wamala", "Grace Nakabugo", "Esther Akello"]),
    learnerResponse:
      i % 2 === 0 ? "The learner states that permission had been granted verbally by the duty teacher." : null,
    evidenceCount: int(0, 5),
    parentContacted: i % 3 !== 0,
    openedOn: `2026-07-${pad(int(10, 28), 2)}`,
    reviewDate: closed ? null : `2026-08-${pad(int(5, 25), 2)}`,
    closed,
    confidential: i % 4 === 0,
    timeline: [
      { id: `tl-${i}-1`, stage: "Submitted", actor: pick(STAFF).name, at: `2026-07-${pad(int(10, 18), 2)} 09:12`, note: "Observation escalated to a case review." },
      { id: `tl-${i}-2`, stage: "Assigned", actor: "Grace Nakabugo", at: `2026-07-${pad(int(19, 22), 2)} 10:04`, note: "Reviewer assigned and learner notified." },
      { id: `tl-${i}-3`, stage: "Learner response", actor: l.fullName, at: `2026-07-${pad(int(23, 26), 2)} 14:30`, note: "Learner gave a written response." },
    ],
  };
});

export const INTERVENTIONS: Intervention[] = LEARNERS.slice(70, 86).map((l, i) => ({
  id: `int-${pad(i + 1)}`,
  learnerId: l.id,
  learnerName: l.fullName,
  className: `${l.className} ${l.stream}`,
  type: pick(["Counselling", "Academic support", "Mentorship", "Guardian meeting", "Support plan"]),
  owner: pick(["Faith Atim", "Esther Akello", "Lydia Nabirye", "Sarah Namusoke"]),
  startedOn: `2026-07-${pad(int(5, 28), 2)}`,
  reviewOn: `2026-08-${pad(int(4, 28), 2)}`,
  status: i % 6 === 0 ? "overdue" : i % 4 === 0 ? "completed" : "active",
  progressNote: pick([
    "Attendance has improved for three consecutive weeks.",
    "Weekly check-in held; learner reports feeling more settled.",
    "Guardian meeting scheduled for the coming Friday.",
    "Additional mathematics support sessions arranged.",
  ]),
  confidential: i % 3 === 0,
}));

export const HEALTH_ENCOUNTERS: HealthEncounter[] = LEARNERS.slice(90, 104).map((l, i) => ({
  id: `hlt-${pad(i + 1)}`,
  learnerId: l.id,
  learnerName: l.fullName,
  className: `${l.className} ${l.stream}`,
  complaint: pick(["Headache", "Stomach discomfort", "Minor sports injury", "Fever check", "Allergic reaction review"]),
  action: pick(["Rest and fluids", "Observation for one hour", "First aid applied", "Guardian informed"]),
  attendedBy: "Faith Atim",
  arrivedAt: `2026-08-03 ${pad(int(7, 16), 2)}:${pad(int(0, 59), 2)}`,
  outcome: pick(["Returned to class", "Resting", "Referred to clinic", "Guardian collected"]),
  confidential: true,
}));

export const SUBJECTS: Subject[] = [
  ["MTC", "Mathematics", "O-Level", "Joshua Kato"],
  ["ENG", "English Language", "O-Level", "Sarah Namusoke"],
  ["PHY", "Physics", "O-Level", "Brian Ssemanda"],
  ["CHE", "Chemistry", "O-Level", "Brian Ssemanda"],
  ["BIO", "Biology", "O-Level", "Amina Nansubuga"],
  ["HIS", "History", "O-Level", "Amina Nansubuga"],
  ["GEO", "Geography", "O-Level", "Joshua Kato"],
  ["ECO", "Economics", "A-Level", "Esther Akello"],
  ["SUB", "Subsidiary ICT", "A-Level", "Brian Ssemanda"],
  ["LIT", "Literature in English", "A-Level", "Sarah Namusoke"],
].map(([code, name, level, teacher], i) => ({
  id: `sub-${i}`,
  code: code as string,
  name: name as string,
  level: level as Subject["level"],
  teacher: teacher as string,
  classes: level === "A-Level" ? ["Senior Five", "Senior Six"] : ["Senior One", "Senior Two", "Senior Three", "Senior Four"],
  completion: int(45, 100),
}));

export const ASSESSMENTS: Assessment[] = SUBJECTS.flatMap((s, i) =>
  ["Beginning of term", "Mid-term", "End of term"].map((n, j) => {
    const expected = int(40, 120);
    return {
      id: `asm-${i}-${j}`,
      name: `${n} assessment`,
      subject: s.name,
      className: pick(CLASSES),
      term: "Term Two 2026",
      dueDate: `2026-08-${pad(int(5, 28), 2)}`,
      entered: j === 2 ? int(0, expected) : expected,
      expected,
      status: (j === 2 ? "marks_entry" : j === 1 ? "published" : "open") as Assessment["status"],
    };
  }),
);

export const MESSAGES: NotificationMessage[] = [
  ["Unexplained absence alert", "Guardians of 18 learners", "Your child was not recorded present today. Please contact the school office."],
  ["Arrival notification", "Guardians of Senior One", "Your child arrived safely at school this morning."],
  ["Reporting date reminder", "All guardians", "Term Two reporting continues on Monday. Please contact the school office for details."],
  ["Parent meeting invitation", "Guardians of Senior Four", "You are invited to the Senior Four guardians' meeting this Saturday at 10:00."],
  ["Learner support follow-up", "Selected guardians", "Please contact the school regarding an important learner-support matter."],
  ["Bus route change", "Guardians on Route 03", "Route 03 will depart 15 minutes earlier this week."],
].map(([template, audience, body], i) => {
  const recipients = int(20, 420);
  const failed = int(0, 12);
  return {
    id: `msg-${i}`,
    template: template as string,
    audience: audience as string,
    channel: "SMS" as const,
    body: body as string,
    sentAt: `2026-08-0${int(1, 3)} ${pad(int(7, 18), 2)}:${pad(int(0, 59), 2)}`,
    recipients,
    delivered: recipients - failed,
    failed,
    status: (i === 5 ? "queued" : failed > 8 ? "failed" : "sent") as NotificationMessage["status"],
  };
});

export const AUDIT_EVENTS: AuditEvent[] = Array.from({ length: 60 }, (_, i) => {
  const staff = pick(STAFF);
  const action = pick([
    "Viewed learner record",
    "Updated learner record",
    "Recorded attendance scan",
    "Closed attendance occasion",
    "Revoked QR credential",
    "Created observation",
    "Opened conduct case",
    "Exported report",
    "Changed staff role",
    "Attempted restricted access",
  ]);
  const denied = action === "Attempted restricted access";
  return {
    id: `aud-${pad(i + 1)}`,
    at: `2026-08-0${int(1, 3)} ${pad(int(6, 21), 2)}:${pad(int(0, 59), 2)}`,
    user: staff.name,
    role: staff.roleName,
    action,
    module: pick(["Learners", "Attendance", "Observations", "Cases", "Devices", "Reports", "Staff", "Settings"]),
    record: pick(LEARNERS).admissionNumber,
    device: pick(DEVICES).name,
    ip: `41.${int(50, 250)}.${int(1, 250)}.${int(1, 250)}`,
    reason: action === "Revoked QR credential" ? "Card reported lost by the learner" : null,
    result: denied ? "denied" : "success",
    before: action.startsWith("Updated") ? { guardianPhone: "+256 772 145 900", residence: "Day" } : undefined,
    after: action.startsWith("Updated") ? { guardianPhone: "+256 701 445 231", residence: "Boarding" } : undefined,
  };
});

export const ATTENDANCE_TREND = [
  { day: "Mon", present: 612, late: 34, absent: 21 },
  { day: "Tue", present: 628, late: 22, absent: 17 },
  { day: "Wed", present: 601, late: 41, absent: 25 },
  { day: "Thu", present: 634, late: 18, absent: 15 },
  { day: "Fri", present: 590, late: 47, absent: 30 },
  { day: "Sat", present: 402, late: 12, absent: 9 },
  { day: "Mon", present: 641, late: 20, absent: 14 },
];

export const CLASS_RATES = CLASSES.map((c) => ({ className: c.replace("Senior ", "S"), rate: int(84, 99) }));
