# Dealer Order Management System — Technology Stack

**Project:** 2W Dealer Order Management (`2w_order_Proj`)
**Status:** Pre-development — stack definition for approval
**Date:** 22 July 2026
**Source of requirements:** `Dealer_Order_Workflow_Analysis_Report.docx` (44 steps, 6 modules, 4 teams)

---

## 1. Guiding Constraints

These drive every choice in this document.

| # | Constraint | Origin | Implication |
|---|---|---|---|
| C1 | **Mobile-first, majorly mobile usage** | Stated requirement | Phone is the primary target, not an afterthought. Desktop is the secondary view. |
| C2 | **Delivered as a web app** | Stated requirement | No app-store dependency. One deployable, installable to home screen. |
| C3 | **Dashboard-led, phase-wise rollout** | Stated requirement | Every role gets a dashboard shell first; features fill in per phase. |
| C4 | **Field usage on Indian mobile networks** | ASM works in the field | Small bundles, offline tolerance, retry-safe writes. |
| C5 | **Multi-role, segregated duties** | Flowchart lanes | RBAC is foundational, not bolted on. |
| C6 | **Financial + inventory data** | Modules 2–5 | Audit trail and concurrency control are mandatory. |
| C7 | **Self-hosted on VPS** | Stated requirement | Files on local disk; we own backups, TLS, monitoring, capacity. |
| C8 | **PDFs generated at runtime, never stored** | Stated requirement | Orders keep gaining fields; a stored PDF is stale on write. |
| C9 | **Prices and values, not just units** | Stated requirement | Pricing engine, per-item GST, PI generation are core scope. |
| C10 | **Admin controls all business rules** | Stated requirement | Rates, slabs, discounts, goods, dealers are data — not code. |

---

## 2. Roles

Derived from the flowchart lanes, reconciled against the roles named by the business.

| Role | Flowchart lane | Owns | Status |
|---|---|---|---|
| `ASM` | ASM_PROCESS (Modules 1–3) | Dealer/sub-dealer setup, order config, pricing, payment mode, order creation | Confirmed |
| `ADMIN` | — (cross-cutting) | Master data, users, roles, discount caps, SLA config, scheme setup | Confirmed |
| `PLANT_OPS` | PRODUCTION_TEAM (Module 4) | Stock, in-process, hold, dispatch quantity | Confirmed (= "Production Team") |
| `ACCOUNTS` | A/C_TEAM (Module 5) | Dummy invoice, cash discount, final invoice | Confirmed |
| `DISPATCH` | DISPATCH_TEAM (Module 6) | Box, dispatch date, transporter, docket number | **Added — see note** |
| `DEALER` | Order Review gate (Module 3) | Approve / decline own orders | **Added, dormant — see note** |

### Note on added roles

**`DISPATCH`** — Module 6 is a distinct lane in the flowchart with six of its own steps. It was not in the role list provided, so either Plant Ops absorbs it or it stands alone. The schema defines it as a separate role; a config flag lets one user hold both `PLANT_OPS` and `DISPATCH` if the business runs them as one desk. Costs nothing now, avoids a migration later.

**`DEALER`** — The report identifies "Order Review by Dealer/ASM" as the single highest-risk bottleneck in the workflow, because it depends on an external party responding to an emailed PDF with no SLA. The role is defined in the schema now but ships **dormant** (no login) in Phase 1. If the business later wants dealers to approve in-app, it activates without a data migration.

---

## 3. Stack Decision

### 3.1 Selected stack

