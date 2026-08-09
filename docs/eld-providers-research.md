# ELD/telematics providers research — official APIs only

Research for the future "driver HOS on the driver card" feature (see the
Drivers/HOS baseline audit). Scope is strictly **official, ToS-compliant
sources** — each vendor's own published developer program, reached through
its own registration process. No scraping, no reverse-engineered access, and
**no registration, API key, or network call was made against any of these
providers while writing this document** — every claim below is read from
public documentation pages, terms of service, and help-center articles.

Anything marked "unconfirmed" means the public docs describe a capability,
but nobody has actually exercised it against a real (even sandboxed)
account — that confirmation only happens once someone registers, which is
explicitly out of scope for this document.

## Summary

| Provider | Auth model | Self-serve sandbox/demo | HOS clocks (drive/shift/cycle) | Redistribution to LoadSprint's own users | Path to real test access |
|---|---|---|---|---|---|
| Samsara | OAuth2, org-scoped tokens, granular scopes | Yes — dedicated sandbox orgs with simulated vehicles/drivers | Yes — dedicated "Get HOS clocks" endpoint | Requires the carrier's (Samsara customer's) consent; no resale/disclosure to others without it | Self-serve developer sign-up appears sufficient to reach a sandbox |
| Motive | OAuth 2.0, read/write scopes per resource | Not documented publicly — ambiguous | Yes — HOS log endpoints (`hours_of_service`, `available_time`, violations) | Redistribution to third parties explicitly prohibited; developer must obtain its own authorizations | Developer portal exists; sandbox status unconfirmed |
| Geotab (MyGeotab) | Database + scoped user credentials (JSON-RPC), not OAuth | Yes — free "demo database" (10–50 simulated vehicles) at my.geotab.com | Present via SDK, exact clock granularity not confirmed from docs alone | Not explicitly addressed for third-party display; would need direct confirmation | Demo database registration is self-serve |
| Verizon Connect (Reveal) | Partner/customer-gated REST + webhooks | Sandbox exists, but only *after* a real Reveal customer requests and grants credentials via a Data Access Consent Form | Yes — Logbook/HOS status data | Gated at the source: no customer, no credentials, no data at all | Blocked without a live Reveal customer sponsoring the integration; API is also Ultimate-tier-only |

**None of the four** can be treated as "ready" today. Samsara looks the
most self-serve-friendly on paper (a real developer account plus a
simulated-data sandbox, no live carrier required just to start
evaluating). Verizon Connect is the most blocked — its API is gated behind
both a paying Reveal customer's explicit consent *and* the highest
("Ultimate") pricing tier, so there's no way to even get test credentials
without an existing carrier relationship. Geotab and Motive sit in between:
both have a plausible self-serve path (Geotab's demo database; Motive's
open developer portal), but neither vendor's public docs spell out
redistribution rights to a third party's own end users as clearly as
Samsara's terms do.

## Samsara

- **Drivers/vehicles/HOS access:** Yes. Dedicated REST API with driver and
  vehicle management endpoints, plus a specific **Hours of Service Clocks**
  API returning current duty status, driving time remaining, shift time
  remaining, and time until required break — this is exactly the
  drive/shift/cycle-remaining shape the audit asked about. Daily HOS log
  endpoints exist separately for historical/summarized data.
- **Duty status & clocks:** Confirmed via the "Get HOS clocks" endpoint —
  returns current duty status and remaining-time fields per driver in one
  call.
- **Auth model:** OAuth2 with org-scoped access tokens (tokens can't be
  reused across tenants), or API keys with granular Scopes (Drivers,
  Vehicles, Compliance, Routes, Addresses, etc.) selected per token.
  Customers can revoke access from their own dashboard.
- **Sandbox/test account:** Yes — Samsara documents a sandbox environment
  with simulated data (3 vehicles running continuous GPS paths) explicitly
  meant for building and testing integrations without touching production
  fleet data. This is the only provider of the four where a sandbox is
  described as available without first needing a live paying customer.
