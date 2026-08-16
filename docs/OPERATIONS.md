# Production operations

Use a managed PostgreSQL service with multi-zone high availability, point-in-time recovery, encrypted storage and private networking. Run at least two API replicas behind TLS termination. The Kubernetes example applies non-root execution, a read-only filesystem, health probes, resource limits, disruption protection, autoscaling and a default-deny network policy.

Prometheus metrics are available at `/metrics`; protect the endpoint with `METRICS_TOKEN`. JSON logs redact authorization, cookies and security fields and should be shipped to the organization’s central platform. Alert on readiness failures, 5xx rate, p95 latency, login lockouts, message-delivery failures, database saturation, backup failure and restore-test age.

Recommended initial alerts:

- readiness unavailable for 2 minutes;
- 5xx responses above 2% for 5 minutes;
- p95 API latency above 1 second for 10 minutes;
- more than 10 account lockouts in 15 minutes;
- any nightly backup failure or checksum failure;
- no successful restore exercise within 100 days.

Deployments require migration review, a tested rollback, smoke tests and staged traffic. Database migrations must remain backward-compatible until all old application replicas are drained.
