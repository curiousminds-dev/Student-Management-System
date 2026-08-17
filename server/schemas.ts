import { z } from "zod";

export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
export const learnerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  admissionNumber: z.string().min(2),
  lin: z.string().optional(),
  className: z.string().min(2),
  stream: z.string().min(1),
  gender: z.enum(["Male", "Female"]),
  residence: z.enum(["Day", "Boarding"]),
  dateOfBirth: z.coerce.date(),
  guardianName: z.string().min(2),
  guardianPhone: z.string().min(7),
  status: z.enum(["active", "inactive", "transferred"]).default("active"),
  campusId: z.string().optional(),
});
export const occasionSchema = z.object({
  name: z.string().min(3),
  category: z.string().min(2),
  location: z.string().min(2),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  expected: z.number().int().positive(),
  responsibleStaffId: z.string().min(1),
});
export const scanSchema = z.object({
  credential: z.string().min(8),
  occasionId: z.string(),
  deviceId: z.string().optional(),
  clientEventId: z.string().optional(),
  recordedAt: z.coerce.date().default(() => new Date()),
});
export const syncSchema = z.object({
  clientBatchId: z.string().min(1),
  events: z.array(scanSchema.extend({ clientEventId: z.string().min(1) })).max(500),
});
export const biometricEnrollmentSchema = z.object({
  modality: z.enum(["face", "fingerprint"]),
  provider: z.string().min(2).max(80),
  providerReference: z.string().min(3).max(200).optional(),
  qualityScore: z.number().min(0).max(1).optional(),
  consentRecorded: z.literal(true),
  consentBy: z.string().min(2).max(120),
  expiresAt: z.coerce.date().optional(),
});
export const biometricVerificationSchema = z
  .object({
    learnerId: z.string().optional(),
    credentialId: z.string().optional(),
    occasionId: z.string(),
    deviceId: z.string(),
    clientEventId: z.string().min(8),
    modality: z.enum(["face", "fingerprint"]),
    provider: z.string().min(2).max(80),
    providerEventId: z.string().max(200).optional(),
    confidence: z.number().min(0).max(1),
    livenessScore: z.number().min(0).max(1).optional(),
    qualityScore: z.number().min(0).max(1).optional(),
    capturedAt: z.coerce.date().default(() => new Date()),
  })
  .refine((value) => value.learnerId || value.credentialId, {
    message: "learnerId or credentialId is required",
  });
export const messageSchema = z.object({
  channel: z.enum(["sms", "email", "in_app"]),
  recipients: z.array(z.string()).min(1).max(1000),
  subject: z.string().optional(),
  body: z.string().min(1).max(2000),
});