- **Cost/rate limits:** Rate limits are public and documented per-endpoint
  — a general ceiling of 150 requests/second per API token, with some
  endpoints (e.g. route fetch) limited more tightly (25 req/s). No API-specific
  price list found; API access itself doesn't appear to require a separate
  paid tier the way Verizon Connect's does, but this needs direct
  confirmation once someone actually registers.
- **Polling vs. webhooks:** Both — Samsara documents webhooks for
  marketplace apps alongside standard polling endpoints.
- **Data retention / display to LoadSprint's users:** Samsara's terms
  require its own customer (the carrier) to have obtained all consents
  needed for Samsara to collect/use/share their data, and separately
  require integration partners not to sell, sublicense, or disclose
  Customer Data obtained via the API to any third party without express
  consent. Practically: LoadSprint could show a carrier's own HOS data
  back to that same carrier's dispatchers, but every such carrier would
  need to be a Samsara customer who's granted LoadSprint that access —
  this isn't a "connect once, see everyone's data" integration.
- **Separate driver/carrier consent required:** Yes, per the terms above —
  consent flows from the carrier (Samsara's customer) to Samsara, and
  Samsara's data only reaches LoadSprint through an authorized integration
  scoped to that carrier.
- **Apply:** developers.samsara.com (self-serve developer account signup).

## Motive (formerly KeepTruckin)

- **Drivers/vehicles/HOS access:** Yes. REST API covering driver/fleet
  manager management (`users` scope), vehicles, HOS logs, DVIR, IFTA,
  dashcam events, dispatch, and geofencing through one normalized API.
- **Duty status & clocks:** HOS is exposed through `hos_logs.hours_of_service`,
  `hos_logs.available_time`, and `hos_logs.hos_violation` scopes/endpoints —
  duty status and available/remaining time are present, though the docs
  don't break out a single "clocks" endpoint as cleanly as Samsara's.
- **Auth model:** OAuth 2.0 with scoped tokens; scopes are consistently
  split `.read` vs `.manage` (e.g. `users.read`/`users.manage`,
  `vehicles.read`/`vehicles.manage`), so read-only integrations are
  possible without write access.
- **Sandbox/test account:** Not documented publicly in any source found —
  developers are granted a license "to test, develop, implement, and
  operate" apps against the live API, but no dedicated sandbox/simulated-data
  environment is mentioned the way Samsara's or Geotab's is. Unconfirmed
  either way without contacting Motive directly.
- **Cost/rate limits:** No public per-call pricing — API access rides on a
  fleet management subscription (rough third-party estimates put that
  around $35/vehicle/month, unconfirmed). Rate limits are undocumented and
  described as being enforced at Motive's discretion, returned as a 429
  with a `Retry-After` header when hit.
- **Polling vs. webhooks:** Documentation found focuses on polling REST
  endpoints; no webhook capability confirmed in this pass.
- **Data retention / display to LoadSprint's users:** Motive's API Terms of
  Service explicitly forbid publishing, distributing, or selling any part
  of "User Data" to third parties, and forbid commingling User Data with
  other data in a way that prevents its deletion. The developer is
  separately responsible for obtaining "any authorizations necessary" for
  collecting/using/sharing that data — Motive doesn't spell out a specific
  consent-form mechanism the way Verizon Connect does, which likely means
  more of that burden falls on LoadSprint to design correctly.
- **Separate driver/carrier consent required:** Implied yes (the developer
  must obtain "authorizations"), but no explicit consent-form flow is
  documented publicly.
- **Apply:** developer.gomotive.com (self-serve developer portal, publishes
  apps to the Motive App Marketplace).

## Geotab (MyGeotab)

- **Drivers/vehicles/HOS access:** Yes. The MyGeotab API is JSON-RPC 2.0
  (not REST) covering vehicle location, trip history, driver behavior,
  fault codes, fuel, and HOS/ELD compliance records in one object model,
  with `GetFeed` for streaming and batch calls for bulk retrieval.
- **Duty status & clocks:** HOS/ELD compliance data is present via the SDK
  and sample applications specifically built for HOS tracking, but the
  public docs found in this pass don't confirm a single endpoint returning
  drive/shift/cycle-remaining the way Samsara's HOS Clocks API does —
  this needs a closer SDK-reference read before assuming parity.
- **Auth model:** Not OAuth — a MyGeotab **database** (effectively a
  tenant) plus a scoped user account with credentials and a data-access
  group; language-specific API clients (C#, JS, etc.) handle session
  authentication. Users can't see vehicles or HOS logs outside their
  assigned data-access group, which is Geotab's tenant-isolation model.
- **Sandbox/test account:** A real sandbox for the MyGeotab API itself
  isn't offered, but a **free demo database** (10–50 simulated vehicles,
  no cost) can be self-registered at my.geotab.com — a genuinely usable
  substitute for a sandbox. Separately, the MyAdmin API (account/database
  management, not vehicle data) has its own dedicated sandbox host.
- **Cost/rate limits:** No API-specific pricing or rate-limit numbers found
  in this pass — Geotab's guidance instead stresses designing around
  "permissions, data volume, recovery, and side effects" rather than a
  published ceiling.
- **Polling vs. webhooks:** `GetFeed` is a pull/poll-based incremental feed
  mechanism; no webhook capability found in this pass.
- **Data retention / display to LoadSprint's users:** Geotab's End User
  Agreement governs the *database owner's* (carrier's) use of the
  software; nothing found in this pass specifically addresses a
  third-party app's right to redistribute or display that carrier's HOS
  data to its own separate user base the way Samsara's or Motive's terms
  do. Geotab does describe aggregating and anonymizing data for its own
  product improvement, which is a different thing entirely. This is the
  least-clear provider of the four on exactly this question — would need
  a direct answer from Geotab, not just public docs.
