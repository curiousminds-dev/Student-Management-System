# Backend foundation

The REST API lives in `server/` and is exposed below `/api/v1`. It uses Fastify, Prisma and PostgreSQL in every environment so development and CI exercise the same database semantics used in production.

## Local setup

1. Start PostgreSQL, copy `.env.example` to `.env`, and set strong `JWT_SECRET` and `MFA_ENCRYPTION_KEY` values.
2. Run `npm install`, `npm run db:generate`, `npm run db:migrate`, and `npm run db:seed`.
3. Start the API with `npm run api:dev` and the UI with `npm run dev`.

All seeded accounts use `demo-password`. The seed QR value is `NCS-DEMO-AMINA-001`; raw QR credentials are never stored, only SHA-256 hashes and masked previews.

## Security and data guarantees

- Ten-minute signed access tokens are held in memory; rotating refresh tokens use HTTP-only cookies and a revocable server-side session registry.
- Every protected endpoint checks a server-side permission. UI permission checks are only for presentation.
- School scoping is applied to reads and mutations to prevent cross-school access.
- Attendance has uniqueness constraints for learner/occasion and offline event IDs.
- Offline batches and events use client IDs for safe idempotent retries.
- QR issuance revokes the previous active credential transactionally.
- Biometric enrollment requires recorded consent. Raw facial images and fingerprint templates stay in the approved device/provider; the platform stores only the provider reference, quality scores, and audit metadata.
- Face verification requires both match confidence and liveness. Below-threshold matches are quarantined for authorised review rather than creating attendance automatically.
- Scanner events are authenticated to an approved device, checked against its declared capabilities, and idempotent by device/event ID.
- Mutations write append-only audit events with actor, entity, request correlation ID, IP and user agent.
- Passwords use bcrypt; QR secrets are returned only when issued and stored as hashes.

## Main endpoints

- `POST /auth/login`, `GET /auth/me`
- `GET|POST /learners`, `GET|PATCH /learners/:id`
- `POST /learners/:id/qr-credentials`, `POST /qr-credentials/:id/revoke`
- `GET|POST /attendance/occasions`, `PATCH /attendance/occasions/:id/status`
- `POST /attendance/scan`, `POST /attendance/sync`
- `GET /biometrics/credentials`, `POST /learners/:id/biometrics`, `POST /biometrics/credentials/:id/revoke`
- `POST /attendance/biometric-verify`, `GET /attendance/biometric-captures`, `POST /attendance/biometric-captures/:id/review`
- `GET /attendance`, `GET /attendance/scans`, `GET /devices`
- `POST /communications`, `GET /audit-logs`
- `GET /reports/attendance-summary`, `GET /reports/attendance.csv`

Communications are placed in a durable outbox (`Message`) for a provider worker to deliver. This avoids losing messages and keeps provider credentials out of request handlers.

## Biometric device adapter

The web app includes an administrator-facing adapter test, but actual matching must run in the selected face-camera or fingerprint-reader SDK. After local matching, that trusted adapter authenticates as a registered device and posts its provider reference, scores, modality, occasion, and unique event ID to `/attendance/biometric-verify`. The API deliberately does not accept or retain raw biometric samples.
