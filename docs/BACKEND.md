# Backend foundation

The REST API lives in `server/` and is exposed below `/api/v1`. It uses Fastify, Prisma and SQLite locally; the schema is relational and can be migrated to PostgreSQL by changing the Prisma datasource provider and connection URL.

## Local setup

1. Copy `.env.example` to `.env` and set a strong `JWT_SECRET`.
2. Run `npm install`, `npm run db:generate`, `npm run db:migrate`, and `npm run db:seed`.
3. Start the API with `npm run api:dev` and the UI with `npm run dev`.

All seeded accounts use `demo-password`. The seed QR value is `NCS-DEMO-AMINA-001`; raw QR credentials are never stored, only SHA-256 hashes and masked previews.

## Security and data guarantees

- Short-lived signed bearer tokens identify the user, school, campus and role.
- Every protected endpoint checks a server-side permission. UI permission checks are only for presentation.
- School scoping is applied to reads and mutations to prevent cross-school access.
- Attendance has uniqueness constraints for learner/occasion and offline event IDs.
- Offline batches and events use client IDs for safe idempotent retries.
- QR issuance revokes the previous active credential transactionally.
- Mutations write append-only audit events with actor, entity, request correlation ID, IP and user agent.
- Passwords use bcrypt; QR secrets are returned only when issued and stored as hashes.

## Main endpoints

- `POST /auth/login`, `GET /auth/me`
- `GET|POST /learners`, `GET|PATCH /learners/:id`
- `POST /learners/:id/qr-credentials`, `POST /qr-credentials/:id/revoke`
- `GET|POST /attendance/occasions`, `PATCH /attendance/occasions/:id/status`
- `POST /attendance/scan`, `POST /attendance/sync`
- `GET /attendance`, `GET /attendance/scans`, `GET /devices`
- `POST /communications`, `GET /audit-logs`
- `GET /reports/attendance-summary`, `GET /reports/attendance.csv`

Communications are placed in a durable outbox (`Message`) for a provider worker to deliver. This avoids losing messages and keeps provider credentials out of request handlers.