- **Separate driver/carrier consent required:** Unconfirmed from public
  docs — likely yes in practice (any ELD data-sharing typically is), but
  no explicit third-party-app consent flow was found.
- **Apply:** my.geotab.com (free demo database registration);
  developers.geotab.com for SDK docs.

## Verizon Connect (Reveal)

- **Drivers/vehicles/HOS access:** Yes, in principle — Reveal's REST APIs
  and webhooks cover vehicles, drivers, GPS/trip history, driver status and
  safety, HOS logbooks, geofences, groups, and dash-cam events.
- **Duty status & clocks:** HOS/"Logbook" status data is listed among the
  available API objects, described as usable for verifying hours worked
  and compliance — exact clock-level granularity (drive/shift/cycle
  remaining specifically) wasn't confirmed from docs alone in this pass.
- **Auth model:** REST + webhooks, gated by Integration Manager and Reveal
  REST credentials — not a self-serve OAuth flow.
- **Sandbox/test account:** Exists, but only *after* onboarding — a
  developer registers on the portal, then a **Reveal customer** must go
  into the Reveal marketplace, name the integration, and explicitly check
  a box on a **Data Access Consent Form** authorizing that specific
  third-party developer to access their data. Only then are sandbox
  accounts and sample credentials issued. There is no way to get even test
  access without a live, consenting carrier customer already using Reveal.
- **Cost/rate limits:** No published rate limits found. More materially:
  third-party API access and analytics integrations are reported as gated
  to Reveal's highest ("Ultimate") pricing tier — a carrier on a lower
  plan couldn't authorize this integration even if they wanted to.
  Reveal's own list pricing runs roughly $35–$55/vehicle/month before
  hitting that tier gate.
- **Polling vs. webhooks:** Both — Verizon Connect documents both REST
  polling endpoints and webhook-based integrations.
