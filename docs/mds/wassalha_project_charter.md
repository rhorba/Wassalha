# WASSALHA

**B2B COD Delivery Aggregator for Morocco**

## PROJECT CHARTER

**Version 1.0 | March 2026**

Classification: Confidential

Prepared by: [Project Manager Name]
Approved by: [Project Sponsor Name]

---

## 1. Project Overview

| Field | Detail |
|-------|--------|
| **Project Name** | Wassalha — B2B COD Delivery Aggregator |
| **Project ID** | WSL-2026-001 |
| **Start Date** | March 17, 2026 |
| **Target Launch** | May 8, 2026 (8-week MVP) |
| **Project Manager** | [PM Name] |
| **Project Sponsor** | [Sponsor Name] |
| **Priority** | HIGH |
| **Status** | Initiation |

---

## 2. Business Case

Morocco's e-commerce market is growing rapidly, with Cash on Delivery (COD) accounting for over 80% of transactions. COD retailers face critical challenges: fragmented delivery providers, lack of price transparency, unreliable tracking, and high package loss rates (10–20%). No unified platform exists to compare, book, and track COD deliveries across multiple carriers.

Wassalha addresses this gap by building a B2B delivery aggregation platform that enables COD retailers to input origin and destination addresses, receive a ranked list of delivery services (by cost, speed, and reliability), book with one click, and track in real time. Wassalha earns a commission per shipment, creating a scalable revenue model.

---

## 3. Project Objectives

1. Deliver a functional MVP within 8 weeks covering carrier comparison, booking, and real-time tracking.
2. Onboard 5+ Moroccan delivery carriers with API or manual integration.
3. Acquire 20 beta retailers within the first 2 weeks of launch.
4. Achieve 95%+ delivery success rate through intelligent carrier ranking.
5. Demonstrate 20–30% cost savings for retailers compared to direct carrier booking.
6. Build a marketing landing page with full copywriting strategy implemented.

---

## 4. Scope

### 4.1 In Scope

- Web application (responsive, mobile-first) for COD retailers
- Address input with autocomplete (Google Maps API)
- Multi-carrier comparison engine (ranking algorithm: cost, speed, reliability)
- One-click carrier booking and shipment creation
- Real-time GPS tracking dashboard
- Commission calculation and transparent billing dashboard
- User authentication and role management (retailer, admin)
- Marketing landing page with SEO optimization
- WhatsApp notification integration for delivery status updates

### 4.2 Out of Scope (Phase 1)

- Native mobile applications (iOS/Android)
- Payment processing for COD collections (handled by carriers)
- International shipping support
- Warehouse management features
- Multi-language UI (MVP will be French + Darija)

---

## 5. Key Deliverables

| # | Deliverable | Target Date | Owner |
|---|-------------|-------------|-------|
| D1 | Project foundation (auth, DB, CI/CD) | Week 1 | Tech Lead |
| D2 | Address input + carrier data module | Week 2 | Backend Dev |
| D3 | Carrier comparison engine + UI | Week 3 | Full-Stack Dev |
| D4 | Booking flow + commission engine | Week 4 | Full-Stack Dev |
| D5 | Real-time tracking dashboard | Week 5 | Frontend Dev |
| D6 | Analytics dashboard + reporting | Week 6 | Full-Stack Dev |
| D7 | Landing page + onboarding wizard | Week 7 | Frontend + Marketing |
| D8 | Beta launch (20 retailers) | Week 8 | PM + Whole Team |

---

## 6. Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui |
| Backend | Next.js API Routes / Hono (lightweight API layer) |
| Database | PostgreSQL via Supabase or Neon + Drizzle ORM |
| Authentication | Clerk or NextAuth.js v5 |
| Real-time | Supabase Realtime / Socket.io for live tracking |
| Maps / Geocoding | Google Maps API or Mapbox |
| Payments | Stripe (commission billing) + CMI (local Moroccan cards) |
| Notifications | WhatsApp Business API + Resend (email) |
| Deployment | Vercel (frontend) + Railway / Fly.io (services) |
| CI/CD | GitHub Actions |
| Monitoring | Sentry (errors) + PostHog (analytics) |
| Testing | Playwright (E2E) + Vitest (unit) |

---

## 7. Milestones & Timeline

