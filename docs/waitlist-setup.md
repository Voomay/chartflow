# Waitlist database preparation

The page stays a frontend preview by default. No database account has been created and no signup is collected until the operator supplies private server credentials and explicitly sets `WAITLIST_ENABLED=true`.

## Connect later

1. Create a persistent Upstash Redis database in the operator's own account; choose and document an appropriate region and service plan. Do not use a temporary test database for the public waitlist.
2. Copy `.env.waitlist.example` to `.env.local` for localhost, or add its three variables to the hosting environment. Use the private HTTPS REST endpoint and write token from the database console. Never put these in `VITE_*`, browser code, GitHub, or screenshots.
3. Confirm the operator/privacy notice, hosting and cross-border arrangements, retention/removal process and consent wording before public collection. Set `WAITLIST_ENABLED=true` only when ready, then restart Vite or redeploy production.
4. The frontend checks `GET /api/waitlist` for availability. Enabled forms use `POST /api/waitlist`; only a confirmed database write shows success. API errors preserve the form for retry. An offline or disabled endpoint keeps preview messaging.

Storage: Redis hash `chart-replay:waitlist:v1`, keyed by SHA-256 of normalised email. Values contain the submitted name/email, timestamp, source and consent version. Duplicate emails retain the original record and receive the same success response. Hashing the key does not anonymise the record. No public list/export endpoint exists. The private database console can inspect records or remove a requested email's hashed field using HDEL. Waitlist deletion is separate from deleting a local simulator account. Establish and carry out a retention schedule; there is no automatic record expiration.

Safeguards: limited body sizes, validation, explicit consent, honeypot, same-site browser-origin check, atomic database rate limit of ten attempts per hashed network address per hour, generic duplicate responses and no personal-data logging. The rate counter expires after one hour; browser requests also reveal ordinary connection information to the hosting provider. These measures are basic abuse controls, not proof of identity or email ownership. Add email verification/CAPTCHA or host protections if needed before a larger public launch.

No email automation is included. Saving a signup does not send a confirmation or launch email. Messaging, unsubscribe handling, verified sender identity and delivery are later work.

Run `node --test scripts/test-waitlist.mjs`. Tests use a mocked database and send no signups to a real provider.

Provider protocol reference: https://upstash.com/docs/redis/features/restapi (HTTPS POST JSON-array commands).
