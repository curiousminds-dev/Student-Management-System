import { env } from "./env.js";
import { prisma } from "./lib.js";

export async function enforceRetention() {
  const auditBefore = new Date(Date.now() - env.AUDIT_RETENTION_DAYS * 86400000);
  const messageBefore = new Date(Date.now() - env.MESSAGE_RETENTION_DAYS * 86400000);
  const [audit, messages, sessions, resetTokens, deviceSessions] = await prisma.$transaction([
    prisma.auditEvent.deleteMany({ where: { createdAt: { lt: auditBefore } } }),
    prisma.message.deleteMany({
      where: { createdAt: { lt: messageBefore }, status: { in: ["sent", "failed"] } },
    }),
    prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    prisma.deviceSession.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
  ]);
  return {
    audit: audit.count,
    messages: messages.count,
    sessions: sessions.count,
    resetTokens: resetTokens.count,
    deviceSessions: deviceSessions.count,
  };
}
