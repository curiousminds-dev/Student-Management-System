# Security architecture and review

## Controls implemented

- PostgreSQL with tenant-scoped queries, relational constraints and transactional mutations.
- Ten-minute signed access tokens held only in browser memory; rotating 30-day refresh tokens are stored in Secure, SameSite=Strict, HTTP-only cookies.
- Server-side session registry supports individual logout, forced logout, password-reset revocation and role/status-change revocation.
- Bcrypt password hashing, generic reset responses, one-time hashed reset tokens, five-attempt account lockout and route/IP rate limits.
- Optional TOTP MFA. Seeds are encrypted with AES-256-GCM under a secret supplied through the deployment secret store.
- Separate device credentials, 12-hour device sessions, secret versions, rotation and immediate session revocation.
- Helmet headers, strict CORS with credentials, Zod request validation, audit trails and structured log redaction.
- QR credentials contain high-entropy random values; only SHA-256 hashes and masked previews are persisted.

## Automated security review

CI runs dependency auditing, static linting, tests for authentication/RBAC/tenant boundaries, concurrency/idempotency tests and an OWASP ZAP baseline against the running API. Container images should additionally be scanned by the deployment registry.

## Manual review required before launch

An independent assessor must validate authorization on every role and endpoint, test session fixation/rotation/replay, verify CORS and cookie behaviour on the production domains, attempt SQL/JSON injection and mass assignment, review provider webhooks, test device theft/rotation, validate backup access, and perform an authenticated OWASP ASVS Level 2 penetration test. Findings must be recorded, remediated and retested. Automated scanning is not a substitute for this independent test.

## Secrets

No production secret belongs in Git, images or ConfigMaps. The API accepts `*_FILE` values for Docker/Kubernetes mounted secrets. In managed environments, sync these files from AWS Secrets Manager, Azure Key Vault, GCP Secret Manager or an External Secrets Operator. Rotate JWT, MFA, database, provider, metrics and device secrets under the incident/runbook procedure.
