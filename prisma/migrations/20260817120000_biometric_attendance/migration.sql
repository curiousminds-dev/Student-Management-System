ALTER TABLE "Device" ADD COLUMN "capabilities" TEXT NOT NULL DEFAULT 'qr';
ALTER TABLE "AttendanceRecord" ADD COLUMN "captureMethod" TEXT NOT NULL DEFAULT 'qr';
ALTER TABLE "AttendanceRecord" ADD COLUMN "confidence" DOUBLE PRECISION;
ALTER TABLE "AttendanceRecord" ADD COLUMN "livenessScore" DOUBLE PRECISION;

CREATE TABLE "BiometricCredential" (
  "id" TEXT NOT NULL,
  "learnerId" TEXT NOT NULL,
  "modality" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerReference" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "qualityScore" DOUBLE PRECISION,
  "consentRecorded" BOOLEAN NOT NULL DEFAULT false,
  "consentAt" TIMESTAMP(3),
  "consentBy" TEXT,
  "enrolledById" TEXT NOT NULL,
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedReason" TEXT,
  "expiresAt" TIMESTAMP(3),
  CONSTRAINT "BiometricCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BiometricCapture" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "learnerId" TEXT,
  "occasionId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "credentialId" TEXT,
  "clientEventId" TEXT NOT NULL,
  "modality" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT,
  "confidence" DOUBLE PRECISION,
  "livenessScore" DOUBLE PRECISION,
  "qualityScore" DOUBLE PRECISION,
  "outcome" TEXT NOT NULL,
  "reviewStatus" TEXT NOT NULL DEFAULT 'not_required',
  "reviewReason" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "attendanceRecordId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BiometricCapture_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BiometricCredential_learnerId_modality_status_idx" ON "BiometricCredential"("learnerId", "modality", "status");
CREATE UNIQUE INDEX "BiometricCredential_provider_providerReference_key" ON "BiometricCredential"("provider", "providerReference");
CREATE UNIQUE INDEX "BiometricCapture_deviceId_clientEventId_key" ON "BiometricCapture"("deviceId", "clientEventId");
CREATE UNIQUE INDEX "BiometricCapture_attendanceRecordId_key" ON "BiometricCapture"("attendanceRecordId");
CREATE INDEX "BiometricCapture_schoolId_reviewStatus_capturedAt_idx" ON "BiometricCapture"("schoolId", "reviewStatus", "capturedAt");
CREATE INDEX "BiometricCapture_learnerId_capturedAt_idx" ON "BiometricCapture"("learnerId", "capturedAt");
ALTER TABLE "BiometricCredential" ADD CONSTRAINT "BiometricCredential_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BiometricCapture" ADD CONSTRAINT "BiometricCapture_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BiometricCapture" ADD CONSTRAINT "BiometricCapture_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BiometricCapture" ADD CONSTRAINT "BiometricCapture_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BiometricCapture" ADD CONSTRAINT "BiometricCapture_occasionId_fkey" FOREIGN KEY ("occasionId") REFERENCES "AttendanceOccasion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BiometricCapture" ADD CONSTRAINT "BiometricCapture_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "BiometricCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BiometricCapture" ADD CONSTRAINT "BiometricCapture_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "AttendanceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