| Layer | Choice | Version |
|---|---|---|
| Language | TypeScript | 5.x |
| Framework | Next.js (App Router) | 15.x |
| Runtime | Node.js | 22.x LTS *(22.12.0 verified on dev machine)* |
| UI | React | 19.x |
| Styling | Tailwind CSS | 4.x |
| Design system | **MIS Dashboard tokens** (see §5A) | — |
| Icons | **Lucide React** | 1.x |
| Components | shadcn/ui (Radix primitives) | latest |
| Database | PostgreSQL | 16.x |
| ORM | Prisma | 6.x |
| Auth | Auth.js (NextAuth) | 5.x |
| Validation | Zod (shared client + server) | 4.x |
| Server state | TanStack Query | 5.x |
| Forms | React Hook Form + Zod resolver | 7.x |
| File storage | **VPS local filesystem** (served via app, never static-public) | — |
| PDF / PI generation | **Runtime-only, streamed — never persisted** (React PDF / Puppeteer) | — |
| Money handling | `decimal.js` + Postgres `NUMERIC(14,2)` — **never floats** | — |
| Email | Resend or AWS SES | — |
| Background jobs | BullMQ + Redis *(or pg-boss, Postgres-only)* | — |
| Tests | Vitest + Playwright | — |
| Offline shell | PWA (`next-pwa` / Serwist) | Phase 2+ |

### 3.2 Why this stack, against the constraints

**Mobile-first (C1, C2, C4).** A responsive Next.js PWA installs to the home screen, works offline for read paths, and needs no app-store review cycle. Server Components keep the JavaScript shipped to a phone small — the single biggest lever on a field device over a patchy network. One codebase serves phone and desktop.

**Dashboard-led, phase-wise (C3).** Next.js App Router route groups map cleanly to per-role dashboards. Each role's dashboard is a route group that gets built out independently, phase by phase, without touching the others.

**Financial + inventory integrity (C6).** Postgres gives real transactions and row-level locking — non-negotiable for the inventory race conditions the report flags in Module 4. Prisma gives typed queries and versioned migrations for the audit trail.

**One language end to end.** TypeScript across client, server, and schema. Zod schemas are written once and enforced in both the browser and on the server, which directly addresses the report's Recommendation #3 (confirm cascading catalog filters are enforced server-side, not just in the UI).

### 3.3 Alternatives considered

| Option | Why not selected |
|---|---|
| **React Native / Flutter** | True native, but app-store release cycles slow the phase-wise rollout, and it needs a separate web build for back-office desktop work. Revisit only if camera/offline needs outgrow PWA. |
| **Django + React** | Django admin would give master-data CRUD nearly free. Rejected on two languages, two deploy targets, and a heavier mobile bundle. |
| **.NET + SQL Server** | Sound choice, but `dotnet` is not installed on the dev machine and there is no stated Microsoft-shop mandate. |
| **Laravel + Vue** | Common for ERP-style builds in India. Weaker end-to-end type safety across the client/server boundary. |

**Reversibility:** the Next.js API layer is consumed over HTTP, so if a native app is needed later, it reuses the same backend unchanged.

---

## 4. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Client — Next.js PWA (mobile-first, installable)        │
│  ASM · Admin · Plant Ops · Accounts · Dispatch dashboards│
└────────────────────────┬─────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼─────────────────────────────────┐
│  Next.js server — Server Components, Route Handlers      │
│  Auth.js (RBAC) · Zod validation · service layer         │
└──────┬──────────────┬──────────────┬─────────────────────┘
       │              │              │
┌──────▼─────┐ ┌──────▼──────┐ ┌─────▼──────────┐
│ PostgreSQL │ │ VPS disk    │ │ Job queue      │
│ orders,    │ │ artwork,    │ │ email,         │
│ inventory, │ │ receipts,   │ │ SLA timers,    │
│ prices,    │ │ uploaded    │ │ notifications  │
│ audit log  │ │ invoices    │ │                │
└────────────┘ └─────────────┘ └────────────────┘
                                                  
        ┌─────────────────────────────────┐    ┌───────────────────┐
        │ PDF / PI — generated at runtime │    │ Email / ERP (GST) │
        │ from live DB state, streamed to │    └───────────────────┘
        │ the user. NOT stored anywhere.  │
        └─────────────────────────────────┘
