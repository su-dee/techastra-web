# Going live: Techastra '26

Deployment runbook and the standards this project is built to. The API runs on Render (`render.yaml`); the portal (`client/`) and the main site (`../techastra-web`) run on Vercel (`vercel.json` in each).

## 1. Before launch: information only the organisers have

| What | Where |
|---|---|
| UPI QR and ID that receive fees (currently `subalakshmime-1@okaxis`) | `client/src/assets/upi-qr.png` + `UPI_ID` in `client/src/lib/site.js` |
| Privacy / grievance contact email | `client/src/lib/site.js` (`LEGAL.contactEmail`), both `vite.config.js` (`SECURITY_CONTACT`) |
| Approved refund policy | `client/src/pages/Legal.jsx` (Terms), then set `LEGAL.refundPolicyConfirmed = true` |
| Final fees, times, seats, venues, team sizes | `server/prisma/eventData.js`, then re-run the seed |
| Staff password for seeding | Render env `STAFF_PASSWORD` (12+ chars); each person changes it after first sign-in |
| SMTP account for emails | Render env `SMTP_*`, `MAIL_FROM` |

## 2. Deploy

**API (Render):** New → Blueprint → this repo. Set the `sync: false` variables. The build runs `prisma migrate deploy`.
- The database was first created with `db push`? Then run once in the Render shell: `npx prisma migrate resolve --applied 0_init`.
- Seed: `NODE_ENV=production STAFF_PASSWORD=… npm run seed`. Demo participants are skipped in production.
- The server **refuses to start** with a missing or weak `JWT_SECRET` or no `CLIENT_ORIGIN`.

**Portal (Vercel, root `client/`):**
- `VITE_API_URL` = the Render URL.
- `VITE_SITE_URL` = the portal URL.
- If the API URL isn't `https://techastra-api.onrender.com`, update `connect-src` / `img-src` in `client/vercel.json`.

**Main site (Vercel, root `techastra-web/`):** set `VITE_SITE_URL` and `VITE_PORTAL_URL`.

**After deploy:** add the portal URL to the API's `CLIENT_ORIGIN`, then check:
- `/api/health` returns `db: ok`;
- a ₹1 test registration goes end to end;
- securityheaders.com gives an A;
- Google's Rich Results Test sees the main site's Event.

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
