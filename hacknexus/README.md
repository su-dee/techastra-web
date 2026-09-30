# HACK_NEXUS 1.0

A complete hackathon website based on `WEBSITE_CONTENT.md`, with an original dark editorial layout inspired by [DAQ Consulting](https://daqconsulting.com/) and [Anveril](https://anveril.com/). Built with React, Vite, Express, and PostgreSQL.

## Run locally — no Docker required

Requires Node.js 22.12+ (tested with Node 24).

```bash
npm install
npm run dev:local
```

Open **http://localhost:5173**. Use “Log in” → “Create account” to choose a username and a password (8+ characters; phone numbers are not accepted). Then register your squad. One squad registration is allowed per account, and it remains available after signing out and back in.

`dev:local` initializes a real local PostgreSQL database, applies the schema, and starts the API and frontend. Database data persists in the ignored `.local/` directory. Stop with `Ctrl+C`; restart with the same command. Both `localhost:5173` and `127.0.0.1:5173` are accepted in the default local configuration.

## Organizer admin console

Open **http://localhost:5173/admin**. Admin access is granted from the command line only. There is no public sign-up:

```bash
npm run admin:create -- <username>   # prompts for a password (12+ characters)
npm run admin:remove -- <username>   # revokes admin access and ends admin sessions
```

`admin:create` promotes an existing account or creates an organizer-only account. Rerun it to change the password; this signs out existing admin sessions. It uses `DATABASE_URL`, or the `npm run dev:local` database if that is unset. For non-interactive use, set `ADMIN_PASSWORD`.

Admins sign in with this separate password, never with their participant password. Admin sessions use their own `hn_admin` cookie, scoped to `/api/admin`, and expire after 8 hours. The console provides:

- **Overview**: squad, participant, account, and check-in totals; status counts; squads by domain; registrations over the last 14 days; most chosen challenges.
- **Registrations**: search, filters, sorting, and pagination. Open a squad to set its status (pending, approved, waitlisted, rejected), add private organizer notes, check it in, or delete it. You can export the current filtered view as CSV, with spreadsheet formulas neutralized. Participants see their status on their registration card.
- **Accounts**: sign an account out of every device, reset a forgotten password (shows a one-time temporary password the participant must replace when they sign in), or delete a participant account and its squad. Admin accounts cannot be deleted or reset from the panel.
- **Activity**: an audit log of every organizer change and export.

## Payments, ID cards, and check-in

1. **Register:** after "Register your squad", the lead is taken to `/payment`.
2. **Pay:** the page shows a UPI QR for the organizer account with **₹1,000 per team** pre-filled, and a note like `HACK_NEXUS HN-1A2B3C4D` that identifies the squad. The QR is generated from the organizer's PhonePe QR details, not the uploaded image. Dark modules on white keep it scannable by every UPI app. On phones, a button opens the UPI app directly.
3. **Submit proof:** the lead attaches the payment screenshot and enters the UPI transaction ID, then sees a confirmation. Screenshots are re-encoded in the browser, which strips photo metadata. The server accepts PNG, JPEG, or WebP up to 5 MB and checks the file bytes. Each transaction ID can be used by only one squad. The server sets the amount; the browser cannot change it.
4. **Verify:** in **Admin → Payments**, organizers compare the screenshot, transaction ID, and note against their UPI app or bank statement.
   - **Verify & approve squad** marks the payment verified, approves the squad, and issues its ID card.
   - **Reject** requires a reason, which is shown to the squad so they can resubmit. Rejecting a verified payment also revokes its ID card.
5. **ID card:** at `/pass`, verified squads get an ID card with their details and a unique check-in QR. They can download it as a PNG or print it. The code is also printed under the QR in case it can't be scanned.
6. **Check-in:** **Admin → Check-in** uses the device camera to scan ID cards. Each squad is checked in once; later scans report who scanned it first and when. Codes can also be typed in. The camera requires HTTPS, or `localhost` during development.
7. **More admins:** **Admin → Admins** adds full admins, or *check-in volunteers* who can only use the scanner.

Payment settings (`REGISTRATION_FEE`, `UPI_ID`, `UPI_PAYEE_NAME`) are in `.env.example`.

### Squad emails

The squad lead receives an email at each step:

| When | Email |
| --- | --- |
| The squad registers | **Registration received**: payment is pending, with a link to the payment page |
| The lead submits payment proof | **Registration completed**: payment is under verification |
| An organizer verifies the payment | **Registration confirmed**: with a link to the squad ID card |
| An organizer rejects the payment | **Action required**: includes the rejection reason and a link to resubmit |

Emails list the squad members when the lead has added them. Any SMTP server works. Gmail is free for up to about 500 emails a day:

1. Turn on 2-Step Verification for the sending Google account, then create an App Password at https://myaccount.google.com/apppasswords.
2. In `.env`, set `SMTP_USER` to the Gmail address and `SMTP_PASS` to the 16-character app password. `SMTP_HOST=smtp.gmail.com` and `SMTP_PORT=465` are already the defaults in `.env.example`. `MAIL_REPLY_TO` optionally sets the address replies go to.
3. Restart the server.

Emails are sent in the background, so a mail problem never blocks registration or a review. **Admin → Activity** records organizer-triggered emails as sent or failed, with the reason. Failures for participant-triggered emails are written to the server log. If SMTP is not configured, everything works as before and no email is sent.

## Use an existing PostgreSQL database

```bash
cp .env.example .env
# Set DATABASE_URL and APP_ORIGIN in .env
npm run db:migrate
npm run dev
```

Alternatively, `docker compose up -d db` starts PostgreSQL on port 5432 with the local credentials from `.env.example`. For a custom Docker password, set `POSTGRES_PASSWORD` and update `DATABASE_URL` to match. Do not use the sample credentials in production.

## Production

```bash
npm run build
# Configure DATABASE_URL, NODE_ENV=production, and APP_ORIGIN=https://your-domain.example
npm run db:migrate
npm start
```

Express serves the compiled app on loopback port 3001. Place it behind an HTTPS reverse proxy. Set `TRUST_PROXY=1` only when a trusted single proxy is in front of the app. The app requires HTTPS `APP_ORIGIN` in production so secure session cookies work. Do not expose Vite or the development PostgreSQL runtime publicly.

## Asset loading and caching

- The hero graphic is drawn locally on canvas; no video, remote model, or stock-image request is needed.
- Space Grotesk and Manrope are served locally from bundled WOFF2 fonts, with only Latin subsets included. There are no Google Fonts or third-party image requests.
- Production JS, CSS, and fonts have content-hashed filenames and `Cache-Control: public, max-age=31536000, immutable`. Unchanged assets are reused from the browser cache across normal refreshes. Changed builds get new asset URLs.
- HTML uses `no-cache` so browsers can discover updated builds. All API responses use `no-store`, including errors.
- A small startup loader runs before the application bundle. It observes application readiness plus initial font/image-load promises. Its animated rings and indeterminate track appear only when assets remain pending after 200 ms, then disappear immediately when loading settles. Asset failures or unusually slow downloads expose a retry link. It has no minimum display time, fake progress, refresh counter, or session-storage bypass. Warm cache loads normally finish before it appears. A hard refresh or cache eviction can legitimately require downloading assets again.
- Canvas drawing honors reduced-motion settings and pauses offscreen/in background tabs. Vite development mode intentionally revalidates assets; production caching applies after `npm run build` + `npm start`.

## Included

- Responsive landing page, navigation, event countdown, alliance, technology stack, all five timeline checkpoints, prizes, partners, and six FAQ accordions.
- Scroll-triggered section reveals, staggered card entrances, hero parallax, reading progress, and a timeline that fills as you scroll. Page entrances, hover effects, dialogs, mobile menus, and login tabs have coordinated transitions. Motion honors the operating system's reduced-motion setting, including changes while the page is open.
- All 15 complete problem statements, domain filters, accessible native challenge dialogs, and challenge-to-registration selection.
- Login and account creation at `/login`, HTTP-only cookie sessions, and PostgreSQL-backed registration confirmation.
- Event guidelines and privacy information at `/policies`.
- [Database schema documentation](DATABASE_SCHEMA.md) and executable [`server/schema.sql`](server/schema.sql).

## Verification

```bash
npm test
npm run build
```

Automated checks cover production cache headers, content completeness, cold/warm asset-loading behavior, optional-domain migrations, and API integration tests. The API tests use an isolated in-memory PostgreSQL engine (PGlite), apply the actual schema, and exercise hashing, session expiry, logout, account isolation, origin protection, registration persistence, validation, and database constraints. Local development uses the native PostgreSQL runtime, not PGlite. With `npm run dev:local` running, `npm run test:postgres` verifies signup, login, and persisted registration against that actual database using disposable records.

## Content and deployment notes

- The source brief calls the sprint **10 hours** but lists **09:00–19:30** (10.5 hours), and gives October 8–9 while only describing the October 8 schedule. The website preserves the provided event dates and checkpoint times; confirm the schedule before publishing.
- The organizer names, partner names, benefits, and participant counts come from the supplied brief. The contact email (techastra@drmgrdu.ac.in), Instagram link, and venue (CAR Lab, 2nd Floor, Anna Block, Main Campus) were supplied by the organizers. Confirm these before public release. The placeholder phone hotline is omitted.
- Squad emails are sent over SMTP when configured (see Squad emails). Accounts use chosen passwords. Accounts created when the mobile number was the password still sign in with it once and must then choose a password; see `DATABASE_SCHEMA.md`.
- Policies are concise implementation copy based on the brief and actual storage behavior. Have the event organizer approve them and define data retention before publication.
- Update `src/content.json` to change challenges/FAQs; keep domain/problem constraints in `server/schema.sql` synchronized when changing challenge IDs. Remaining event copy is in `src/main.jsx`.
- Target domain is optional, overriding the original brief’s required-domain field. Unselected domains are stored as NULL; selecting a challenge supplies its matching domain. Duplicate team names are blocked across accounts after case and whitespace normalization.
- No hosting deployment has been performed.