- **Data retention / display to LoadSprint's users:** Structurally the
  cleanest of the four on paper, precisely because consent is required
  *before* any credentials are even issued — the Data Access Consent Form
  is the carrier explicitly authorizing "the third-party company and
  developer" to access their data, so there's no ambiguity about whether
  authorization exists. The cost is that this makes Verizon Connect
  unusable for LoadSprint to even evaluate without an existing Verizon
  Connect carrier customer willing to sponsor it.
- **Separate driver/carrier consent required:** Yes, explicitly and
  up-front — the Data Access Consent Form is a hard gate before any API
  access is granted at all.
- **Apply:** Reveal developer portal (registration open), but real
  credentials require a sponsoring Reveal customer via the Reveal
  marketplace.

## What this means for LoadSprint

- **No provider has confirmed test access today** — nothing here has been
  registered, keyed, or called; every line above is read from public
  documentation, which can be wrong, outdated, or incomplete. Per the
  brief, a specific "first provider" recommendation is only appropriate
  once test access is officially confirmed — that hasn't happened, so
  what follows is a prioritization for the *next* conversation, not a
  green light to integrate.
- **Samsara is the strongest candidate to start an actual vendor
  conversation with**, because its public docs describe the most
  self-serve path to real (if simulated) test data — a developer account
  and a documented sandbox, without needing a live carrier customer first
  — and because its HOS Clocks endpoint maps directly onto what the audit
  asked for (duty status, drive/shift remaining).
- **Verizon Connect is excluded as a starting point** — not because its
  terms are hostile, but because there is structurally no way to reach
  even a sandbox without an existing Reveal customer's consent and an
  Ultimate-tier subscription already in place. That's a business
  development problem, not an integration one.
- **Geotab and Motive are plausible second/third candidates** — both offer
  a real self-serve path to a test environment (Geotab's free demo
  database; Motive's open developer portal), but neither vendor's public
  redistribution/consent terms are as explicit as Samsara's, so either
  would need a direct written answer from the vendor before any
  integration work starts.

### Sources

- https://developer-docs.gomotive.com/docs/oauth-scopes
- https://developer-docs.gomotive.com/docs/oauth-20
- https://developer.gomotive.com/
- https://helpcenter.gomotive.com/hc/en-us/articles/6177868160413-What-is-Motive-Developer-API-Documentation
- https://gomotive.com/legal/api-terms-of-service/
- https://developers.samsara.com/docs/drivers-guide
- https://developers.samsara.com/docs/authentication
- https://developers.samsara.com/docs/rate-limits
- https://developers.samsara.com/docs/sandboxes
- https://developers.samsara.com/changelog/hours-of-service-clocks-api
- https://developers.samsara.com/docs/compliance-guide
- https://developers.samsara.com/docs/integration-partner-terms
- https://www.samsara.com/legal/platform-terms-of-service
- https://developers.geotab.com/myGeotab/introduction/index.html
- https://developers.geotab.com/myGeotab/guides/gettingStarted/
- https://support.geotab.com/mygeotab/doc/my-preview
- https://support.geotab.com/community/sdk-api/sdk-api-getting-started/1172/is-there-a-sandbox-environment-for-the-mygeotab-and-myadmin-environments-for-developers-interested-in-building-integrations-with-geotab-but-are-not-geotab-resellers
- https://support.geotab.com/compliance/hos
- https://careers.geotab.com/end-user-agreement/
- https://www.verizonconnect.com/services/api-integration/
- https://reveal-help.verizonconnect.com/hc/en-us/articles/10933751995539-Developer-portal-overview
- https://reveal-help.verizonconnect.com/hc/en-us/articles/5491815998099-Create-API-and-webhook-integrations
- https://fleet-help.verizonconnect.com/hc/en-us/articles/360010682240-API-Objects
- https://www.itqlick.com/verizon-connect-reveal/pricing