```

---

## 4A. Document Generation — Runtime Only

**Rule: no generated PDF is ever written to disk or stored in the database.**

Order PDFs and Proforma Invoices are rendered on demand from live database state and streamed to the response. The order record keeps evolving as fields are added through the workflow — a stored PDF would be a stale snapshot the moment the next team touches the order.

| Aspect | Approach |
|---|---|
| Trigger | User requests download/view; server renders on the fly |
| Source of truth | Live DB state at the moment of request |
| Persistence | **None.** Streamed to response, then discarded |
| What *is* stored | The underlying data + a `DocumentIssueLog` row (who generated what, when) |
| Reproducibility | Any past version is re-rendered from `OrderVersion` + audit history |
| Numbering | PI/invoice numbers are DB sequences, allocated once and stored — the *document* is transient, the *number* is not |

**Storage split — this distinction matters:**

| Artifact | Where | Why |
|---|---|---|
| Order PDF, Proforma Invoice | **Generated at runtime, not stored** | Reflects live state; changes as the order progresses |
| Dealer printing frame (artwork) | VPS disk | User-uploaded original |
| Payment receipt | VPS disk | User-uploaded proof; legal record |
| Dummy / final invoice (uploaded) | VPS disk | Uploaded by Accounts per Module 5 |

### VPS file storage

Uploads live on the VPS filesystem, not object storage.

- **Path layout:** `/var/app/uploads/{entity}/{yyyy}/{mm}/{uuid}.{ext}` — dated folders keep directories small
- **Access control:** files sit **outside** the web root. Every read goes through an authenticated route handler that checks RBAC — no direct public URLs
- **DB stores** the relative path, MIME type, size, checksum, and uploader; never the binary
- **Uploads:** size + MIME allowlist, image compression before write, checksum for integrity
- **Backups:** nightly `rsync` of the upload tree + `pg_dump`, retained off-VPS
- **Capacity:** disk-usage alerting from day one — a VPS filesystem is finite in a way object storage is not

> **Migration note:** all file access is wrapped in a single storage service interface. Swapping VPS disk for S3-compatible storage later is a one-adapter change, not a refactor.

---

## 4B. Pricing, Values & Proforma Invoice

The system tracks **money, not just units** — prices, discounts, taxes, and order values are first-class data.

### Calculation chain

```
Unit Price (from PriceList, per Part+Colour, date-effective)
  × Quantity
  = Gross Line Value
  − Dealer Discount        (capped; Admin-configured)
  − Scheme Discount        (Admin-configured; stacking rules enforced)
  = Net Line Value
  Σ lines
  = Order Value (before GST)
  + GST                    (per-item slab from Admin-managed GST master)
  = Total Order Value
  − Cash Discount          (Accounts stage; Admin-configured eligibility)
  = Final Payable
```

### Rules

1. **All money is `NUMERIC(14,2)` in Postgres and `decimal.js` in application code.** Floating-point arithmetic is prohibited for monetary values.
2. **Prices are date-effective.** `PriceList` rows carry `valid_from` / `valid_to`. An order captures the price *in effect at order time* — later price revisions never retroactively alter a placed order.
3. **Line-level price snapshots.** Each `OrderLine` stores the resolved unit price, discount, GST rate, and computed values. The order is reproducible years later even if masters change.
4. **GST is per-item.** The slab comes from the Admin-managed GST master on the part, not a single global rate.
5. **Rounding is applied once, at the line level**, then summed — never rounded twice.

### Proforma Invoice (PI)

The PI is issued from the ASM/order stage before the tax invoice, and is generated at runtime like all other documents.

- **Number** from a DB sequence (`PI/{FY}/{00001}`), allocated once and stored on the order
- **Content** rendered live: parties, line items with prices, discounts, per-item GST, totals, payment terms
- **Regeneration** always reflects current order state; the number stays stable
- **Every issuance** writes a `DocumentIssueLog` row for audit

---

## 5A. Design System

Tokens come from the **MIS Dashboard design system** (`Master Design Artifact.md`), shared with the existing Amato MIS product so the two read as one family.

### Tokens

| Token | Light | Dark |
|---|---|---|
| Background | `210 40% 98%` | `222 47% 11%` |
| Foreground | `222 47% 11%` | `210 40% 98%` |
| Primary | `217 91% 60%` (vibrant blue) | same |
| Primary glow | `217 91% 70%` | same |
| Card | `0 0% 100%` | `222 47% 15%` |
| Muted | `210 40% 96%` | `217 33% 18%` |
| Destructive | `0 84% 60%` | `0 63% 31%` |
| Border / Input | `214 32% 91%` | `217 33% 18%` |
| Ring (focus) | `217 91% 60%` | same |
| Radius | `0.75rem` base | — |

Brand accents: orange `#FF8A00`, yellow `#FFCC00`, app wrapper `#fff2e6`.

