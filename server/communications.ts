import { env } from "./env.js";
import { prisma } from "./lib.js";

async function sendEmail(to: string[], subject: string, body: string) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error("Email provider is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text: body }),
  });
  if (!response.ok) throw new Error(`Email provider failed with ${response.status}`);
  return ((await response.json()) as { id: string }).id;
}

async function sendSms(to: string, body: string) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM)
    throw new Error("SMS provider is not configured");
  const form = new URLSearchParams({ To: to, From: env.TWILIO_FROM, Body: body });
  const authorization = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString(
    "base64",
  );
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    },
  );
  if (!response.ok) throw new Error(`SMS provider failed with ${response.status}`);
  return ((await response.json()) as { sid: string }).sid;
}

export async function deliverMessage(id: string) {
  const message = await prisma.message.findUniqueOrThrow({ where: { id } });
  if (message.status === "sent") return message;
  const recipients = JSON.parse(message.recipients) as string[];
  try {
    const refs =
      message.channel === "email"
        ? [await sendEmail(recipients, message.subject ?? "School notification", message.body)]
        : message.channel === "sms"
          ? await Promise.all(recipients.map((to) => sendSms(to, message.body)))
          : ["in-app"];
    return prisma.message.update({
      where: { id },
      data: { status: "sent", providerRef: refs.join(","), sentAt: new Date() },
    });
  } catch (error) {
    await prisma.message.update({
      where: { id },
      data: {
        status: "failed",
        providerRef: error instanceof Error ? error.message.slice(0, 250) : "Delivery failed",
      },
    });
    throw error;
  }
}

export async function deliverQueuedMessages(limit = 20) {
  const queued = await prisma.message.findMany({
    where: { status: { in: ["queued", "failed"] } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  return Promise.allSettled(queued.map((message) => deliverMessage(message.id)));
}
