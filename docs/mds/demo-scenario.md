# Wassalha — Live Demo Scenario

> **Purpose:** Step-by-step walkthrough for showing the app to investors, partners, or potential retailers.
> **URL:** https://wassalha.vercel.app
> **Duration:** ~12–15 minutes full run · ~5 minutes express run

---

## Pre-Demo Checklist

- [ ] Open https://wassalha.vercel.app in a clean browser window (or incognito)
- [ ] Have **retailer test account** credentials ready (`retailer+clerk_test@...`)
- [ ] Have **admin test account** credentials ready (`admin+clerk_test@...`)
- [ ] Confirm push notifications are enabled in browser (for W9 demo segment)
- [ ] Open a second tab with the admin view if you want to do split-screen
- [ ] Resize browser to ~1280px wide — the app is mobile-first but desktop looks sharp at this width

---

## Act 1 — First Impression: The Landing Page (1–2 min)

**URL:** `/`

1. Open the root URL. Point out the **hero headline in Darija + French** — the app speaks the language of Moroccan e-commerce.
2. Scroll slowly. Highlight the **3 value props**:
   - Compare all carriers in seconds
   - One-click booking — no contracts
   - Real-time tracking dashboard
3. Show the **FAQ accordion** — addresses the most common objections (price, reliability, switching cost).
4. Click **"Commencer maintenant"** CTA → lands on sign-up.

> **Talking point:** "A retailer in Casablanca sees this on their phone, clicks, signs up in 2 minutes. No sales call needed."

---

## Act 2 — Onboarding Wizard (2 min)

**URL:** `/onboarding`

> Use a fresh account or show the 3-step flow in screenshots if you don't want to create a new user live.

**Step 1 — Business Profile**
- Enter business name: `Boutique Atlas`
- Enter phone: `+212 6 12 34 56 78`
- Click **Suivant**

**Step 2 — Default Address**
- Type `Casablanca` in the city field — Google Places autocomplete fires, showing Morocco-restricted suggestions
- Select the city
- Click **Suivant**

**Step 3 — Done**
- Confirmation screen. Click **"Comparer les transporteurs"** → redirects to `/compare`

> **Talking point:** "Onboarding takes under 5 minutes. After step 3 the retailer is ready to book their first shipment."

---

## Act 3 — Carrier Comparison (3 min)

**URL:** `/compare`

This is the **core feature** — spend the most time here.

1. The **origin city** is pre-filled from the profile (`Casablanca`).
2. Set **destination**: type `Marrakech` — autocomplete suggests it.
3. Enter **weight**: `2 kg`
4. Enter **COD amount**: `350 MAD`
5. Select **delivery mode**: `Economy` (cheapest) vs `Express` (fastest) — toggle and show how rankings shift.
6. Click **"Comparer"**.

**Results page — what to highlight:**
- Cards ranked by the algorithm: cost × speed × reliability with mode weights
- Each card shows: carrier logo, total price, estimated days, reliability score, COD fee
- **Filters**: sort by cheapest / fastest / most reliable
- Point to Aramex card — "This one is live. Real rates pulled from the Aramex SOAP API in real time."

> **Talking point:** "Before Wassalha, a retailer calls 5 carriers, waits for quotes, compares manually in an Excel. We do it in under 3 seconds."

---

## Act 4 — One-Click Booking (2 min)

From the comparison results:

1. Click **"Réserver"** on the recommended carrier card → `BookingSheet` slides in from the right.
2. Review the pre-filled summary: route, weight, carrier, estimated cost, COD amount.
3. Enter recipient details:
   - Name: `Khalid Benali`
   - Phone: `+212 6 55 00 11 22`
   - Address: `15 Rue Ibn Sina, Marrakech`
4. Click **"Confirmer la réservation"**.
5. Success toast fires. A **shipment is created** with a tracking number.

> Behind the scenes (mention verbally):
> - Atomic DB transaction: shipment + commission calculated (10% shipping + 1.5% COD)
> - Confirmation email sent via Resend
> - WhatsApp notification queued for recipient