All tokens are HSL CSS variables in [globals.css](src/app/globals.css), exposed to Tailwind 4 via `@theme inline`. Tailwind 4 is CSS-first, so the artifact's `tailwind.config.ts` maps to `@theme` rather than a JS config file.

### Signature patterns

| Pattern | Utility | Use |
|---|---|---|
| Frosted glass | `.glass-card` | Sidebar, header, bottom nav, login card |
| Glow blobs | `.glow-blob` | Blurred colour orbs behind the UI |
| Floating island | `rounded-[32px]` + `.shadow-float` | Sidebar and main panels |
| Gradient text | `.text-gradient-premium` | Product wordmark |
| Primary gradient | `.gradient-primary` | Primary buttons |
| Card lift | `.card-hover` | KPI tiles on hover |

Motion: 300–400ms `cubic-bezier(0.4, 0, 0.2, 1)`, icons scale on hover, buttons `active:scale-95`. All animation is suppressed under `prefers-reduced-motion`.

### Mobile adaptation

The source artifact describes a **desktop** dashboard — `w-72` sidebar, `rounded-[40px]` islands, `p-6` wrappers. Those proportions do not survive a 360px screen, so:

| Source (desktop) | Ours (mobile) |
|---|---|
| `rounded-[40px]` | `rounded-[32px]` desktop, `rounded-3xl` mobile |
| Persistent `w-72` sidebar | Bottom nav under `md`, sidebar island from `md` up |
| `h-20` header | `h-16` mobile header, no header on desktop |
| `p-6` wrapper | `p-4` desktop, edge-to-edge mobile |

Colour, type, shadow and motion tokens carry over unchanged — only layout proportions are scaled.

**Light is the primary mode**, matching the source. Dark tokens are defined and `darkMode: ["class"]` semantics are preserved via a `dark` class on `<html>`; it is opt-in, not driven by OS preference.

---

## 5. Mobile-First Design Rules

Binding rules for all UI work, given C1.

1. **Design at 360px first.** Tablet and desktop are progressive enhancements, never the starting point.
2. **Touch targets ≥ 44×44px.** ASMs work one-handed, often standing.
3. **Bottom navigation** on mobile — reachable with a thumb. Sidebar only at desktop breakpoints.
4. **One primary action per screen.** The 44-step workflow is broken into short, focused steps rather than long forms.
5. **Cascading selectors are searchable.** OEM → Vehicle → Part → Colour become type-ahead sheets, not native `<select>` dropdowns; catalogs will be too large to scroll on a phone.
6. **Every form is resumable.** Draft state persists locally — a dropped connection must never lose a half-entered order.
7. **Camera-native uploads.** Payment receipts and printing frames capture directly from the phone camera, with client-side compression before upload.
8. **Optimistic UI with explicit sync state.** Writes queue and retry; the user always sees whether data is saved or pending.
9. **Bundle budget: < 200KB JS on first load** for the ASM order flow. Enforced in CI.
10. **All tables become cards on mobile.** No horizontal scrolling on a phone.

---

## 6. Dashboards (Phase 1 shells)

Each role gets a dashboard shell first, populated phase by phase per C3.

| Role | Dashboard shows | Primary action |
|---|---|---|
| **ASM** | My orders by status, pending approvals, SLA breaches, monthly value | **+ New Order** |
| **Admin** | System-wide order funnel, user activity, master-data health, discount-cap breaches | Manage masters |
| **Plant Ops** | Incoming approved orders, stock vs. demand, in-process, hold, dispatch-ready | Update quantities |
| **Accounts** | Awaiting dummy invoice, awaiting final invoice, credit vs. advance split, receipts pending | Process invoice |
| **Dispatch** | Ready to dispatch, in transit, docket entry queue | Enter dispatch details |

