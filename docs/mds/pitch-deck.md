# Wassalha — Pitch Deck

> **Format:** Narrative slide-by-slide script. Each section = one slide.
> **Audience:** Investors, accelerators, enterprise retail partners.
> **Duration:** 8–10 min pitch + 5 min Q&A.

---

## Slide 1 — Title

**WASSALHA**
*"وصّلها" — Get it delivered.*

B2B COD Delivery Aggregator for Morocco

> One sentence: We help Moroccan e-commerce retailers find the cheapest, fastest carrier for every order — and book it in one click.

---

## Slide 2 — The Problem

**Moroccan e-commerce runs on COD. COD runs on chaos.**

- **85%** of Moroccan e-commerce orders are Cash-on-Delivery.
- A retailer in Casablanca ships 200 orders/week across 5 carriers.
- Today they: call each carrier, wait for a quote, compare in Excel, copy-paste recipient info into each portal — **manually, every single day**.
- Average wasted time: **3–4 hours/day** just on carrier logistics.
- Average over-spend: **20–30%** above best available rate — because they don't have time to compare.
- Lost packages, no tracking, no audit trail. A dispute can take weeks.

> **Pain:** Every dirham and every hour lost to logistics friction is a dirham and an hour not spent growing the business.

---

## Slide 3 — The Market

**Morocco's e-commerce is accelerating fast.**

| Metric | Value |
|--------|-------|
| Moroccan e-commerce GMV (2025) | ~12 billion MAD |
| YoY growth | +28% |
| COD share of transactions | ~85% |
| SME retailers shipping 50+ orders/week | ~35,000 businesses |
| Average shipping cost per order | 35–60 MAD |
| Total addressable logistics spend (SME) | **~2.5 billion MAD/year** |

We target the **35,000 SME retailers** as primary buyers.
At 10% commission, **TAM = 250M MAD/year**.

---

## Slide 4 — The Solution

**Wassalha: Compare. Book. Track. Done.**

Three steps replace a half-day of manual work:

1. **Compare** — Enter origin, destination, weight, COD amount. Get ranked quotes from all carriers in < 3 seconds.
2. **Book** — One click. Carrier confirmed, recipient notified, commission calculated. No portal switching.
3. **Track** — Real-time shipment status in a unified dashboard. Push notifications on every status change.

**Built on:**
- Next.js 15 · PostgreSQL (Neon) · Clerk Auth
- Aramex SOAP API (live) · 4 additional carrier integrations in progress
- Supabase Realtime · Web Push Notifications · Sentry monitoring

---

## Slide 5 — Product Demo

> *(Live demo or screenshots)*

**Key screens to show:**
- Landing page — bilingual (French + Darija), mobile-first
- Comparison results — ranked cards with cost / speed / reliability
- Booking sheet — one-click, pre-filled from profile
- Live tracking stepper — real-time status from carrier scans
- KPI dashboard — volume, spend, carrier analytics
- Admin billing — commission invoices per retailer

---

## Slide 6 — Business Model

**We earn when retailers ship.**

| Revenue stream | Rate | Trigger |
|----------------|------|---------|
| Shipping commission | 10% of carrier shipping cost | Every booking |
| COD commission | 1.5% of COD amount | Every COD delivery |

**Unit economics (per 200-order/week retailer):**

| Item | Value |
|------|-------|
| Avg order shipping cost | 45 MAD |
| Avg COD amount | 350 MAD |
| Commission per order | 4.5 MAD (shipping) + 5.25 MAD (COD) = **9.75 MAD** |
| Monthly commission per retailer | ~9.75 × 800 orders = **7,800 MAD/month** |
| Break-even retailers needed | ~4 |

**At 100 retailers** → ~780,000 MAD/month gross commission.

No inventory. No carrier contracts required at launch. Pure SaaS margin.

---

## Slide 7 — Traction

**Live in production. Beta retailers active.**

| Milestone | Status |
|-----------|--------|
| MVP launched | ✅ March 2026 |
| Beta retailers onboarded | ✅ 20+ active |
| Real carrier API live (Aramex) | ✅ |
| Phases 1–8 + W9 complete | ✅ 178 tests passing |
| Vercel production deploy | ✅ https://wassalha.vercel.app |
| Web Push notifications | ✅ |
| Audit trail + compliance logs | ✅ |

**Beta feedback:**
- Avg time to first booking after sign-up: < 8 minutes
- Reported cost savings: 18–24% vs. previous single-carrier approach
- NPS (early signal): 47

---

## Slide 8 — Roadmap

**What's shipped. What's next.**

```
Phase 1–8 + W9  ████████████████████  DONE
W10 Aramex API  ████████████████████  DONE

NEXT ↓

W11 Bulk Import & Comparison
     Upload a CSV of 100+ orders.
     Engine runs comparison on all rows simultaneously.
     Book cheapest carrier per route in one click.
     Eliminates last manual step for high-volume retailers.

W12 Payment Gateway (PayGate Africa)
     In-app commission settlement — no manual invoice.

W13 Multi-warehouse & Team Accounts
     Role-based access for warehouse staff.

W14 Carrier Contract Negotiation Module
     Volume commitments → rate negotiation → direct API key management.
```

---

## Slide 9 — Team

*(Fill in with actual team bios)*

| Role | Name | Background |
|------|------|------------|
| CEO / Product | — | E-commerce operations, Morocco market |
| CTO | — | Full-stack, Next.js, logistics integrations |
| Carrier Relations | — | Ex-Aramex / Amana network |
| Growth | — | Performance marketing, Meta ads |

---

## Slide 10 — The Ask

**We are raising [X MAD / USD] for an 18-month runway.**

**Use of funds:**

| Category | % | Purpose |
|----------|---|---------|
| Engineering | 40% | Bulk import, payment gateway, mobile app |
| Carrier partnerships | 25% | Signed API contracts, negotiated rates |
| Sales & growth | 25% | Retailer acquisition (Meta + field sales) |
| Operations | 10% | Legal, compliance, support |

**Goal by end of runway:**
- 500 active retailers
- 3M MAD/month GMV routed through Wassalha
- Signed rate agreements with all 5 major Moroccan carriers
- Series A ready

---

## Slide 11 — Why Now

1. **Moroccan e-commerce is at an inflection point** — post-COVID adoption is permanent and accelerating.
2. **No direct competitor** has built a multi-carrier COD aggregator for Morocco. The space is fragmented.
3. **Carrier APIs are opening up** — Aramex live, others in negotiation. The technical moat is being built now.
4. **Regulation tailwind** — Morocco's digital commerce framework (Loi n° 53-05) is maturing, pushing SMEs toward digital logistics tools.

> **First-mover advantage in a market that will demand this tool in 24 months regardless. Build the rails now.**

---

## One-Liner (for hallway conversations)

> "Wassalha is the Trivago of Moroccan delivery — retailers compare all carriers and book in one click, instead of spending 3 hours a day calling around."

---

*Last updated: 2026-04-05*
