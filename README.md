# LoadSprint — Dispatch & Carrier Platform

LoadSprint is a SaaS for freight **dispatchers and carriers**. A dispatcher invites
drivers, creates loads (with AI reading the broker's rate confirmation), tracks the
truck live, exchanges documents/photos/chat with the driver, generates carrier
invoices, and shares a read-only tracking portal with the broker.

Built with **Next.js 15** (App Router), **TypeScript**, **React 19**, **Tailwind CSS**,
**Leaflet** maps, **Stripe** billing, **Resend** email, **HERE** truck routing, and the
**Anthropic API** for rate-con reading and invoice generation.

- **Live site:** https://loadsprint.us.com (backup: `loadsprint-production.up.railway.app`)
- **Hosting:** Railway (Nixpacks). It is a standard Next.js app and can run on any
  Node host.
- A separate **native driver app** (Expo / React Native, iPhone + iPad) talks to this
  same backend; the site is also installable as a PWA.

> **Plain-language guides (Russian):** if you are not a developer, start with
> **[GUIDE-dispatcher-RU.md](./GUIDE-dispatcher-RU.md)** (how to use LoadSprint as a
> dispatcher, step by step) and **[GUIDE-owner-RU.md](./GUIDE-owner-RU.md)** (how to
> deploy, update, and manage it). The rest of this README is the technical reference.

---

## Roles

- **Dispatcher** — the main user. Invites drivers, creates and tracks loads, handles
  documents and invoices.
  - **Owner dispatcher** — the one who pays the subscription. Can invite extra
    dispatchers (team seats), set each one's commission %, and remove them.
  - **Sub-dispatcher** — invited by an owner; works under the owner's subscription.
- **Driver** — uses the mobile app or the PWA. Sees only loads assigned to their
  email, updates status, uploads POD photos, chats. A driver can now be connected to
  **several dispatchers** at once (each dispatcher invites their email; the driver
  enters the join code with their existing password to link).
- **Broker** *(no login)* — opens a share link, enters a one-time code, and watches
  status, location and selected documents.
- **Admin** — back-office account for granting plans, editing prices, and special
  tools.

---

## Quick start (local development)

You need **Node.js 18.18+**.

```bash
npm install
npm run dev          # http://localhost:3000
```

Production build:

```bash
npm run build
npm run start        # serves the production build (PORT defaults to 8080)
```

> Note: do **not** add a `babel.config.js` — it breaks the Next.js build. The project
> uses the default SWC compiler.

---

## Environment variables

Copy `.env.example` to `.env.local` (local) or set these in Railway (production).

| Variable | Required | What it does |
|---|---|---|
| `AUTH_SECRET` | Yes | Signs the session cookie. Use a long random string. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Yes | Bootstrap admin, created on first login. |
| `STRIPE_SECRET_KEY` | For billing | Stripe secret key (`sk_live_…` / `sk_test_…`). |
| `STRIPE_WEBHOOK_SECRET` | For billing | `whsec_…` from the Stripe webhook endpoint. |
| `RESEND_API_KEY` | For email | Resend API key for sending invite emails. |
| `EMAIL_FROM` | For email | Sender, e.g. `LoadSprint <invites@loadsprint.us.com>`. |
| `HERE_API_KEY` | For routing | HERE REST key for truck-legal routes, distance, ETA. |
| `ANTHROPIC_API_KEY` | For AI | Reads rate confirmations and builds carrier invoices. |
| `DATA_DIR` | Optional | Folder for the JSON data files (defaults to `./data`). |
| `TWOFA_ENABLED` | Optional | `true` turns on email 2-factor login. Off by default. |
| `SEED_DEMO` | Optional | `false` disables the auto-created demo accounts. |
| `DRIVER_APP_URL` / `NEXT_PUBLIC_DRIVER_APP_URL` | Optional | Base URL used in driver invite links. |
| `NEXT_PUBLIC_SITE_URL` | Optional | Public site URL used in some links. |

Billing, email, routing and AI each degrade gracefully if their key is missing
(the related feature simply turns off), so the app still runs without them.

---

## How it works

### Drivers (dispatcher → driver)
The dispatcher adds a driver by email and gets a one-time **join code** (and an app
link). The driver enters that code in the app/PWA to register — or, if they already
have an account, to **connect to this dispatcher** as well. The dispatcher's "Drivers"
screen shows each driver, how many loads they have, and a seat counter for their plan.

### Loads & the load workspace (`/loads/[id]`)
Creating a load is a 3-step wizard: **upload the rate confirmation → the AI detects
every pickup and drop-off, the rate and the bill-to → verify → confirm**. The PDF is
saved to the load automatically.

The load workspace includes:
- **Live location** — Leaflet map, coordinates and last-updated time. HERE provides
  the remaining truck-legal distance and ETA. A privacy hold can freeze the marker at
  the truck's real parked point, and an internal marker (dispatcher/driver only) is
  never sent to the broker.
- **Documents** — Rate Con, BOL, POD, attachments, and invoices.
- **Cargo photos** — grouped by phase (before pickup / in transit / at delivery).
- **Load chat** — dispatcher ↔ driver ↔ broker, with files, timestamps, read receipts.
- **Status** — Assigned → Picked Up → In Transit → At Delivery → Delivered → Closed.
  Only the **assigned driver** can mark a load **Delivered**, and only with a
  proof-of-delivery photo. **Closing** a load can be done directly by the owner,
  dispatcher or driver.
- **Notifications** — a bell polls for new photos, documents, status changes and chat.

### AI carrier invoice
On a finished load the dispatcher taps "Generate invoice with AI". The invoice is
built from the load data, rendered to a clean PDF, and **saved to the load
automatically**, so it is included when the dispatcher sends final documents to the
broker.

### Broker portal (`/b/<token>`)
From a load, the dispatcher creates a share link plus an access code. The broker opens
the link, **enters the code once** (it is remembered on their device), and sees live
status, location (OpenStreetMap), the rate confirmation, and any photos the dispatcher
ticked as visible. After the dispatcher hits **Send final documents**, the broker also
sees the invoice and the rest of the paperwork. The internal driver-pay invoice is
never shown to the broker.

### Teams & commissions (owner dispatcher)
The owner invites extra dispatchers on **/team** (seat limits by plan), sets each one's
commission %, and can remove them. Sub-dispatchers work under the owner's subscription.
Each dispatcher sees their own earnings (commission × delivered/closed loads).

### Billing (Stripe)
`/billing` offers monthly subscriptions and one-month one-time purchases:

| Plan | Monthly | One month | Drivers |
|---|---|---|---|
| Silver | $19/mo | $25 | 2 |
| Gold | $59/mo | $90 | 8 |
| Platinum | $199/mo | $300 | 30 |

Extra drivers beyond the plan are billed separately. Payment runs through Stripe
Checkout; on return the app confirms the session and grants the plan + expiry
immediately (the webhook handles monthly renewals).

---

## Data storage

User, load, invite and settings data live as **JSON files** under `DATA_DIR`
(`data/` by default): `users.json`, `loads.json`, `invites.json`, `notifications.json`,
`settings.json`. This is simple and works out of the box. On hosts that wipe the disk
between deploys, the demo accounts and 2FA setup are made self-healing/idempotent.
For larger scale, swap these file helpers for a real database.

---

## Admin panel (`/admin`)

Sign in with the admin account (from `ADMIN_*`). From there the admin can manage every
account, **grant a plan** (set days; `0` = no expiry), **edit the public prices**, and
grant the per-account **location-freeze** tool.

Demo accounts (created automatically unless `SEED_DEMO=false`):
- Driver: `demo.driver@loadsprint.us.com`
- Dispatcher: `demo.dispatch@loadsprint.us.com`

---

## Mobile driver app & PWA

- **Native app:** a separate Expo / React Native project (folder `loadsprint-driver`)
  builds the iPhone/iPad app via EAS and points at this backend. See that project's
  own instructions.
- **PWA:** the website is installable on a phone (Add to Home Screen on iPhone, Install
  prompt on Android). PWA pieces: `app/manifest.ts`, `public/sw.js`,
  `components/pwa-register.tsx`, and the icons in `public/`.

---

## Project structure (high level)

```
loadsprint/
├─ app/
│  ├─ layout.tsx, page.tsx, globals.css   # shell, landing, design system
│  ├─ login, register, dashboard          # auth + role landing
│  ├─ drivers, drivers/[email]            # dispatcher: drivers + a driver's loads
│  ├─ loads, loads/[id]                   # load list + full load workspace
│  ├─ team                                # owner: dispatcher seats + commissions
│  ├─ billing, pricing                    # Stripe plans
│  ├─ invoice-settings                    # carrier company details for invoices
│  ├─ review, history                     # completed loads / activity
│  ├─ b/[token]                           # public broker portal
│  ├─ admin/…                             # admin panel
│  └─ api/…                               # all server routes (loads, driver, billing, b, ai, …)
├─ components/                            # UI: create-load, load-workspace, cabinet, etc.
├─ lib/                                   # auth, loads, billing, stripe, email, here, ai-*, invites, …
└─ public/                               # icons, splash, logo
```

## Deploy

Push to the repo connected to Railway; it builds with Nixpacks and runs `npm run start`.
Set the environment variables above in the Railway dashboard. The app is a standard
Next.js project, so any Node host (Vercel, etc.) works too.
