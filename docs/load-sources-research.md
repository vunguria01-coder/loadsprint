# Load sources research — official APIs only

Research for the "search available loads near a driver" feature. Scope is
strictly **official, ToS-compliant sources**: a vendor's own published
developer/partner API, reached through its own application process. No
scraping, no unofficial/reverse-engineered APIs, no account creation, and
no integration work yet — this document only records what each vendor
actually offers and how to legitimately apply for it.

Every "unclear" or "not publicly disclosed" below is a real finding, not a
gap to fill in later with guesswork: it means the answer only exists behind
a signed agreement or a sales conversation, and LoadSprint must get that
answer directly from the vendor before writing a single line of
integration code against that source.

## Summary

| Platform | Official load-search API | May LoadSprint show results to its own dispatcher users? | Apply via |
|---|---|---|---|
| DAT | Yes — DAT Load Board API | Not stated publicly; plausible via the vetted Solutions/Software Integration Partner track | developer.dat.com, dat.com/company/partner |
| 123Loadboard | Yes — "Search loads" endpoint | Best public signal of the four (LoadBoard Network is explicitly built for third-party display) — but still vetted/approved case by case | 123loadboard.com/about/partners/become-a-partner |
| Truckstop | Yes — Load Search API | **No, not under standard terms** — ToS explicitly forbids redistribution; only possible under a custom-negotiated Systems Integration Agreement | tsi@truckstop.com |
| Uber Freight | Partial — carrier-facing search exists, but it's Uber Freight's own proprietary (Powerloop) network, not a general load aggregator | No public evidence this is offered to third-party SaaS at all | developer.uberfreight.com/get-started (enterprise-gated) |

**None of the four** publish a self-serve, clearly-priced API with explicit
third-party resale rights. All four require direct outreach, vetting, or a
signed agreement before LoadSprint could legally surface their data to its
own users. Truckstop's standard terms are the one case where the answer is
an explicit **no** absent a special agreement — treat that as a hard
blocker, not a "TBD."

## DAT Freight & Analytics (dat.com)

- **Load-search access:** Yes — the DAT API family (developer.dat.com)
  includes the DAT Load Board API, Freight Posting API, DAT BookNow API,
  DAT Tracking API, and rate/analytics APIs.
- **MC/DOT requirements:** DAT verifies a valid MC number, Federal ID
  number, or agent agreement, plus an active DAT subscription, before
  granting access. A narrow exception for vetted independent dispatchers
  without their own MC is referenced in DAT support content — treat as a
  special case, not the default.
- **Sandbox/trial & price:** Developer portal registration is free. No
  public price sheet; secondary sources mention a one-time setup fee in
  the ~$500–$1,000 range plus metered/per-call charges on top of a DAT One
  subscription, but this is unconfirmed — get a quote from
  developersupport@dat.com before assuming a number.
- **Authorization:** Developer-portal login with API keys / "service
  accounts" — credentialed, not open self-serve OAuth.
- **Limits:** Not publicly documented.
- **Right to show results to LoadSprint's users:** Not clarified in public
  docs. DAT runs two distinct programs — an Affiliate Program (marketing
  referrals only, not data) and a Solutions/Software Integration Partner
  track (existing TMS integrations are listed on dat.com), which implies
  third-party embedding is possible but gated behind a signed agreement.
- **Apply:** developer.dat.com/_/login · developersupport@dat.com ·
  dat.com/company/partner (integration-partner track).

## 123Loadboard (123loadboard.com)

- **Load-search access:** Yes — documented REST API with a "Search loads"
  endpoint (filter by equipment type, origin, etc.), plus load/truck
  posting, rates, messaging, and bidding endpoints. Docs:
  123loadboard.com/api/.
- **MC/DOT requirements:** Not spelled out on the public API page.
  Standard 123Loadboard membership targets carriers/brokers/dispatchers
  with the usual FMCSA-authority expectations, but there's no explicit
  MC/DOT gate documented for the API itself — confirm directly with their
  integrations team.
- **Sandbox/trial & price:** No public sandbox. Board subscription plans
  (~$39–$79/mo) are for the load board product, not API access — API
  pricing requires direct contact with partner-integrations@123loadboard.com.
  A signed "API usage agreement" is referenced, implying credentialed,
  agreement-gated access rather than open keys.
- **Authorization:** Not publicly documented; gated behind the usage
  agreement above.
- **Limits:** Not publicly documented.
- **Right to show results to LoadSprint's users:** Strongest public signal
  of the four — 123Loadboard operates a vetted integration-partner model
  and separately promotes a "LoadBoard Network" explicitly built to let
  participating third parties display loads across the network via web
  services. Still requires vetting/approval by 123Loadboard management,
  not self-serve.
- **Apply:** 123loadboard.com/about/partners/become-a-partner (contact
  form) · partner-integrations@123loadboard.com.

## Truckstop.com

- **Load-search access:** Yes — developer.truckstop.com and
  marketplace.truckstop.com list Load Search, Load Post, Truck Search,
  Truck Post, and Rate Analysis as integration categories.
- **MC/DOT requirements:** Explicit in Truckstop's Terms & Conditions —
  broker/carrier customers must maintain active FMCSA authority with
  appropriate insurance and MC/DOT registration (intrastate carriers need
  valid state authority + state insurance instead). Non-compliance can
  mean suspension without refund.
- **Sandbox/trial & price:** No public sandbox found. API access requires
  the "Load Board Pro" tier (third-party pricing roundups suggest roughly
  $79–$99.95/mo, not an official per-API price page), and Truckstop notes
  "additional costs and requirements may apply" for API integration,
  decided per account manager.
