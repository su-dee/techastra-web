# Going live: Techastra '26

Deployment runbook and the standards this project is built to. Everything runs on the Plesk hosting at techastra.drmgrdu.ac.in (section 2).

## 1. Before launch: information only the organisers have

| What | Where |
|---|---|
| UPI QR and ID that receive fees (currently `subalakshmime-1@okaxis`) | `client/src/assets/upi-qr.png` + `UPI_ID` in `client/src/lib/site.js` |
| Privacy / grievance contact email | `client/src/lib/site.js` (`LEGAL.contactEmail`), both `vite.config.js` (`SECURITY_CONTACT`) |
| Approved refund policy | `client/src/pages/Legal.jsx` (Terms), then set `LEGAL.refundPolicyConfirmed = true` |
| Final fees, times, seats, venues, team sizes | `server/prisma/eventData.js`, then re-run the seed |
| Staff password for seeding | Plesk env `STAFF_PASSWORD` (12+ chars); each person changes it after first sign-in |
| Emails (PHP `mail()`, no SMTP) | The mailer subdomain in section 2.5, then set `MAIL_ENDPOINT_URL` and `MAIL_ENDPOINT_SECRET` |

## 2. Deploy on Plesk (techastra.drmgrdu.ac.in)

**Layout: three sites on the Plesk plan.** One PostgreSQL server holds two databases.

| Site | What runs there | Why separate |
|---|---|---|
| `techastra.drmgrdu.ac.in` | **Node app** `techweb/server`. It serves the website (`client/dist`) and the API, and forwards `/hacknexus` to Hack Nexus. | The main site |
| `hn.techastra.drmgrdu.ac.in` | **Node app** `techweb/hacknexus`, the Hack Nexus app. Visitors use it at `techastra.drmgrdu.ac.in/hacknexus/`. | Plesk runs one Node app per (sub)domain |
| `mailer.techastra.drmgrdu.ac.in` | **PHP site** with `php-mailer/` (Techastra's emails via PHP `mail()`) | A Node-enabled domain doesn't run PHP. There, `config.php` (with its secret) would be served as plain text. |

The subdomains need DNS records pointing at the Plesk server. If the university IT manages `drmgrdu.ac.in` DNS, ask them for `techastra`, `hn.techastra` and `mailer.techastra`. Turn on **Let's Encrypt SSL** for all three. The QR camera scanners need https.

### 2.1 Databases (Plesk → Databases → Add database, type PostgreSQL)
- Create two databases, `techastra` and `hacknexus`, each with its own user.
- Note both connection strings: `postgresql://USER:PASSWORD@HOST:5432/techastra` and `postgresql://USER:PASSWORD@HOST:5432/hacknexus`.

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
| `DATABASE_URL` | the `techastra` connection string |
| `JWT_SECRET` | 48+ random characters: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| `CLIENT_ORIGIN` | `https://techastra.drmgrdu.ac.in` |
| `TRUST_PROXY` | `1` |
| `HACKNEXUS_ORIGIN` | `https://hn.techastra.drmgrdu.ac.in` |
| `MAIL_ENDPOINT_URL` | `https://mailer.techastra.drmgrdu.ac.in/send.php` |
| `MAIL_ENDPOINT_SECRET` | the same secret as in the mailer's `config.php` (below) |
| `STAFF_PASSWORD` | 12+ characters. Only used by the seed; each staff member changes it after first sign-in. |

- **Build and set up (SSH).** Plesk's own Node: use the path Plesk shows, e.g. `/opt/plesk/node/22/bin`, or tick "run with this Node" in the panel.
```bash
cd ~/techweb/server
npm ci                     # includes the prisma CLI (a dev dependency) needed below
export DATABASE_URL='postgresql://…/techastra'
npx prisma migrate deploy
npx prisma generate
NODE_ENV=production STAFF_PASSWORD='…' npm run seed      # events, combos, staff accounts
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
| `DATABASE_URL` | the `hacknexus` connection string |
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
export DATABASE_URL='postgresql://…/hacknexus'
npm run db:migrate
npm run admin:create -- <organiser-username>             # prompts for a 12+ character password
```
- Click **Restart App**.

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
