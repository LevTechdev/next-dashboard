# Release notes — v1.1.0 → v1.3.0

Draft for the three tags semantic-release cut on `main`. Paste into GitHub
Releases (or the marketing changelog) as-is, or trim per audience.

---

## v1.1.0 — Release engineering and CI stabilization

*Merged via #4–#9 · 2026-09-23*

### 🚀 Release pipeline

- **semantic-release unblocked** — runs on Node 22 with its plugins declared,
  so tags ship themselves again (#8, #9)
- Deployment migration procedure recorded for out-of-band database changes

### 🧪 CI stability

- **Route warming in globalSetup** — every route the suite hits is compiled
  before the first timed test, and CI runs one worker so cold compiles stop
  racing the clock (#6)
- **Deterministic Postgres provisioning** — the CI gate waits on `pg_isready`
  instead of a blind TCP probe (#5)
- **The flaky trio defused** — shared-session tests spread across per-IP
  windows, the mutation-status assertion stops racing its toast, and the E2E
  timeout budget doubled on CI runners
- **Pinned suite count** — the E2E count gate updated as specs landed
  (209 → 232)

### 📦 Product surface in this window

- **Nightly FX snapshot cron** — one rate row per pair per day, with the
  capture endpoint requiring the cron secret
- **Pricing currency selector** — defaults from the visitor's locale
- Broader test coverage: audit-chain hashing, CSV export, WebAuthn RP
  plumbing, FX history, and the payment adapters
- Prettier applied across the whole `src/` tree; the v2.7.0 marketing
  changelog entry with meaningful icons

---

## v1.2.0 — Mail you can trust, sessions that behave, and a health panel that tells the truth

*Merged via #10–#11 · 2026-09-25*

### 📬 Mail delivery

- **The durable outbox** — transactional mail is queued as a database row
  _before_ any transport is touched; delivery runs off the response path with
  exponential backoff, so a slow SMTP handshake can no longer be killed by a
  function timeout with the message lost
- **"Sent" vs "queued" is now honest** — routes distinguish a transport
  acceptance from a durable enqueue, and the UI warns on
  `mailMisconfigured` instead of promising an inbox message
- **The sandbox-sender trap closed** — `onboarding@resend.dev` only ever
  delivers to the account owner; the mailer rescues such a send to SMTP and
  logs the fix instead of silently failing
- **No-mailer OTP issuance leaves a trace** — a terminal outbox row the
  mail-health panel can show, so "no mailer" stopped being invisible

### 🩺 Admin observability

- **Mail-delivery health panel** — resolved transport, sender sanity, queue
  depth (pending / sending / sent / failed / stuck), recent failures with
  reasons, and a one-click resend that re-arms the newest failed row
- **Audit-health panel** — per-tenant event attribution (missing tenant,
  dead tenant, rows outside the chain) alongside the outbox view

### 🔐 Sessions & policy

- **Device-aware session policy** — trusted devices and installed PWAs get
  the long-lived window; the stay-logged-in grant stopped living and dying in
  localStorage
- **Refresh families die whole** — revoking a device kills its refresh-token
  family, not just the single row
- **Tenant coercion fixed** — a missing tenant is no longer written as a
  defined `null`; attribution resolves from the actor instead of silently
  vanishing

### 💱 Billing correctness

- Revenue aggregates report the orders' own denomination, and an invoice
  stopped re-denominating a rupiah order as dollars
- **Plan changes ship** — billing-period handling and the gates around them
  (#11)
- Full six-platform affiliate catalog in the seed

### 🎨 UX polish

- The route-loading indicator adopts the lighter Slide treatment

---

## v1.3.0 — The security surface, completed and proven

*Merged via #12–#13 · 2026-09-26*

### 👤 Profile security surface

- **Trusted devices and recovery readiness join the profile** — the full
  second-factor picture (TOTP, passkeys, backup codes, trusted devices,
  30-day readiness sparkline) is visible and manageable from one page
- **The leaf-sync verify step accounts for rows it must refuse to copy** —
  the incremental mirror top-up reports what it skipped and why

### 🧾 Naming the unsyncable

- **The leaf-sync orphan report** — local rows the Supabase mirror can never
  take (FK targets that exist only in dev data) are counted and _named_ with
  sample fingerprints in the Settings scheduler card
- **The acknowledged-ref ledger** — reconciliation is acknowledge-only by
  design (SecurityEvent is hash-chained, so orphans are never rewritten):
  `node scripts/ack-leaf-orphans.mjs '<ref>'` retires reviewed refs from
  every projected view, and `--unack` is trivially correct because the raw
  report always shines back through
- **E2E pins the surface** — the profile security panel and the no-mailer
  OTP trace are covered by the growing suite (pin moved to 242)

*(Shipped next, outside this tag: the same signal promoted to the admin
panel with a first-class endpoint, an in-panel "Acknowledge all", and the
daily ops digest — see `feat/ops-signal-and-proxy`.)*
