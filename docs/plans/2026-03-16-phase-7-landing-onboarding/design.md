# Phase 7 — Landing Page + Onboarding Design

## Scope

Three deliverables:

1. **Marketing landing page** — Replace placeholder `/` with full marketing page
2. **Onboarding wizard** — 3-step setup for new retailers at `/onboarding`
3. **WhatsApp** — Already wired in `bookings.ts`. No work needed. ✅

---

## 1. Schema & Data Flow

### Migration 0006 — 4 new nullable columns on `users`

```ts
businessName:          text("business_name"),
phone:                 text("phone"),
defaultSenderAddress:  text("default_sender_address"),
defaultSenderCity:     text("default_sender_city"),
```

All nullable — existing users unaffected.

### New API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/users/me` | Return current user profile (onboarding pre-fill + booking sheet) |
| `PATCH` | `/api/users/me` | Save onboarding data — partial Zod schema, steps save independently |

Both use Clerk `auth()` for `userId`. No additional auth middleware needed.

### Booking Sheet Pre-fill

`GET /api/users/me` → `defaultSenderAddress` + `defaultSenderCity` pre-fill `originCity` and sender address in `booking-form.tsx`. User can override per-booking. No shipments schema changes.

---

## 2. Routes & Components

### New Routes

| Route | Type | Notes |
|-------|------|-------|
| `/onboarding` | Client Component | Outside `(dashboard)` — no sidebar shell |
| `/` | RSC | Full marketing page replaces placeholder |

### Onboarding Structure

```
src/app/onboarding/
├── page.tsx              # Client component — step state (useState 1→2→3)
├── step-business.tsx     # Step 1: businessName + phone (React Hook Form + Zod)
├── step-address.tsx      # Step 2: defaultSenderAddress + city (AddressAutocomplete reused)
└── step-done.tsx         # Step 3: success screen + CTA → /compare
```

**Clerk redirect:** Set `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/onboarding` in `.env`. No middleware changes.

### Landing Page Structure

Single RSC at `src/app/page.tsx`. Sections as inline components in the same file:

```
Hero → ValueProps → HowItWorks → CarrierLogos → FAQ → CTAFooter
```

**Reused components:** `AddressAutocomplete` (step 2), shadcn/ui `Card`, `Button`, `Input`, `Accordion` (FAQ).

---

## 3. Landing Page Content

| Section | Content |
|---------|---------|
| **Hero** | Darija headline: *"وصّلها بسهولة"* + French sub: *"Comparez les transporteurs, réservez en 1 clic, suivez en temps réel."* + `Commencer` CTA → `/sign-up` |
| **Value props** | 3 cards: 💰 Économisez sur les frais / ⚡ Réservez en 1 clic / 📍 Suivi en temps réel |
| **How it works** | 3 numbered steps: Comparez → Réservez → Suivez |
| **Carrier logos** | Logo strip: Amana, Aramex, CTM, Marocolis, Sendex (text fallback if no SVGs) |
| **FAQ** | shadcn `Accordion` — 5–6 questions (Commission? Carriers supported? COD limits? etc.) |
| **CTA footer** | *"Prêt à démarrer?"* + `Commencer gratuitement` → `/sign-up` + contact email |

**Language:** French primary. Darija in hero headline only (`وصّلها بسهولة`). No i18n library.

**No pricing section** — rates discussed directly with beta retailers.

---

## 4. Onboarding UX

- **Progress indicator:** 3-dot stepper at top (●●○ style)
- **Step 1 — Business profile:** `businessName` + `phone` fields. React Hook Form + Zod. Saves via `PATCH /api/users/me` before advancing.
- **Step 2 — Default sender address:** `defaultSenderAddress` (AddressAutocomplete) + `defaultSenderCity`. Saves via `PATCH /api/users/me` before advancing.
- **Step 3 — Done:** Success message + single CTA button → `/compare`.
- **Mobile-first:** Single-column form, large tap targets, `min-h-screen` centered card.

---

## 5. Error Handling & Edge Cases

### Onboarding

| Case | Handling |
|------|---------|
| User visits `/onboarding` after already onboarding | On mount: `GET /api/users/me` — if `businessName` set, redirect to `/dashboard` |
| `PATCH /api/users/me` fails | Inline error toast, stay on current step |
| Back button mid-wizard | Step resets to 1 — acceptable for MVP |
| No Google Maps key | `AddressAutocomplete` falls back to plain text input (existing behavior) |

### Landing Page

| Case | Handling |
|------|---------|
| Carrier logos missing | Text name fallback — no broken images |
| Signed-in user visits `/` | No redirect — page stays public |

### Booking Sheet Pre-fill

| Case | Handling |
|------|---------|
| `GET /api/users/me` fails or returns no default | Fields render empty — no regression |
| User wants different address | Overrides inline — pre-fill is a default, not a lock |

---

## 6. Out of Scope (Phase 7)

- WhatsApp tracking status updates (booking notification already done)
- i18n toggle / full Darija translation
- Help center dedicated page — FAQ embedded in landing page footer instead
- Onboarding skip/resume logic — first-visit only via Clerk redirect
