# Going live: Techastra '26

Deployment runbook and the standards this project is built to. Everything runs on the Plesk hosting at techastra.drmgrdu.ac.in (section 2).

## 1. Before launch: information only the organisers have

| What | Where |
|---|---|
| UPI QR and ID that receive fees (currently `subalakshmime-1@okaxis`) | `client/src/assets/upi-qr.png` + `UPI_ID` in `client/src/lib/site.js` |
| Privacy / grievance contact email | `client/src/lib/site.js` (`LEGAL.contactEmail`), both `vite.config.js` (`SECURITY_CONTACT`) |
| Approved refund policy | `client/src/pages/Legal.jsx` (Terms), then set `LEGAL.refundPolicyConfirmed = true` |
| Final fees, times, seats, venues, team sizes | `server/prisma/eventData.js`, then re-run the seed |
| Staff logins (35: admin, hospitality, certificates, desk1–5, one per event) | `npm run staff:setup` creates them with unique passwords in `server/staff-credentials.csv` + printable `staff-credentials.html` (never commit) |
| Emails (the server's own mail, no SMTP) | `MAIL_TRANSPORT=sendmail` and `MAIL_FROM` (section 2.5), plus DKIM/SPF for the domain |

## 2. Deploy on Plesk (techastra.drmgrdu.ac.in)

**Layout: one site on the Plesk plan, and the database on Supabase.** Plesk needs no PostgreSQL and no extra subdomains. Both apps use one Supabase project (hosted PostgreSQL): Techastra's tables are in the `public` schema and Hack Nexus's in a `hacknexus` schema.

| Site | What runs there |
|---|---|
| `techastra.drmgrdu.ac.in` | **Node app** `techweb/server`. It serves the website (`client/dist`), the API, **Hack Nexus at `/hacknexus/`** (inside the same app, `HACKNEXUS_EMBEDDED=1`), and sends Techastra's emails through the server's `sendmail`, which is what PHP's `mail()` uses (`MAIL_TRANSPORT=sendmail`). |

Turn on **Let's Encrypt SSL** for the domain. The QR camera scanners need https.

### 2.1 Database (Supabase)
- **Project:** `kmosxyeszbvdpmtxasxk`, region **Mumbai (ap-south-1)**, pooler host `aws-0-ap-south-1.pooler.supabase.com`.
- **Turn off the Data API:** Project Settings → Data API. Neither app uses it, and it could otherwise publish tables.
- **Get the connection strings:** Connect → ORMs → Prisma. Use the **pooler** addresses (`…pooler.supabase.com`), not `db.<ref>.supabase.co`, which is IPv6-only on the free plan.
  - **Transaction pooler (port 6543):** the Techastra app uses this at runtime, with `?pgbouncer=true&connection_limit=5&sslmode=require` on the end.
  - **Session pooler (port 5432):** use it with `?sslmode=require` for Techastra migrations and for the Hack Nexus app.
- **Password:** letters and digits only. `@ : / ? # %` break the address; if the password has them, reset it (Project Settings → Database).
- **Free-plan limits:** the project **pauses after about a week without activity**; restore it from the dashboard (the paid plan never pauses). Up to 60 pooled connections, so keep the pools small (below).
- **Check the Plesk server can reach Supabase (SSH):** `cd ~/techweb/server && DATABASE_URL='<session URL>' npm run db:check`. If it hangs, ask the host to allow outgoing connections to ports 5432/6543.

### 2.2 Code (SSH)
```bash
cd ~                                   # the subscription's home folder
git clone https://github.com/su-dee/techastra-web.git techweb
```
The same checkout serves both Node apps. To update later: `cd ~/techweb && git pull`, then repeat the build steps and restart the apps.

### 2.3 Techastra app (`techastra.drmgrdu.ac.in` → Node.js)
- **Plesk → Node.js:**
  - Node **22.12 or newer**.
  - Application root: `techweb/server`.
  - Document root: `techweb/server/public` (keep it empty).
  - Startup file: `index.js`.
  - Application mode: production.
- **Environment variables** (Node.js → Custom environment variables):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the Supabase **transaction pooler** URL (port 6543) with `?pgbouncer=true&connection_limit=5&sslmode=require` |
| `JWT_SECRET` | 48+ random characters: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| `CLIENT_ORIGIN` | `https://techastra.drmgrdu.ac.in` |
| `TRUST_PROXY` | `1` |
| `HACKNEXUS_EMBEDDED` | `1`. This runs Hack Nexus inside this app, and its settings are the `HN_` variables below. |
| `HN_DATABASE_URL` | the Supabase **session pooler** URL (port 5432) |
| `HN_DB_SCHEMA` / `HN_DB_SSL` / `HN_DB_POOL_MAX` | `hacknexus` / `1` / `5` |
| `HN_APP_ORIGIN` | `https://techastra.drmgrdu.ac.in` |
| `HN_REGISTRATION_FEE` / `HN_UPI_ID` / `HN_UPI_PAYEE_NAME` | `1000` / `7010826253-2@ybl` / `THIRUVENKATAM V` (confirm with the organisers) |
| `HN_SMTP_HOST` / `HN_SMTP_PORT` / `HN_SMTP_USER` / `HN_SMTP_PASS` / `HN_MAIL_FROM` / `HN_MAIL_REPLY_TO` | the Gmail values from `hacknexus/.env` on the development laptop (never commit them) |
| `MAIL_TRANSPORT` | `sendmail` |
| `MAIL_FROM` | `no-reply@techastra.drmgrdu.ac.in` |
| `MAIL_REPLY_TO` | `techastra@drmgrdu.ac.in` |

- **Build and set up (SSH).** Plesk's own Node: use the path Plesk shows, e.g. `/opt/plesk/node/22/bin`, or tick "run with this Node" in the panel.
```bash
cd ~/techweb/server
npm ci                     # includes the prisma CLI (a dev dependency) needed below
# migrations need the session pooler (port 5432); everything else uses the app's URL
DATABASE_URL='<Supabase session URL, port 5432>' npx prisma migrate deploy
npx prisma generate
export DATABASE_URL='<Supabase transaction URL, port 6543, ?pgbouncer=true&connection_limit=5&sslmode=require>'
NODE_ENV=production npm run seed        # events and combos (no demo data)
# staff logins: first upload server/staff-credentials.csv from the laptop (SFTP / Plesk
# File Manager) into ~/techweb/server/ so everyone keeps the same password, then:
npm run staff:setup
npm run recount:seats -- --confirm
cd ../client
npm ci
npm run build          # uses client/.env.production (same-domain API, site URL)
```
- In Plesk, click **NPM install** (if you didn't run it above), then **Restart App**.

### 2.4 Hack Nexus (inside the Techastra app)
Hack Nexus has no Plesk site of its own. The Techastra app loads it from `techweb/hacknexus` and serves it at `/hacknexus/`.
- **Settings:** it reads **only** the `HN_` variables in §2.3 (`HN_DATABASE_URL` → its `DATABASE_URL`, and so on). It never sees Techastra's own `DATABASE_URL` or other settings, and a `hacknexus/.env` file isn't read.
- **Build and set up (SSH):**
```bash
cd ~/techweb/hacknexus
npm ci
BASE_PATH=/hacknexus npm run build                       # don't run npm test after this: it rebuilds without the prefix
export DATABASE_URL='<Supabase session URL, port 5432>' DB_SCHEMA=hacknexus DB_SSL=1
npm run db:migrate                                       # creates the hacknexus schema and its tables
npm run admin:create -- <organiser-username>             # prompts for a 12+ character password
```
- **Lock both apps' tables away from Supabase's public API** (after both migrations): `cd ~/techweb/server && DATABASE_URL='<session URL>' npm run supabase:lockdown`. It should end with "no API access left". Run it again after any future migration.
- **Restart** the Techastra app. Its log shows "Hack Nexus is served at /hacknexus/"; if it fails to load, the log says why, the rest of the site keeps working, and `/hacknexus` shows "temporarily unavailable".
- **Separate app instead (optional):** Hack Nexus can still run as its own Node app (startup file `server/passenger.cjs`, the same settings without the `HN_` prefix plus `BASE_PATH=/hacknexus` and `TRUST_PROXY=1`). In that case set `HACKNEXUS_ORIGIN` to its address instead of `HACKNEXUS_EMBEDDED`. `HACKNEXUS_HOST` gives the site name when `HACKNEXUS_ORIGIN` is `http://127.0.0.1` on the same server.

### 2.5 Email (the server's own mail, no second site)
Techastra's emails (received, approved, rejected, cancelled, resubmitted) are handed to the server's `sendmail` program. That's exactly what PHP's `mail()` does, with the same headers, so there's no SMTP account, no paid service and no PHP site. The settings are in §2.3.
- **Check that sendmail works (SSH)**, sending to your own address:
```bash
ls -l /usr/sbin/sendmail
printf 'Subject: Techastra test\n\nIt works.\n' | /usr/sbin/sendmail -i -f no-reply@techastra.drmgrdu.ac.in you@example.com
```
  If it's somewhere else, set `MAIL_SENDMAIL_PATH`. If nothing arrives, check Plesk → Mail → the mail queue / log, and whether the plan limits outgoing mail.
- **Keep it out of spam:** Plesk → Websites & Domains → Mail Settings → turn on **DKIM** for `techastra.drmgrdu.ac.in`, and make sure the domain's DNS has the **SPF** and **DKIM** TXT records Plesk shows (DNS Settings). If the university IT runs the DNS, send them those records.
- **Alternative (PHP site):** `php-mailer/` still works on any PHP site: set `MAIL_ENDPOINT_URL` / `MAIL_ENDPOINT_SECRET` and leave `MAIL_TRANSPORT` unset (see `php-mailer/README.md`).

### 2.6 Check before announcing
- **Health checks:**
  - `https://techastra.drmgrdu.ac.in/api/health` returns `"db":"ok"`.
  - `https://techastra.drmgrdu.ac.in/hacknexus/api/health` returns `"status":"ok"`.
- **Techastra dry run:** register with your own email and a real ₹ payment to the UPI ID. You should get the "received" email. Approve it on the desk and you should get the "approved" email. Then sign in, download the ID card, and scan its QR with the Coordinator scanner on a phone.
- **Hack Nexus:** sign up, register a squad, and check the email arrives. Then open `/hacknexus/admin`.
- **Security headers:** securityheaders.com gives an A.
- **Backups:** add a daily `pg_dump` of both databases as a Plesk scheduled task.

**Unused alternative:** `render.yaml` and `client/vercel.json` are for the old Render + Vercel plan. They're kept for reference and not used on Plesk.

### Hack Nexus on this laptop

1. **Database:** run `npm run db:local` in `hacknexus/`.
2. **Server:** from PowerShell, run `node --env-file-if-exists=.env server/index.js` with these set:
   - `BASE_PATH=/hacknexus`
   - `SERVE_CLIENT=1`
   - `APP_ORIGIN=http://localhost:5173`
   - `PORT=3001`
   - `DATABASE_URL` from `.local/postgres.json`

   (In Git Bash, `/hacknexus` gets rewritten to a Windows path.)
3. **Browsing:** the Techastra dev server (:5173) forwards `/hacknexus` to it (`client/vite.config.js`).

## 3. After the event

Within 90 days (the Privacy Notice promises by 7 January 2027):

```
cd server && npm run purge:personal-data            # dry run
cd server && npm run purge:personal-data -- --confirm
```

## 4. Standards

- **Accessibility, WCAG 2.2 AA:** axe-core audit of every public page, form error state and staff portal: 0 violations.
  - Skip link, focus management, page titles, inline errors, 24px targets, 4.5:1 text contrast.
  - 320px reflow, and a pausable motion setting.
- **Security, OWASP Top 10 / ASVS:**
  - server-side validation of every registration field, with amounts computed on the server;
  - atomic seat reservation (no overselling), and each UPI transaction ID usable only once;
  - payment screenshots private to the registration desk, and password hashes stripped from every API response;
  - bcrypt passwords, rate limits sized for shared campus Wi-Fi;
  - CSP, HSTS, `nosniff`, `frame-ancestors 'none'`, a CORS allow-list, generic 5xx errors, and no dev logging in production;
  - `.well-known/security.txt` (RFC 9116).
- **Privacy, India's DPDP Act 2023:**
  - Privacy Notice and Terms pages;
  - explicit consent recorded per registration (`consentAt`), with parent or guardian consent for Junior Techastra (under 18);
  - data minimisation, and no tracking or analytics cookies;
  - a retention and erasure script.
- **Web standards and SEO:**
  - valid HTML with `lang="en-IN"`, canonical and Open Graph tags;
  - schema.org `Event` JSON-LD, `robots.txt` and `sitemap.xml`;
  - a `<noscript>` fallback and a 1200×630 social image.
- **Performance:**
  - route-level code splitting (main JS ≈ 250 KB);
  - event icons as 256px WebP (18.9 MB → 138 KB), with 101 MB of unused media removed;
  - immutable caching for hashed assets.
- **Operations:**
  - health check with a DB ping, and graceful shutdown on SIGTERM;
  - versioned Prisma migrations, JSON request logs without query strings, and a production-safe seed.

## 5. Tests

- `cd server && npm test`: validation unit tests.
- End-to-end, accessibility and CSP checks were run with headless Chrome during hardening.