---

## 7. Data Model — Core Entities

```
IDENTITY
User ──< UserRole >── Role

ADMIN-CONTROLLED MASTERS
Dealer ──< SubDealer
Dealer ──< PrintingFrame        (reusable asset — Report Rec #2)
Dealer ──> DealerPriceTier      (dealer-specific pricing)
OEM ──< Vehicle ──< Part ──< PartColour
Part ──> GstSlab                (per-item GST rate, date-effective)
Part ──< PriceList              (unit price, date-effective)
Transporter                      (master — Report Rec #10)
Scheme ──< SchemeRule           (eligibility + benefit)
DiscountRule                     (caps/thresholds — Report Rec #4)
SystemConfig                     (all business toggles — see §7A)

TRANSACTIONAL
Order
 ├─ OrderLine ──> PartColour
 │    └─ price snapshot: unit_price, discount, gst_rate, gst_amount,
 │                       line_gross, line_net   (all NUMERIC(14,2))
 ├─ OrderVersion         (decline/modify audit — Report Rec #7)
 ├─ Approval             (SLA timers — Report Rec #6)
 ├─ Payment ──< PaymentReceipt
 ├─ ProductionRecord ──< InventoryTransaction
 ├─ Invoice              (dummy → final; uploaded files on VPS)
 └─ Dispatch ──> Transporter

DOCUMENTS (numbers persisted, files not)
DocumentSequence         (PI / invoice numbering per financial year)
DocumentIssueLog         (who generated which document, when)
FileAsset                (path/mime/size/checksum for VPS uploads)

CROSS-CUTTING
AuditLog                 (append-only, all state transitions)
Notification             (in-app + email, closes the loop — Report Rec #10)
```

> **Note:** `FileAsset` covers *uploaded* files only (artwork, receipts, invoices). Generated PDFs and PIs have no `FileAsset` row — they do not exist as files.

### Order status state machine

```
DRAFT → PENDING_APPROVAL → APPROVED → IN_PRODUCTION
      → READY_FOR_DISPATCH → INVOICED → DISPATCHED → CLOSED
                    ↓
                DECLINED → (new OrderVersion) → PENDING_APPROVAL
```

### Admin control plane

**Principle: business rules are data, not code.** Everything below is Admin-editable at runtime — no deployment required to change a rate, a rule, or a price.

| Domain | Admin controls | Notes |
|---|---|---|
| **Goods / catalog** | OEM, Vehicle, Part, Colour; activate/deactivate; packing unit (PC/SET) | Drives the cascading selectors |
| **GST slabs** | Rate per part/category, HSN code, date-effective | Per-item, not global |
| **Prices** | Unit price per Part+Colour, date-effective; dealer tiers | Never retroactive to placed orders |
| **Dealers** | Dealer + sub-dealer masters, addresses, contacts, credit limits | Report Rec #1 |
| **Discounts** | Max dealer discount %, stacking rules, approval thresholds | Report Rec #4 |
| **Schemes** | Scheme definition, validity window, eligibility, benefit | Module 2 |
| **Cash discount** | **Which payment mode qualifies** (credit / advance / both), rate | Resolves the report's flagged anomaly — see below |
| **Payment terms** | Credit period, advance %, receipt-before-production toggle | Report Rec #8 |
| **SLA** | Review reminder + escalation intervals, escalation target | Report Rec #6 |
| **Transporters** | Transporter master | Report Rec #10 |
| **Users & roles** | Create users, assign roles, activate/deactivate | — |
| **Numbering** | PI / invoice prefix + series per financial year | — |
| **Notifications** | Templates, recipients, which events fire | — |

**Cash discount — resolved as an Admin setting.** The report flagged that the flowchart routes cash discount to Credit Payment while convention favours rewarding advance payment. Per business direction, this is **not hardcoded either way**: Admin sets which payment mode qualifies. The system enforces whatever is configured, and the question needs no engineering decision.

