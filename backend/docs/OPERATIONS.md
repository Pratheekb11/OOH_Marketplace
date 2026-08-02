# Operations, integrations and security

## Current external integrations

| Integration | Current behavior | Production action required |
| --- | --- | --- |
| PostgreSQL | Supported through SQLAlchemy and Docker Compose. | Use managed PostgreSQL, TLS, backups and least-privilege credentials. |
| File storage | Writes to S3 when `S3_BUCKET` exists; otherwise local `uploads/`. | Use private S3 bucket, IAM role, lifecycle policy and signed download URLs. |
| GST validation | Calls configured validation URL; otherwise only checks a basic length. | Configure a vetted GST provider and validate response schema. |
| Google Maps | Geocodes listing location only when API key exists. | Restrict the key by API and server IP/domain. |
| SMTP | `send_email()` adapter exists but no worker invokes it yet. | Add a queued worker before treating email/SMS as delivered. |
| Payments | Intent records only; simulated confirmation in development. | Implement a provider order and verified, idempotent webhook. |

## Security controls included

- Passwords are bcrypt hashed.
- JWTs contain user ID, role and expiry.
- Role guards restrict owner, advertiser and admin endpoints.
- Login/registration are IP rate limited.
- CORS and trusted-host controls are configurable.
- Responses receive `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy` headers.
- Upload MIME types and a 10 MB size limit are enforced.
- Sensitive business changes are written to `audit_logs`.
- Production blocks public admin registration and payment simulation.

## Required before public launch

1. Implement gateway checkout and signed webhooks; never accept a client-supplied “paid” value.
2. Move notification delivery to a durable queue/worker and add retry/dead-letter handling.
3. Add password reset, MFA/OTP or OAuth as required by the product policy.
4. Use Decimal/integers in paise for all money and add DB-level booking constraints/transaction locking for high concurrency.
5. Serve documents with authorization checks and short-lived signed URLs.
6. Add observability: structured logs, error tracking, metrics, uptime probes and database backups.
7. Run dependency/security scanning and integration/load tests in CI.

These are operational requirements, not credentials that can be safely invented in source code.