- **Authorization:** REST APIs use account credentials with access/refresh
  tokens; SOAP APIs use a web-service username/password (partners) or an
  Integration ID (clients).
- **Limits:** Not disclosed in reachable public docs.
- **Right to show results to LoadSprint's users — explicit NO by default:**
  Truckstop's public Terms & Conditions forbid redistributing, framing,
  transmitting, sharing, or broadcasting any part of the Services, and
  forbid renting/leasing/selling/sublicensing any element of the Services
  to a third party; API/content use is limited to "your internal use ...
  for your sole benefit" unless a separate agreement exists. **Every API
  integration requires a signed Systems Integration Agreement (SIA)**
  before credentials are issued — that SIA is the only path by which
  LoadSprint could legally show Truckstop loads to its own dispatcher
  users.
- **Apply:** tsi@truckstop.com (Integrations Team) to negotiate an SIA ·
  marketplace.truckstop.com/t/api-integrations to see existing
  integrations first.

## Uber Freight (uberfreight.com)

- **Load-search access:** Partial, and different in kind from the other
  three. developer.uberfreight.com exposes a Loads/Quote & Tender API
  (shipper/broker-facing pricing and tendering), a Scheduling API (dock
  appointments), and a Real-Time Tracking API. Separately, carriers search
  and book loads through the Uber Freight Carrier App/Web Portal/API —
  but that's Uber Freight's own proprietary network (leaning on Powerloop
  power-only capacity), not a general marketplace aggregating third-party
  shippers' postings the way DAT/Truckstop/123Loadboard are.
- **MC/DOT requirements:** Not published for API access specifically;
  carrier signup implies standard FMCSA authority + insurance onboarding,
  consistent with industry norms.
- **Sandbox/trial & price:** A sandbox exists (sandboxportal.uberfreight.com,
  "Real-Time Pricing and Tendering APIs"). Pricing isn't public — the
  developer portal states Uber Freight staff must approve and provision
  any account, i.e. enterprise/contact-sales gated, not self-serve.
- **Authorization:** Not fully documented publicly; portal requires
  registration plus Uber Freight approval before endpoint reference access
  is even visible.
- **Limits:** Not publicly disclosed.
- **Right to show results to LoadSprint's users:** No public evidence of a
  partner program for embedding Uber Freight's carrier-facing load search
  into a third-party SaaS/TMS for that SaaS's own end users. All public
  material frames integration as Uber Freight connecting *into* enterprise
  shippers' TMS/ERP systems (Oracle, SAP, Blue Yonder, NetSuite) for
  quoting/tendering — i.e. Uber Freight acting as the broker connecting to
  a shipper's system, not a reseller arrangement for a dispatch SaaS.
  Treat as unconfirmed/likely unavailable for LoadSprint's use case
  without a direct enterprise sales conversation.
- **Apply:** developer.uberfreight.com/get-started (portal signup,
  approval-gated) · uberfreight.com/en-US/technology/integrations
  ("Tell us about your solution" partner inquiry form).

## What this means for LoadSprint

- Nothing here is ready to integrate. Every source needs a real
  conversation with the vendor — at minimum to get pricing and confirm
  redistribution rights in writing — before any API key touches this
  codebase.
- 123Loadboard is the most promising starting point: it has the clearest
  public language supporting third-party display of results, alongside an
  actual "Search loads" endpoint.
- Truckstop is excluded by default: its standard terms explicitly forbid
  what LoadSprint would need to do, and only a custom Systems Integration
  Agreement changes that.
- DAT is plausible but ambiguous — the Solutions/Software Integration
  Partner track needs a direct conversation to confirm reseller rights and
  real pricing.
- Uber Freight is the weakest fit for "search loads near a driver" as
  LoadSprint means it — its API surface is built for shippers/brokers
  integrating Uber Freight as a broker, not for a dispatch SaaS reselling
  a load board.

### Sources

- https://www.dat.com/resources/api-integration
- https://www.dat.com/company/partner
- https://one.support.dat.com/9-troubleshooting-2734b01a/service-accounts-and-restful-api-faq-7c689bc5
- https://one.support.dat.com/9-troubleshooting-2734b01a/transportation-management-system-tms-bded76fa/accessing-the-api-dat-developer-portal-1ca53173
- https://www.dat.com/solutions/mc-authority
- https://www.dat.com/resources/mc-authority-101
- https://www.123loadboard.com/api/
- https://www.123loadboard.com/about/partners/become-a-partner/
- https://www.123loadboard.com/press-releases/freight-matching-platform-123loadboard-endorses-loadboard-network/
- https://www.123loadboard.com/pricing/
- https://marketplace.truckstop.com/t/api-integrations
- https://truckstop.com/product/integrations/
- https://developer.truckstop.com/reference/general-overview
- https://developer.truckstop.com/reference/overview-1
- https://truckstop.com/terms-conditions/
- https://truckstop.com/product/load-board/pricing/
- https://www.uberfreight.com/en-US/technology/integrations
- https://developer.uberfreight.com/get-started
- https://developer.uberfreight.com/apis
- https://sandboxportal.uberfreight.com/docs/uf-real-time-pricing-and-tendering-apis/1/overview
- https://help.uber.com/en/freight/carrier/article/using-the-uber-freight-app-to-search-and-book-loads
- https://www.uberfreight.com/en-US/blog/uber-freight-releases-pilot-for-scheduling-api
