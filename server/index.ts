import { buildApp } from "./app.js";
import { prisma } from "./lib.js";
import { deliverQueuedMessages } from "./communications.js";
import { env } from "./env.js";
import { enforceRetention } from "./retention.js";

const app = await buildApp();
const port = env.API_PORT;
await app.listen({ port, host: "0.0.0.0" });
const deliveryTimer = setInterval(() => void deliverQueuedMessages(), 15000);
const retentionTimer = setInterval(() => void enforceRetention(), 24 * 3600000);

for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    clearInterval(deliveryTimer);
    clearInterval(retentionTimer);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
