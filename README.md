# TechAstra — National Symposium Portal

A multi-role event management platform for a national-level college
symposium: registration, UPI payment verification, digital ID cards with QR
codes, event check-in, food distribution tracking, live results, and digital
certificates.

> **Scope note:** this repository is the **Registration Portal sub-app
> only** — it is opened via a "Register" link from a separate main
> marketing site (homepage, event storytelling, public Leaderboard/Gallery
> all live there instead). See [`DESIGN_BRIEF.md`](./DESIGN_BRIEF.md) for
> the full page list, the split-screen Events mega-menu spec, and the
> contrast/transition quality bar this app is held to.

## Tech Stack

- **Frontend:** React (Vite) + TailwindCSS + shadcn/ui-style components, React Router
- **Backend:** Node.js + Express (REST API)
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** JWT + bcrypt, role-gated routes
- **QR codes:** `qrcode` (generation), `html5-qrcode` (camera scanning)
- **PDFs:** `pdf-lib` (certificates, server-side), `jspdf` + `html2canvas` (ID card, client-side)
- **Real-time:** Socket.io (announcements, live leaderboard), falls back to polling
- **Uploads:** Multer (payment screenshots) stored under `server/uploads/`
- **Charts:** Recharts
- **Email:** Nodemailer (Gmail SMTP) — logs to console instead of sending if unconfigured

## Repository Layout

```
techweb/
├── server/                 Express API + Prisma schema
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   ├── routes/              one file per resource (auth, events, registrations, ...)
│   ├── middleware/          auth.js (JWT + role guard), upload.js (Multer)
│   ├── utils/                qr.js, codes.js, mailer.js, csv.js, certificatePdf.js
│   ├── index.js
│   └── .env.example
├── client/                  React + Vite frontend
│   ├── src/
│   │   ├── pages/            public pages + role portals
│   │   ├── components/       shared UI (Button, Card, Badge, Modal, QRScanner, ...)
│   │   ├── context/          AuthContext, CartContext
│   │   └── lib/              api.js (fetch wrapper), socket.js
│   └── .env.example
├── SEED_CREDENTIALS.md      full list of seeded logins (all demo/staff accounts)
└── README.md
```

## Prerequisites