| Week | Milestone | Exit Criteria | Status |
|------|-----------|---------------|--------|
| W1 | Foundation + Auth live | Login works, DB migrated | Planned |
| W2 | Address + Carrier data ready | Autocomplete works, 5 carriers seeded | Planned |
| W3 | Comparison engine working | User sees ranked carrier list | Planned |
| W4 | Booking end-to-end | Full booking + confirmation email | Planned |
| W5 | Live tracking dashboard | Real-time status updates visible | Planned |
| W6 | Analytics + dashboards | Retailer sees spend, savings, stats | Planned |
| W7 | Landing page + onboarding | Page live, onboarding wizard tested | Planned |
| W8 | Beta launch | 20 retailers active, feedback loop live | Planned |

---

## 8. Budget Estimate

| Category | Monthly (DH) | 8-Week Total (DH) |
|----------|-------------:|-------------------:|
| Cloud infrastructure (Vercel, Supabase, Railway) | 2,000 | 4,000 |
| Google Maps API | 1,500 | 3,000 |
| Domain + SSL + email services | 300 | 600 |
| WhatsApp Business API | 500 | 1,000 |
| Marketing (Meta ads, content) | 5,000 | 10,000 |
| Tooling (Sentry, PostHog, Clerk) | 1,000 | 2,000 |
| Contingency (15%) | 1,545 | 3,090 |
| **TOTAL** | **11,845** | **23,690** |

> **Note:** Personnel costs excluded (assumes founding team). Budget figures exclude VAT.

---

## 9. Risks & Mitigation

| # | Risk | Probability | Impact | Mitigation |
|---|------|:-----------:|:------:|------------|
| R1 | Carrier API unavailability / no API | High | High | Build manual booking fallback; start with carriers that have APIs; develop web scraping adapters as backup. |
| R2 | Low retailer adoption at beta | Medium | High | Pre-launch WhatsApp outreach; offer free first 50 shipments; partner with e-commerce communities. |
| R3 | Scope creep beyond MVP | High | Medium | Strict scope control via sprint reviews; PM gatekeeps all feature additions; defer to Phase 2. |
| R4 | Data accuracy (carrier pricing changes) | Medium | Medium | Automated pricing sync where APIs exist; manual weekly audits for others; flag stale data in UI. |
| R5 | Team bandwidth / key person risk | Medium | High | Document all architecture decisions; pair programming; cross-train on critical modules. |
| R6 | Regulatory / licensing requirements | Low | High | Early legal consultation on commission model; comply with Moroccan e-commerce regulations. |

---

## 10. Success Criteria

- MVP launched within 8 weeks with all core features functional
- 20+ beta retailers onboarded and actively booking shipments
- 95%+ delivery success rate via recommended carriers
- Retailers report average 20%+ cost savings vs. their previous setup
- Net Promoter Score of 40+ from beta users
- Positive unit economics: commission revenue covers per-shipment costs

---

## 11. Constraints & Assumptions

### Constraints

- 8-week timeline is firm; scope must be managed accordingly
- Budget is self-funded; no external investment in Phase 1
- Must comply with Moroccan data protection regulations (Loi 09-08)

### Assumptions

- At least 3 carriers will provide API access or structured pricing data
- COD retailers are willing to use a web-based tool (validated via research)
- Google Maps API will provide accurate Moroccan address geocoding
- WhatsApp remains the primary business communication channel in Morocco

---

## 12. Communication Plan

| Event | Frequency | Audience | Channel |
|-------|-----------|----------|---------|
| Daily standup | Daily, 15 min | Dev team | Slack / Discord huddle |
| Sprint review | Weekly (Fridays) | All stakeholders | Google Meet + demo |
| Sprint planning | Weekly (Mondays) | Dev team + PM | Notion / Linear board |
| Stakeholder update | Bi-weekly | Sponsor + advisors | Email report |
| Beta user feedback | Continuous (W7-W8) | Beta retailers | WhatsApp group + Typeform |

---

## 13. Approval Signatures

By signing below, the undersigned acknowledge they have reviewed the Project Charter and authorize the project to proceed.

| Role | Name / Signature | Date |
|------|-----------------|------|
| Project Sponsor | | |
| Project Manager | | |
| Technical Lead | | |
| Business Lead | | |

---

*Confidential — Wassalha 2026*
