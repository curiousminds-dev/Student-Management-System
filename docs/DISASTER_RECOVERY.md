# Backup, restoration and disaster recovery

## Targets

- Production objective: RPO 15 minutes using managed PostgreSQL point-in-time recovery plus nightly logical dumps.
- Production objective: RTO 4 hours for a regional service outage.
- Encrypt backups in transit and at rest with a separate backup key. Restrict restore permissions and keep an immutable/off-account copy.

## Procedure

1. Declare the incident, freeze non-essential changes and record the recovery point.
2. Revoke exposed credentials and isolate compromised workloads when applicable.
3. Provision a clean PostgreSQL target and application environment from reviewed manifests.
4. Verify the dump checksum, set `CONFIRM_RESTORE=RESTORE`, and run `scripts/restore.sh`.
5. Run migrations, readiness checks and smoke tests; verify tenant counts, recent attendance and audit continuity.
6. Redirect traffic gradually, monitor error/latency metrics and obtain incident-owner approval.
7. Record actual RPO/RTO, reconcile data captured after the recovery point and complete a post-incident review.

Restore tests must run quarterly in an isolated account/namespace. A backup is not considered valid until a restore and application-level verification succeed.