- Node.js 18+ and npm
- A PostgreSQL database (Replit's built-in Postgres/Neon integration works well)

## Setup

### 1. Backend

```bash
cd server
npm install
cp .env.example .env
# edit .env: set DATABASE_URL, JWT_SECRET, UPI_PAYEE_ID, UPI_PAYEE_NAME, etc.

npx prisma migrate dev --name init   # creates tables
npm run seed                         # populates demo events, colleges, staff logins,
                                      # sample registrations/results/certificates
npm run dev                          # starts the API on http://localhost:4000
```

### 2. Frontend

```bash
cd client
npm install
cp .env.example .env
# edit .env: set VITE_API_URL (default http://localhost:4000)

npm run dev                          # starts Vite dev server on http://localhost:5173
```

Open `http://localhost:5173` in your browser.

## Environment Variables

See `server/.env.example` and `client/.env.example` for the full list. Key ones:

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | server | Postgres connection string |
| `JWT_SECRET` | server | Signs auth tokens — use a long random string |
| `UPI_PAYEE_ID` / `UPI_PAYEE_NAME` | server | Used to build the UPI deep-link QR on Checkout |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | server | Optional — leave blank to log emails to console instead of sending |
| `CLIENT_ORIGIN` | server | CORS + Socket.io allowed origin (your frontend URL) |
| `VITE_API_URL` | client | Base URL the frontend calls for the API |

## Seeded Logins

Every role (master admin, registration team, coordinators, hospitality,
certificate team, volunteers) has a demo login. **Full list, including
sample participant accounts, is in [`SEED_CREDENTIALS.md`](./SEED_CREDENTIALS.md).**

All seeded accounts share the password `TechAstra@2026` — change this before
any real deployment.

## Events

The seed script loads 27 events: 16 **Senior** (college students) from
`Techastra '26 List.docx` and 11 **Junior** (school students) from
`JUNIOR TECHASTRA EVENTS LIST.docx`. Each event has a `level`
(`senior` | `junior`); one registration can't mix levels.

**Senior Technical:** Pen Your Vision, Hack Nexus, Crypt Clash, Trial of Truth,
Code Rescue, Pixel Protocol, Forensic Alibi, Prompt Arena

**Senior Non-Technical:** Rhythm Riot, Hidden Frames, Verbal Combat, Blitz Hunt,
Plot Twist, Team Feud, Cap Chaos, Clash Squad E-Sports

**Junior Technical:** Byte Rush, Prompt Wars, Vision Forge, Cipher Quest, TRACE//X

**Junior Non-Technical:** Mind Merge, Whatzit?, Actventure, Seekret, Huntify,
Stack N' Dash

Names, descriptions, rules, coordinators (with phone numbers for senior
technical events), junior team sizes and the senior non-technical
days/venues are real, matching the main site. **Times, fees, seat counts,
senior team sizes, and the dates of senior technical and all junior events
are not confirmed yet** — they are working values in `server/prisma/eventData.js`.
Update them there, or edit events in the Master Admin Portal's Events tab,
once the organisers finalise them.

## End-to-End Flow (manual test checklist)

1. Visit `/events`, add 1-2 non-clashing events to the cart.
2. Fill out `/register` (individual or team), proceed to `/checkout`.
3. Scan/note the UPI QR, enter a transaction ID, submit → registration is `pending`.
4. Log in as a Registration Team account, approve the registration.
5. Log in as the participant → view the digital ID card on `/dashboard`, download as PDF.
6. Log in as the event's Coordinator → scan the participant's QR to check them in.
7. Coordinator selects 1st/2nd/3rd place winners → results lock immediately.
8. Confirm the result appears on the public `/leaderboard` in real time.
9. Log in as Certificate Team → generate a certificate for the participant.
10. Visit `/verify-certificate`, enter the certificate code → confirm it validates.

## Razorpay Payment Integration

This app integrates Razorpay for automated online payment verification and supports cash registrations for walk-up participants.

### Setup Instructions

1. **Install Razorpay SDK:**
   ```bash
   cd server
   npm install razorpay
   ```

2. **Get Razorpay API Keys:**
   - Sign up at [Razorpay Dashboard](https://dashboard.razorpay.com/)
   - Navigate to Settings → API Keys
   - Generate Test/Live mode keys

3. **Configure Environment Variables:**
   Add to `server/.env`:
   ```
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxx
   ```

   **Security Note:** Never commit real keys to version control. The `KEY_SECRET` must remain server-side only.

4. **Update Frontend Environment:**
   The frontend automatically fetches the Key ID via the `/api/payment/config` endpoint. No client-side environment variable needed.

### Payment Flows

#### Online Payment (Razorpay)
1. User adds events to cart → proceeds to checkout
2. Frontend creates registration record (status: `pending`)
3. Backend creates Razorpay order via `/api/payment/create-order`
4. Razorpay checkout modal opens for payment
5. On success, frontend submits payment details to `/api/payment/verify`
6. Backend verifies signature using HMAC SHA256 with `KEY_SECRET`
7. Auto-approves registration on successful verification
8. ID card/QR generated immediately

#### Cash Registration (Registration Team)
1. Registration Team member uses "Walk-up Cash Registration" form
2. Fills participant details, selected events, amount collected
3. Submits form → creates registration with `paymentMethod: "cash"`
4. Auto-approves immediately (cash verified in-person)
5. ID card displays on screen for participant to photograph

### Testing

Use Razorpay Test Mode credentials:
- Test Card: `4111 1111 1111 1111`
- CVV: Any 3 digits
- Expiry: Any future date
- Name: Any name

### Installation Issue Note

If `npm install razorpay` fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` certificate error, try:
```bash
npm config set strict-ssl false
npm install razorpay
npm config set strict-ssl true
```

Or download via your organization's proxy/mirror if applicable.

## Known Limitations / Next Steps

- File uploads (payment screenshots, ID photos) are stored on local disk
  under `server/uploads/` — fine for a prototype/single-instance deployment,
  but won't persist across ephemeral container restarts on some hosts.
- Offline-tolerant QR scanning (queueing scans while offline) is not yet
  implemented — the scanner components currently require connectivity.
- Bulk CSV registration upload, coupon codes, and the big-screen leaderboard
  display mode are listed as nice-to-haves and are not yet built.
- Email sending requires real SMTP credentials in `.env`; without them the
  server logs the email content to the console instead (safe default for
  local development).
- **Razorpay package installation:** The `razorpay` npm package must be installed manually before deployment (`npm install razorpay` in `server/`). Payment routes will return 503 until this package is available.
