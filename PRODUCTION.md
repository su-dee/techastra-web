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
| Emails (PHP `mail()`, no SMTP) | The mailer subdomain in section 2.5, then set `MAIL_ENDPOINT_URL` and `MAIL_ENDPOINT_SECRET` |

## 2. Deploy on Plesk (techastra.drmgrdu.ac.in)

**Layout: three sites on the Plesk plan, and the database on Supabase.** Plesk needs no PostgreSQL. Both apps use one Supabase project (hosted PostgreSQL): Techastra's tables are in the `public` schema and Hack Nexus's in a `hacknexus` schema.

| Site | What runs there | Why separate |
|---|---|---|
| `techastra.drmgrdu.ac.in` | **Node app** `techweb/server`. It serves the website (`client/dist`) and the API, and forwards `/hacknexus` to Hack Nexus. | The main site |
| `hn.techastra.drmgrdu.ac.in` | **Node app** `techweb/hacknexus`, the Hack Nexus app. Visitors use it at `techastra.drmgrdu.ac.in/hacknexus/`. | Plesk runs one Node app per (sub)domain |
| `mailer.techastra.drmgrdu.ac.in` | **PHP site** with `php-mailer/` (Techastra's emails via PHP `mail()`) | A Node-enabled domain doesn't run PHP. There, `config.php` (with its secret) would be served as plain text. |

The subdomains need DNS records pointing at the Plesk server. If the university IT manages `drmgrdu.ac.in` DNS, ask them for `techastra`, `hn.techastra` and `mailer.techastra`. Turn on **Let's Encrypt SSL** for all three. The QR camera scanners need https.

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
| `HACKNEXUS_ORIGIN` | `https://hn.techastra.drmgrdu.ac.in` |
| `HACKNEXUS_HOST` | only while `hn.techastra.drmgrdu.ac.in` has no public DNS record: set `HACKNEXUS_ORIGIN` to `http://127.0.0.1` and this to `hn.techastra.drmgrdu.ac.in`. The request then goes to the Hack Nexus site on the same server. In Plesk, turn off the HTTPS redirect for the `hn.` subdomain (Hosting Settings) so this plain-http request isn't redirected. |
| `MAIL_ENDPOINT_URL` | `https://mailer.techastra.drmgrdu.ac.in/send.php` |
| `MAIL_ENDPOINT_SECRET` | the same secret as in the mailer's `config.php` (below) |

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

### 2.4 Hack Nexus app (`hn.techastra.drmgrdu.ac.in` → Node.js)
- **Plesk → Node.js:**
  - Node **22.12 or newer**.
  - Application root: `techweb/hacknexus`.
  - Document root: `techweb/hacknexus/public`.
  - Startup file: `server/passenger.cjs`.
- **Environment variables:**

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the Supabase **session pooler** URL (port 5432) with `?sslmode=require` |
| `DB_SCHEMA` / `DB_SSL` / `DB_POOL_MAX` | `hacknexus` / `1` / `5` |
| `APP_ORIGIN` | `https://techastra.drmgrdu.ac.in` (the MAIN domain, which the browser uses) |
| `BASE_PATH` | `/hacknexus` |
| `TRUST_PROXY` | `1` |
| `REGISTRATION_FEE` / `UPI_ID` / `UPI_PAYEE_NAME` | `1000` / `7010826253-2@ybl` / `THIRUVENKATAM V` (confirm with the organisers) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` / `MAIL_REPLY_TO` | the Gmail values from `hacknexus/.env` on the development laptop (never commit them) |

- **Build and set up (SSH):**
```bash
cd ~/techweb/hacknexus
npm ci
BASE_PATH=/hacknexus npm run build
export DATABASE_URL='<Supabase session URL, port 5432>' DB_SCHEMA=hacknexus DB_SSL=1
npm run db:migrate                                       # creates the hacknexus schema and its tables
npm run admin:create -- <organiser-username>             # prompts for a 12+ character password
```
- **Lock both apps' tables away from Supabase's public API** (after both migrations): `cd ~/techweb/server && DATABASE_URL='<session URL>' npm run supabase:lockdown`. It should end with "no API access left". Run it again after any future migration.
- Click **Restart App**.

### 2.4b Hack Nexus without its own subdomain (use this if `hn.` can't be created)
The main app can run Hack Nexus itself, as a background process on `127.0.0.1:3001`. It restarts it if it stops and forwards `/hacknexus` to it. There's no second Plesk site and no `hn.` DNS.
- **Main site → Node.js → environment variables:**
  - add `HACKNEXUS_START` = `1`;
  - remove `HACKNEXUS_ORIGIN` and `HACKNEXUS_HOST`.
- **Hack Nexus's settings.** Give it the §2.4 values in one of two ways:
  - **In the Plesk panel:** add them to the main site's variables with an `HN_` prefix:
    - `HN_DATABASE_URL` (the Supabase **session** URL, port 5432);
    - `HN_DB_SCHEMA`=`hacknexus`, `HN_DB_SSL`=`1`, `HN_DB_POOL_MAX`=`5`;
    - `HN_APP_ORIGIN`=`https://techastra.drmgrdu.ac.in`;
    - `HN_REGISTRATION_FEE`, `HN_UPI_ID`, `HN_UPI_PAYEE_NAME`;
    - `HN_SMTP_HOST`, `HN_SMTP_PORT`, `HN_SMTP_USER`, `HN_SMTP_PASS`, `HN_MAIL_FROM`, `HN_MAIL_REPLY_TO`.
  - **Or in a file:** create `~/techweb/hacknexus/.env` with the same names without the prefix.
  - Hack Nexus never sees the main app's own variables. `BASE_PATH` and `TRUST_PROXY` are set automatically.
- **Build and create the organiser login (SSH):** `cd ~/techweb/hacknexus && npm ci && BASE_PATH=/hacknexus npm run build`. Then run `admin:create` as in §2.4, with `DATABASE_URL`, `DB_SCHEMA` and `DB_SSL` exported.
- **Restart the main app.** Its log shows lines starting `[hacknexus]`. Check `https://techastra.drmgrdu.ac.in/hacknexus/api/health`.

### 2.5 Mailer (`mailer.techastra.drmgrdu.ac.in` → PHP)
- **Upload the files.** Upload the contents of `php-mailer/` to this subdomain's `httpdocs/`, so the mailer is at `https://mailer.techastra.drmgrdu.ac.in/send.php`.
- **Create `config.php`** from `config.sample.php`:
  - `SECRET`: the same value as `MAIL_ENDPOINT_SECRET`.
  - `FROM`: `no-reply@techastra.drmgrdu.ac.in`.
  - `REPLY_TO`: `techastra@drmgrdu.ac.in`.
  - `DRY_RUN`: `false`.
- **Mail settings:** turn on DKIM for the domain and add the SPF record Plesk suggests (details in `php-mailer/README.md`).

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
