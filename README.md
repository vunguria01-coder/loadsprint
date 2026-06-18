# LoadSprint — Freight Brokerage & Logistics Platform

Production-ready freight brokerage website built with **Next.js 15**, **TypeScript**,
**Tailwind CSS**, **Framer Motion**, **Lucide**, and **React Hook Form + Zod**.

Tagline: *Moving Freight Faster.*

---

## Quick start (easiest)

You need **Node.js 18.18 or newer** installed first: https://nodejs.org

- **Windows:** double-click **`start.bat`**
- **macOS / Linux:** in a terminal, run:
  ```bash
  chmod +x start.sh   # first time only
  ./start.sh
  ```

The script installs dependencies on the first run, starts the dev server, and
opens **http://localhost:3000** in your browser.

## Manual start

```bash
npm install
npm run dev        # http://localhost:3000
```

## Build for production

```bash
npm run build
npm run start      # serves the production build
```

---

## Project structure

```
loadsprint/
├─ app/
│  ├─ layout.tsx              # SEO metadata, fonts, JSON-LD schema, ToastProvider
│  ├─ page.tsx                # assembles all sections
│  ├─ globals.css             # design system (brand tokens + component styles)
│  └─ api/
│     ├─ quote/route.ts       # POST /api/quote   (validated with Zod)
│     ├─ carrier/route.ts     # POST /api/carrier
│     └─ contact/route.ts     # POST /api/contact
├─ components/                # one file per section + shared helpers
│  ├─ nav, hero, stats, services, why-choose, how-it-works
│  ├─ audience, quote-form, about, testimonials, carrier-form
│  ├─ faq, contact, footer
│  ├─ reveal.tsx              # scroll-reveal wrapper (Framer Motion)
│  ├─ counter.tsx            # animated stat counters
│  └─ toast.tsx              # toast notifications (context + provider)
├─ lib/schemas.ts            # Zod schemas shared by forms and API routes
├─ public/loadsprint-logo.png
└─ tailwind.config.ts / tsconfig.json / next.config.mjs
```

## Forms & backend

The three lead forms (quote, carrier, contact) validate on the client with Zod and
POST to their matching API route, which re-validates server-side and currently
just logs the payload (`console.log`). To wire up real delivery, edit the
`// TODO` line in each file under `app/api/*/route.ts` — send an email, push to
a CRM, or store in a database.

## Accounts (broker / dispatcher)

The site includes registration and sign-in for two roles — **Broker** and
**Dispatcher**. Driver accounts are intentionally left out; they will live in a
separate mobile app.

- Pages: `/register`, `/login`, and a protected `/dashboard`.
- API: `app/api/register`, `app/api/login`, `app/api/logout`.
- Logic: `lib/auth.ts` — passwords are hashed with Node's built-in `crypto`
  (scrypt + random salt), and sessions are signed HTTP-only cookies.
- Storage: users are saved to a local `data/users.json` file so it works out of
  the box on your machine. **This file storage is for local development only** —
  for production, replace the store functions in `lib/auth.ts` with a real
  database (Postgres, etc.). Set a strong `AUTH_SECRET` (see `.env.example`).

## Admin panel `/admin`

Sign in with the admin account to reach the panel. The admin is created
automatically on first login from `.env` (defaults below — change them):

```
Email:    admin@loadsprint.com
Password: admin12345
```

From the panel the admin can:

- **Manage accounts** — see every account and its role.
- **Grant subscriptions** — set any account's plan to Silver, Gold, Premium, or Free.
- **Edit prices anytime** — the three tier prices, currency, and billing label;
  changes apply instantly on the public `/pricing` page (stored in `data/settings.json`).
- **Grant the restricted "location freeze" tool** — a per-account toggle. When
  granted, that single account sees a hidden control on their dashboard to hold a
  driver's reported location in place. Accounts without the grant never see it.

## Subscriptions & self-serve checkout

`/pricing` shows the three plans (Silver / Gold / Premium) at the admin-set
prices. Signed-in users can subscribe themselves; the current plan is highlighted.
**Payment is simulated** — wire up Stripe Checkout in `app/api/subscribe/route.ts`
before going live.

## Driver invites (dispatcher)

On a dispatcher's dashboard, the **Add a driver** box takes a driver email and
generates a one-time join code plus an app link. The link is meant to be emailed
to the driver; opening it in the future driver app pre-fills the code so they can
register. The web side (code generation, `app/api/driver-invite`, and
`lib/invites.ts` with `verifyCode` for the app to call) is ready; email delivery
and the mobile app connect later. Set `DRIVER_APP_URL` to the real app URL.

## Loads (tracking, documents, photos, chat, status)

`/loads` lists loads; dispatchers see them grouped by driver (open a driver →
open a load). `/loads/[id]` is the full workspace:

- **Live location** — map (Leaflet, loaded from CDN, so the browser needs
  internet), coordinates, and last-updated time. The demo advances the trailer
  along its route to simulate live GPS; a real device/ELD feed replaces this.
- **Privacy hold** (granted accounts only) — pauses broadcasting and holds the
  marker at the trailer's *real* parked point. The broker sees an honest
  "Parked" status with the real last-fix time — never a fabricated live ping.
- **Internal marker** (dispatcher/driver only) — a private working location you
  can place/drag freely. It is stripped from any broker API response on the
  server, so it is never shared with the broker.
- **Documents** — Rate Con, BOL, POD, attachments; open inside the app.
- **Cargo photos** — gallery by phase (before pickup / in transit / at delivery).
- **Load chat** — dispatcher ↔ driver ↔ broker, scoped to the load, with files,
  PDFs, photos, timestamps, and read receipts.
- **Status** — Assigned → Picked Up → In Transit → At Delivery → Delivered →
  Closed; changes appear instantly for the broker.
- **Notifications** — the bell polls for new photos, documents, status changes,
  messages, and deliveries.

## Driver PWA (install from the website, no App Store)

Drivers can use the site as an installable app on their phone — no App Store
needed:

- The driver entry point is **`/driver`** (register with the dispatcher's invite
  code, or sign in). After that they land on `/loads` and `/loads/[id]` with the
  same tracking, files, photo upload, status, chat, and POD flow.
- On **iPhone**: open the site in Safari → Share → **Add to Home Screen**. It
  installs an icon and opens full-screen like an app.
- On **Android**: Chrome shows an **Install app** prompt automatically.
- Taking photos works through the upload buttons (the phone offers the camera).
- PWA pieces: `app/manifest.ts` (served at `/manifest.webmanifest`),
  `public/sw.js` (service worker), `components/pwa-register.tsx`, and the icons
  in `public/` (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`).

To install on a phone you must serve the site over **HTTPS** (e.g. deploy to
Vercel). On `localhost` during development the PWA works in the browser but the
"Add to Home Screen" install needs HTTPS or `localhost` (Safari allows it on the
same machine; phones on your LAN need HTTPS).

A separate native iOS app (Expo) also exists for later App Store / TestFlight
distribution; the PWA shares the same backend, so you can switch when you grow.

## Customizing

- **Brand colors / fonts:** `tailwind.config.ts` and the `:root` block in `app/globals.css`.
- **Logo:** replace `public/loadsprint-logo.png`.
- **Contact details / map:** `components/contact.tsx` (the map uses a keyless
  Google Maps embed pointed at Atlanta, GA — change the `q=` value to your address).
- **Copy & section content:** the data arrays at the top of each component.

## Deploy

Deploys to **Vercel** with zero config — push the repo and import it, or run
`npx vercel`.
