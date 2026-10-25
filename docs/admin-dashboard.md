# Local administrator dashboard

Run `node scripts/setup-local-admin.mjs` once and start Vite on localhost:3001. The script creates a generated administrator password, a salted scrypt verifier and a random signing secret outside the website at `~/.chart-replay/`. Private login instructions are in `admin-login.txt` in that directory. The script never overwrites an existing administrator. Keep the private directory out of GitHub and outside all static web roots. `PLATFORM_DATA_DIR` can select another private directory; do not point it into this repository or its public folder.

`/admin` has a separate login. The server checks an eight-hour signed HttpOnly SameSite=Strict admin cookie for every user-list request. Only localhost hosts are accepted; this file-backed service is disabled on Vercel. Login attempts are rate-limited and cross-origin writes rejected. No password or verifier appears in API user projections or dashboard rows. New users' passwords are salted scrypt verifiers on the server, not browser credentials. The initial signup signs in once and counts as login 1. Refresh/resume does not count; only successful sign-ins increment the count.

Accounts registered after this backend is enabled save centrally on this local server, across browsers using it. Their names, emails, signup dates, successful login counts and last login appear in the dashboard. Existing browser-only profiles are shown separately from the current browser, excluding the seeded demo account. Existing local sessions and notes remain in their browser. Legacy accounts retain local sign-in; their login counters start from the new tracking code, with older counts unavailable. The dashboard never uploads their old password verifiers.

This does not provide a global directory of previous website visitors: those records were never collected centrally. Before public deployment, move storage to a persistent shared database, deploy HTTPS, configure the real admin identity and operational password-recovery/email-verification flow, set retention/deletion procedures, update privacy/operator details and back up the database. Self-service reset is unavailable for new server accounts until a verified recovery flow exists; legacy local reset remains restricted to old local profiles. Normal simulator sessions remain the existing browser-based implementation, rather than a new server-authorisation system. Administrator access is distinct from that prototype session state.

Metrics in v1: total registered profiles, server accounts, new signups in seven days, successful logins, users signed in over the last seven days, signup activity and a searchable name/email table. Historical login totals are not fabricated. Referral tracking and billing are intentionally not included. No bulk export or destructive administration is exposed.


## Live activity and replay sessions

The prominent footer Administrator Login opens `/admin`; Try platform demo is a separate action. The existing private `admin-login.txt` supplies credentials.

Visible public pages send a heartbeat every 30 seconds with a random browser visitor ID. Online visitors are distinct browser IDs seen within two minutes, not guaranteed unique people; separate tabs share the same ID. This short-lived presence map resets on server restart. Administrator pages do not send heartbeats. No IP addresses are stored.

Server sign-in/signup sets a separate signed HttpOnly eight-hour user cookie. Heartbeats can attribute last activity and unique replay-session IDs only to that authenticated account, never solely to a claimed email. The supplied account ID must match the signed cookie, avoiding stale-tab attribution. Session IDs are retained centrally across browsers/deletion, exclude the two starter examples, and are capped at 10,000 per user. Existing sessions first reported after enabling tracking are included; unavailable earlier history is not reconstructed. The app reports up to 1,000 current sessions. Accounts already signed in before this change must sign in again before attributed activity is available.

Metrics remain limited to this localhost server. Public/global tracking still requires a hosted shared backend.


Development-only Quick admin preview opens `/admin?preview=1` with labelled example data and no account API calls. It is available on localhost during development, and never authenticates the visitor or unlocks real records.


## Analytics, subscriber directory and partnerships

Admin navigation now includes Overview, Signup analytics, Registered users and Waiting list. User and waitlist tables show 20 rows per page, searchable by name/email. Filtering resets pagination. Signup reporting offers Today, Yesterday, Tomorrow, This month, Last month, This year, Last year, All time and custom inclusive dates, all using South African calendar boundaries. Tomorrow shows recorded data only and is not a forecast. Login/session cards are explicitly lifetime totals because historical per-event login timestamps were not retained.

On a configured localhost server, `/api/waitlist` accepts consented name/email signups into the private `waitlist.json` beside the account store. Email addresses are normalised and deduplicated. The endpoint enforces same-origin submissions, input limits, a honeypot, required name and launch-update consent, and request limits. The administrator-only `/api/platform?action=waitlist` lists these records. If enabled Redis configuration is present, both collection and the admin list use that connected Redis waitlist instead. Earlier local records remain local if subsequently switching to Redis; migrate them deliberately before launch. This page never sends an email.

`/partners` is the public partnership page. Header/mobile/footer Partner with Us links open it; its contact actions open a prefilled email draft. It describes platform support, education/community and technology/data collaborations, limited disclosed placements, no pop-ups or forced redirects, and the goal of keeping practice accessible for South African traders.