> **Talking point:** "One click. The carrier is booked, the commission is calculated, the customer is notified. No manual work."

---

## Act 5 — Real-time Tracking (2 min)

**URL:** `/shipments/[id]`

1. From the booking success screen or the shipments list, click the new shipment.
2. Show the **live tracking stepper** — status badges from `pending` → `picked_up` → `in_transit` → `delivered`.
3. Point to the timeline of events on the right — timestamps for each carrier scan.
4. Mention: "This updates live via Supabase Realtime. If the carrier pushes a new scan, the stepper jumps — no page refresh."

> **Talking point:** "The retailer opens this on their phone while talking to their customer. Real answers, instantly."

---

## Act 6 — Dashboard & Analytics (2 min)

**URL:** `/dashboard`

**KPI Row (top 6 cards):**
- Total Shipments | In Transit | Delivered | Revenue | Commission Paid | Pending COD

Scroll down to **Analytics panel**:
- Tab 1 — **Volume**: bar chart of shipments per week/month
- Tab 2 — **Spend**: line chart of shipping costs over time
- Tab 3 — **Carriers**: breakdown of which carrier is used most

Point to **date range picker** — narrow to last 30 days, charts update instantly.

Show **"Exporter CSV"** button — downloads all shipment data for accounting.

> **Talking point:** "At the end of the month the retailer exports this CSV and hands it to their accountant. Done."

---

## Act 7 — Admin View (2 min)

> Switch to admin account credentials.

**URL:** `/admin/carriers`

- Show the carrier management table — 5 carriers, live/inactive toggle.
- Click a carrier → show zone pricing editor (MAD per kg per zone).

**URL:** `/admin/billing`

- Show the billing overview: per-retailer commission totals.
- Click **"Générer une facture"** for a retailer → Stripe invoice created, status updates to `pending`.

**URL:** `/admin/audit-logs`

- Show the audit trail: every admin action logged with user, action type, target, timestamp.

> **Talking point:** "Admins have full visibility. Every price change, every invoice, every role update is logged. Audit-ready from day one."

---

## Act 8 — Web Push Notifications (1 min)

1. Click the **bell icon** in the dashboard header → browser prompts for notification permission.
2. Allow it → bell turns active.
3. Explain: "When a shipment status changes — picked up, delivered, failed — the retailer gets a push notification even if the tab is closed."

> **Talking point:** "No app download needed. Works on Chrome, Edge, Safari. Mobile or desktop."

---

## Closing — Roadmap Teaser (30 sec)

> End with this to leave a strong impression.

"Everything you just saw is live in production with 20+ beta retailers. The next feature shipping is **Bulk Import & Comparison** — retailers upload a CSV of 100+ orders, the engine runs comparison across all of them simultaneously, and they book the cheapest carrier per route in one click. That eliminates the last manual step for high-volume e-commerce."

---

## Express Run (5 min version)

Skip Acts 2, 7, and 8. Run only:

| Act | Page | Time |
|-----|------|------|
| 1 — Landing | `/` | 1 min |
| 3 — Comparison | `/compare` | 1.5 min |
| 4 — Booking | (sheet) | 1 min |
| 5 — Tracking | `/shipments/[id]` | 45 sec |
| 6 — Dashboard | `/dashboard` | 45 sec |

---

## Common Questions & Answers

| Question | Answer |
|----------|--------|
| "What carriers do you support?" | 5 at launch: Aramex (live API), Amana, CTM, Marocolis, Sendex (contracts in progress). |
| "How do you make money?" | 10% commission on shipping cost + 1.5% on COD amount — billed monthly via invoice. |
| "Is COD handled by you?" | No. We route the booking to the carrier. COD collection stays with the carrier. |
| "What if a package is lost?" | Dispute goes through the carrier's own SLA. We provide the paper trail via audit logs. |
| "Can I use it on mobile?" | Yes — mobile-first responsive. Works in the browser, no app install required. |
| "What's next after bulk import?" | Payment gateway (PayGate Africa), carrier contract negotiation tools, multi-warehouse support. |

---

*Last updated: 2026-04-05*
