# 123Loadboard partner integration request — DRAFT, DO NOT SEND

**Status: draft only.** Nothing in this file has been sent to 123Loadboard.
Send only after the owner explicitly approves the final text — see
[[load-sources-research.md]] for why 123Loadboard was picked as the first
candidate (clearest public language supporting third-party display of
results, plus a documented "Search loads" endpoint).

Fields marked `[TODO — owner to provide, do not guess]` are placeholders.
MC number, DOT number, and any other business/registration detail must come
from the account owner directly — nothing here invents or infers one.

---

## Where this goes

Contact form: 123loadboard.com/about/partners/become-a-partner
Email: partner-integrations@123loadboard.com

## Draft message

Subject: API partner inquiry — LoadSprint (dispatch SaaS), Search Loads API

Hello,

My name is `[TODO — owner to provide, do not guess]` and I run LoadSprint
(loadsprint.us.com), a freight-dispatch SaaS for owner-operators and small
carrier fleets. Dispatchers use LoadSprint to manage drivers, trucks, active
loads, invoicing, and driver-facing load tracking for their own company —
it is not a public load board and never shows one dispatcher's data to
another's.

**The scenario we want to support:** a dispatcher, signed into LoadSprint,
opens the profile card for one of their own drivers and searches for loads
near that driver's current location, filtered by the equipment/trailer
length/rate preferences they've already configured for that driver. Results
would only ever be shown to that one dispatcher, for their own roster — no
cross-account sharing, no public-facing search, no anonymous access.

We'd like to evaluate 123Loadboard's Search Loads API for this. Specifically
we're asking about:

1. **Sandbox / trial access** — is a sandbox environment available for
   evaluation before a production agreement is signed?
2. **Search Loads API** — scope of the endpoint (filters supported: origin,
   destination, equipment type, radius, date range, rate) and current API
   documentation.
3. **Pricing** — API access cost separate from a standard board membership;
   whether it's flat-fee, per-call/metered, or tiered by account volume.
4. **Rate limits** — calls per minute/day, and whether limits scale with
   plan tier.
5. **Authorization method** — API key, OAuth, service account, or another
   credentialed flow; whether credentials are per-integration or
   per-end-user.
6. **Written permission to display results to our authorized users** — we
   understand from your public materials that 123Loadboard supports
   third-party display via the LoadBoard Network, but we want this
   confirmed in writing and scoped explicitly to LoadSprint's use case
   (results shown only to the authenticated dispatcher who owns the
   search, never public, never shared across accounts) before we write any
   integration code.

We also have three follow-up questions we'd like answered either in this
same reply or once we're further along:

- **Caching:** what's the maximum time we're permitted to cache a search
  result before we must re-query or discard it?
- **Broker contact storage:** may we store the broker name/contact info
  returned with a load result in our own database for the duration a
  dispatcher is actively working that load, or must it only be displayed
  live from your API each time?
- **Deep-linking:** is linking a dispatcher back to the original load
  listing on 123Loadboard (rather than only showing our own summary of it)
  the expected/required pattern, and is there a specific URL format we
  should use for that link?

Company/account details for reference:
- Company legal name: `[TODO — owner to provide, do not guess]`
- MC number: `[TODO — owner to provide, do not guess]`
- DOT number: `[TODO — owner to provide, do not guess]`
- Existing 123Loadboard account (if any): `[TODO — owner to provide, do not guess]`
- Contact email for this inquiry: `[TODO — owner to provide; support@loadsprint.us.com is the general support address, not necessarily who should field a partner reply]`

Thank you — happy to hop on a call if that's easier than email.

`[TODO — signature / owner name]`

---

## Before this can actually be sent

- [ ] Owner fills in every `[TODO]` field above (do not guess or invent
      any of them).
- [ ] Owner reads and explicitly approves the final wording.
- [ ] Confirm the current contact path is still
      123loadboard.com/about/partners/become-a-partner /
      partner-integrations@123loadboard.com (public info can go stale).