**All config changes are audited.** Every `SystemConfig` write records the old value, new value, actor, and timestamp — a discount cap or GST rate change must be traceable.

### Inventory state machine (Report Rec #9 — replaces two undifferentiated stock checks)

```
RESERVED → IN_PRODUCTION → ON_HOLD → CONFIRMED → DISPATCHED
```

Enforced with row-level locking (`SELECT … FOR UPDATE`) inside a transaction to prevent the double-counting the report warns about across concurrent orders.

---

## 8. Open Business Decisions Encoded as Config

The report left these unresolved. Each is built **configurable**, so the business can decide without a code change.

| Ref | Question | Resolution | Owner |
|---|---|---|---|
| Rec #4 | Can dealer discount and scheme stack? | Admin sets cap %, stacking rule, approval threshold | **Admin** |
| Rec #5 | Where is GST computed? | **In-app**, per-item slabs from Admin GST master. ERP remains system of record for filing | **Admin** |
| Rec #6 | Order-review SLA? | Admin sets reminder + escalation intervals (default 24h / 48h) | **Admin** |
| Rec #8 | Advance payment before or after approval? | Admin toggle: block production until receipt verified (default **on**) | **Admin** |
| §5 | Cash discount — credit or advance? | **Admin sets which payment mode qualifies.** Not hardcoded | **Admin** |
| Rec #10 | Dispatch confirmation to dealer? | Admin configures notification events + recipients | **Admin** |

Per business direction, these are no longer engineering decisions — they are Admin screens. The build task is the configuration surface and enforcement, not the policy.

---

## 9. Environments

**Deployment target: VPS** (self-managed), consistent with VPS file storage.

| Env | Purpose | Hosting |
|---|---|---|
| Local | Development | Node 22 (Windows) + **PostgreSQL 17 native Windows service, port 5432** |
| Staging | UAT with business users | VPS (staging instance or separate subdomain) |
| Production | Live | **VPS** — app, Postgres, and uploads co-located |

**Dev port: 3100.** Port 3000 is occupied by another local project (Amato Automotive MIS), so `npm run dev` binds 3100 to avoid the clash.

**Local DB decision: the PostgreSQL 17 Windows service already on the machine**, in its own `twom_dev` database alongside the existing `autoform_mis`.

An earlier attempt ran Postgres 16 inside WSL2 on port 5433. It worked, then broke: the WSL Hyper-V firewall defaults to `DefaultInboundAction: Block`, so Windows→WSL connections are refused, and WSL's localhost forwarding proved unreliable across VM restarts. Rather than add firewall rules to work around a boundary we did not need, the database moved to the Windows service — no VM, no firewall, no port forwarding, and nothing to start after a reboot.

Docker was ruled out earlier for memory: the machine has 7.7GB RAM and Docker Desktop reserves 2–3GB for its VM.

### VPS production layout

```
Nginx (TLS via Let's Encrypt, reverse proxy, upload size limits)
  └─> Next.js app (PM2 or systemd, clustered)
        ├─> PostgreSQL 16   (local, or separate DB VPS)
        ├─> Redis           (job queue)
        └─> /var/app/uploads (outside web root, app-mediated access)
```

**Operational requirements — these are on us, not a cloud provider:**

| Concern | Requirement |
|---|---|
| Backups | Nightly `pg_dump` + `rsync` of uploads, retained **off-VPS** |
| TLS | Let's Encrypt with auto-renewal |
| Process mgmt | PM2 / systemd with auto-restart on failure |
| Monitoring | Uptime, disk usage, memory, error alerting |
| Disk | Alert at 70% — uploads grow steadily and the disk is finite |
| Security | Firewall, fail2ban, unattended security upgrades, SSH keys only |
| Deploys | Git-based with rollback; zero-downtime via PM2 reload |

**Sizing note:** runtime PDF generation is CPU-bound. If Puppeteer is used for rendering, budget ~1GB RAM headroom for Chromium; the lighter React-PDF path avoids this. Start at 4GB / 2 vCPU and measure under real load.

