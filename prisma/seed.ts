import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  await prisma.auditEvent.deleteMany();
  await prisma.message.deleteMany();
  await prisma.syncBatch.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.qrCredential.deleteMany();
  await prisma.attendanceOccasion.deleteMany();
  await prisma.device.deleteMany();
  await prisma.learner.deleteMany();
  await prisma.user.deleteMany();
  await prisma.campus.deleteMany();
  await prisma.school.deleteMany();
  const school = await prisma.school.create({
    data: {
      name: "Nile Crest Secondary School",
      campuses: { create: { name: "Kampala Campus", district: "Kampala" } },
    },
    include: { campuses: true },
  });
  const campus = school.campuses[0]!;
  const passwordHash = await bcrypt.hash("demo-password", 12);
  const accounts = [
    ["Administrator", "admin@nilecrest.ac.ug", "administrator"],
    ["Headteacher", "head@nilecrest.ac.ug", "headteacher"],
    ["Director of Studies", "dos@nilecrest.ac.ug", "director_of_studies"],
    ["Teacher", "teacher@nilecrest.ac.ug", "teacher"],
    ["Security Officer", "security@nilecrest.ac.ug", "security_officer"],
    ["School Nurse", "nurse@nilecrest.ac.ug", "nurse"],
    ["Warden", "warden@nilecrest.ac.ug", "warden"],
    ["Transport Officer", "transport@nilecrest.ac.ug", "transport_officer"],
  ];
  const users = [];
  for (const [name, email, role] of accounts)
    users.push(
      await prisma.user.create({
        data: {
          schoolId: school.id,
          campusId: campus.id,
          name: name!,
          email: email!,
          role: role!,
          passwordHash,
        },
      }),
    );
  const learners = [];
  for (const [i, data] of [
    ["Amina", "Nabirye", "NCS-2026-001", "Senior One", "East", "Female", "Day"],
    ["Brian", "Okello", "NCS-2026-002", "Senior Two", "West", "Male", "Boarding"],
    ["Cathy", "Namukasa", "NCS-2026-003", "Senior Three", "North", "Female", "Day"],
  ].entries()) {
    const [firstName, lastName, admissionNumber, className, stream, gender, residence] = data;
    learners.push(
      await prisma.learner.create({
        data: {
          schoolId: school.id,
          campusId: campus.id,
          firstName: firstName!,
          lastName: lastName!,
          admissionNumber: admissionNumber!,
          lin: `LIN-UG-${1001 + i}`,
          className: className!,
          stream: stream!,
          gender: gender!,
          residence: residence!,
          dateOfBirth: new Date(2010 - i, 2, 10 + i),
          guardianName: `Guardian ${lastName}`,
          guardianPhone: `+25670000000${i}`,
        },
      }),
    );
  }
  const demoQr = "NCS-DEMO-AMINA-001";
  await prisma.qrCredential.create({
    data: {
      learnerId: learners[0]!.id,
      serialHash: createHash("sha256").update(demoQr).digest("hex"),
      serialPreview: "NCS-DEMO…A-001",
      issuedById: users[0]!.id,
    },
  });
  const occasion = await prisma.attendanceOccasion.create({
    data: {
      campusId: campus.id,
      name: "Morning gate entry",
      category: "Gate entry",
      location: "Main gate",
      startsAt: new Date(Date.now() - 3600000),
      endsAt: new Date(Date.now() + 3600000),
      expected: learners.length,
      status: "active",
      responsibleStaffId: users[4]!.id,
    },
  });
  const deviceSecret = "ncs-demo-device-secret";
  await prisma.device.create({
    data: {
      schoolId: school.id,
      name: "Main Gate Scanner",
      publicId: "NCS-GATE-01",
      secretHash: createHash("sha256").update(deviceSecret).digest("hex"),
      location: "Main gate",
    },
  });
  console.log({ demoPassword: "demo-password", demoQr, occasionId: occasion.id });
}

main().finally(() => prisma.$disconnect());