**Dev machine:** Node 22.12.0, npm 10.9.0, git 2.47.1 verified present. Docker and Postgres are **not** installed — use a hosted dev database (Neon/Supabase) to start Phase 0 immediately, or install Docker Desktop first.

---

## 10. Standards

- **Code:** ESLint + Prettier, strict TypeScript, no `any` in application code
- **Git:** trunk-based, short-lived feature branches, conventional commits
- **CI:** typecheck → lint → test → bundle-size budget check on every PR
- **Security:** RBAC enforced server-side on every route handler; uploads stored outside the web root with all access mediated by authenticated handlers; secrets in env, never committed
- **Money:** `NUMERIC(14,2)` in Postgres, `decimal.js` in code. Floats for currency are a **build-breaking** lint error
- **Audit:** every order/inventory/invoice/config state transition writes an append-only `AuditLog` row
- **Documents:** generated PDFs/PIs are never persisted; document *numbers* always are
- **Accessibility:** WCAG 2.1 AA baseline

---

## 11. Phase Plan

| Phase | Scope | Exit criteria |
|---|---|---|
| **0. Foundation** | Repo, Next.js, Prisma, Postgres, Auth.js, RBAC, VPS deploy pipeline, CI | All 6 roles log in and see their dashboard shell |
| **1. Dashboards + Admin masters** | 5 dashboard shells; Admin CRUD for dealers, sub-dealers, OEM/Vehicle/Part/Colour, transporters, schemes | Admin manages all master data on mobile |
| **1B. Pricing & config** | Price lists, GST slabs, discount caps, `SystemConfig`, cash-discount routing, numbering series | Admin sets every business rule without a deploy |
| **2. Order capture** | Modules 1–2: parties, cascading config, **live price calculation**, discounts | ASM builds an order on a phone and sees the value before GST |
| **3. Approval, PI & payment** | Module 3: order creation, **runtime PI + order PDF**, email, review gate, SLA timers, receipts | Order reaches APPROVED; PI generates on demand |
| **4. Production** | Module 4: inventory state machine, concurrency control | Plant Ops moves stock through all states safely |
| **5. Accounts** | Module 5: dummy/final invoice upload, cash discount per Admin config | Accounts issues an invoice end to end |
| **6. Dispatch** | Module 6: transporter, docket, close-the-loop notification | Dealer receives dispatch confirmation |
| **7. Hardening** | Reports, analytics, ERP integration, PWA offline, performance, backups verified | Production-ready |

**Phase 1B is new** and deliberately precedes order capture: orders cannot compute values until prices, GST slabs, and discount rules exist as data.

**Note on sequencing:** Phases 1–2 deliberately invert the flowchart's order. Master data must exist before orders can reference it.

---

## 12. Decisions Needed Before Phase 0

### Resolved by business direction

| Decision | Resolution |
|---|---|
| Hosting | **VPS**, self-managed |
| File storage | **VPS local disk**, outside web root |
| PDF / PI storage | **Never stored** — generated at runtime |
| Cash discount routing | **Admin-configured**, not hardcoded |
| GST slabs, goods, dealers, prices | **Admin-controlled masters** |
| Scope includes values | **Yes** — prices, GST, PI generation |

### Still open

| # | Decision | Recommendation | Blocking? |
|---|---|---|---|
| 1 | Approve this stack | As specified above | **Yes** |
| 2 | VPS provider + specs | 4GB / 2 vCPU to start; Indian region for latency + residency | **Yes** |
| 3 | Local DB approach | Hosted dev Postgres (Docker not installed) | **Yes** |
| 4 | Is Dispatch its own team, or does Plant Ops handle it? | Separate role, combinable via config | No |
| 5 | Will dealers ever log in to approve? | Build role dormant, activate later | No |
| 6 | Existing ERP — which one, and does it need a feed? | Document integration point in Phase 7 | No |
| 7 | Email provider + sending domain | Resend or AWS SES | No |
| 8 | Is a tax invoice needed in-app, or only the PI? | PI in scope now; tax invoice deferred pending ERP answer | No |
