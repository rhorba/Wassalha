# Phase 7 — Landing Page + Onboarding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: use executing-plans skill to implement this plan task-by-task.

**Goal:** Build the marketing landing page, a 3-step onboarding wizard for new retailers, and pre-fill the compare form with each user's saved default origin city.

**Architecture:** Migration 0006 adds 4 nullable columns to `users`. Two new API endpoints (`GET/PATCH /api/users/me`) backed by a service layer expose and update the profile. The onboarding wizard lives at `/onboarding` (outside the dashboard shell), triggered by Clerk's sign-up redirect. The landing page is a single RSC replacing the current placeholder. WhatsApp is already wired — no work needed.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Drizzle ORM, Zod, React Hook Form, TanStack Query, shadcn/ui, Tailwind CSS 4.

**Sprint:** W7 — Landing Page + Onboarding

---

## Task 1: Extend `users` Schema + Migration 0006

**Files:**
- Modify: `src/lib/db/schema/users.ts`
- Run: `pnpm db:generate` + `pnpm db:migrate`

**Step 1: Add 4 nullable columns to the `users` table**

```ts
// src/lib/db/schema/users.ts
import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["retailer", "admin"]);

export const users = pgTable("users", {
  id:                   text("id").primaryKey(),
  email:                text("email").notNull().unique(),
  name:                 text("name"),
  role:                 roleEnum("role").notNull().default("retailer"),
  stripeCustomerId:     text("stripe_customer_id"),
  // Phase 7 — onboarding profile
  businessName:         text("business_name"),
  phone:                text("phone"),
  defaultSenderAddress: text("default_sender_address"),
  defaultSenderCity:    text("default_sender_city"),
  createdAt:            timestamp("created_at").notNull().defaultNow(),
  updatedAt:            timestamp("updated_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

**Step 2: Generate and apply migration**

```bash
pnpm db:generate
pnpm db:migrate
```

Expected: new migration file `src/lib/db/migrations/0006_*.sql` with `ALTER TABLE users ADD COLUMN business_name text, ADD COLUMN phone text, ...`.

---

## Task 2: User Profile Validation Schema + Service Layer

**Files:**
- Create: `src/lib/validations/users.ts`
- Create: `src/lib/services/users.ts`

**Step 1: Create Zod validation schema**

```ts
// src/lib/validations/users.ts
import { z } from "zod";

export const UserProfileSchema = z.object({
  businessName:         z.string().min(1, "Business name required").max(100),
  phone:                z.string().regex(/^\+?[0-9]{9,15}$/, "Enter a valid phone number"),
  defaultSenderAddress: z.string().min(5, "Address too short").max(300),
  defaultSenderCity:    z.string().min(2, "City required"),
});

// PATCH accepts any subset of the profile — steps save independently
export const UserProfilePatchSchema = UserProfileSchema.partial();

export type UserProfilePatch = z.infer<typeof UserProfilePatchSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
```

**Step 2: Create service layer**

```ts
// src/lib/services/users.ts
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import type { UserProfilePatch } from "@/lib/validations/users";

export async function getUserProfile(userId: string) {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id:                   true,
      email:                true,
      name:                 true,
      role:                 true,
      businessName:         true,
      phone:                true,
      defaultSenderAddress: true,
      defaultSenderCity:    true,
    },
  });
}

export async function updateUserProfile(userId: string, patch: UserProfilePatch) {
  const [updated] = await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return updated;
}
```

---

## Task 3: `GET/PATCH /api/users/me` Route

**Files:**
- Create: `src/app/api/users/me/route.ts`

```ts
// src/app/api/users/me/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserProfile, updateUserProfile } from "@/lib/services/users";
import { UserProfilePatchSchema } from "@/lib/validations/users";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getUserProfile(userId);
  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json(profile);
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: unknown = await req.json();
  const parsed = UserProfilePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Validation error", issues: parsed.error.issues } },
      { status: 422 },
    );
  }

  const updated = await updateUserProfile(userId, parsed.data);
  return NextResponse.json(updated);
}
```

---

## Task 4: `useUserProfile` TanStack Query Hook

**Files:**
- Create: `src/hooks/use-user-profile.ts`

```ts
// src/hooks/use-user-profile.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UserProfilePatch } from "@/lib/validations/users";

interface UserProfileData {
  id:                   string;
  email:                string;
  name:                 string | null;
  role:                 "retailer" | "admin";
  businessName:         string | null;
  phone:                string | null;
  defaultSenderAddress: string | null;
  defaultSenderCity:    string | null;
}

async function fetchUserProfile(): Promise<UserProfileData> {
  const res = await fetch("/api/users/me");
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json() as Promise<UserProfileData>;
}

async function patchUserProfile(patch: UserProfilePatch): Promise<UserProfileData> {
  const res = await fetch("/api/users/me", {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update profile");
  return res.json() as Promise<UserProfileData>;
}

export function useUserProfile() {
  return useQuery({
    queryKey: ["user-profile"],
    queryFn:  fetchUserProfile,
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: patchUserProfile,
    onSuccess:  () => {
      void queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
}
```

---

## Task 5: Onboarding Wizard

**Files:**
- Create: `src/app/onboarding/page.tsx`
- Create: `src/app/onboarding/step-business.tsx`
- Create: `src/app/onboarding/step-address.tsx`
- Create: `src/app/onboarding/step-done.tsx`
- Modify: `.env.example`

**Step 1: Orchestrator page — manages step state + already-onboarded redirect**

```tsx
// src/app/onboarding/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserProfile } from "@/hooks/use-user-profile";
import { StepBusiness } from "./step-business";
import { StepAddress } from "./step-address";
import { StepDone } from "./step-done";

export default function OnboardingPage() {
  const [step, setStep]   = useState(1);
  const router            = useRouter();
  const { data: profile } = useUserProfile();

  // Redirect already-onboarded users
  useEffect(() => {
    if (profile?.businessName) {
      router.replace("/dashboard");
    }
  }, [profile, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Step indicator */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 w-8 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-zinc-200"
              }`}
            />
          ))}
        </div>

        {step === 1 && <StepBusiness onNext={() => setStep(2)} />}
        {step === 2 && <StepAddress  onNext={() => setStep(3)} />}
        {step === 3 && <StepDone />}
      </div>
    </div>
  );
}
```

**Step 2: Step 1 — Business profile**

```tsx
// src/app/onboarding/step-business.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateUserProfile } from "@/hooks/use-user-profile";

const schema = z.object({
  businessName: z.string().min(1, "Nom requis").max(100),
  phone:        z.string().regex(/^\+?[0-9]{9,15}$/, "Numéro invalide"),
});
type FormData = z.infer<typeof schema>;

interface StepBusinessProps { onNext: () => void; }

export function StepBusiness({ onNext }: StepBusinessProps) {
  const update = useUpdateUserProfile();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  function onSubmit(data: FormData) {
    update.mutate(data, { onSuccess: onNext });
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Votre entreprise</h1>
        <p className="text-sm text-zinc-500 mt-1">Étape 1 sur 3</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="businessName">Nom de l&apos;entreprise</Label>
          <Input id="businessName" placeholder="Mon Commerce" {...register("businessName")} />
          {errors.businessName && (
            <p className="text-xs text-destructive">{errors.businessName.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="phone">Téléphone</Label>
          <Input id="phone" type="tel" placeholder="+212 6XX XXX XXX" {...register("phone")} />
          {errors.phone && (
            <p className="text-xs text-destructive">{errors.phone.message}</p>
          )}
        </div>

        {update.isError && (
          <p className="text-sm text-destructive">Erreur — réessayez.</p>
        )}

        <Button type="submit" className="w-full" disabled={update.isPending}>
          {update.isPending ? "Enregistrement..." : "Continuer →"}
        </Button>
      </form>
    </div>
  );
}
```

**Step 3: Step 2 — Default sender address**

```tsx
// src/app/onboarding/step-address.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressAutocomplete } from "@/components/forms/address-autocomplete";
import { useUpdateUserProfile } from "@/hooks/use-user-profile";

const schema = z.object({
  defaultSenderAddress: z.string().min(5, "Adresse trop courte").max(300),
  defaultSenderCity:    z.string().min(2, "Ville requise"),
});
type FormData = z.infer<typeof schema>;

interface StepAddressProps { onNext: () => void; }

export function StepAddress({ onNext }: StepAddressProps) {
  const update = useUpdateUserProfile();
  const [address, setAddress] = useState("");
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  function onSubmit(data: FormData) {
    update.mutate(data, { onSuccess: onNext });
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Adresse d&apos;expédition</h1>
        <p className="text-sm text-zinc-500 mt-1">Étape 2 sur 3 — pré-remplie à chaque réservation</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <Label>Adresse complète</Label>
          <AddressAutocomplete
            value={address}
            placeholder="12 Rue Ibn Battouta, Casablanca"
            onChange={(val) => {
              setAddress(val.address);
              setValue("defaultSenderAddress", val.address, { shouldValidate: true });
            }}
          />
          {errors.defaultSenderAddress && (
            <p className="text-xs text-destructive">{errors.defaultSenderAddress.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="defaultSenderCity">Ville</Label>
          <Input
            id="defaultSenderCity"
            placeholder="Casablanca"
            {...register("defaultSenderCity")}
          />
          {errors.defaultSenderCity && (
            <p className="text-xs text-destructive">{errors.defaultSenderCity.message}</p>
          )}
        </div>

        {update.isError && (
          <p className="text-sm text-destructive">Erreur — réessayez.</p>
        )}

        <Button type="submit" className="w-full" disabled={update.isPending}>
          {update.isPending ? "Enregistrement..." : "Continuer →"}
        </Button>
      </form>
    </div>
  );
}
```

**Step 4: Step 3 — Done screen**

```tsx
// src/app/onboarding/step-done.tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function StepDone() {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-8 space-y-6 text-center">
      <div className="text-5xl">🎉</div>
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">C&apos;est parti !</h1>
        <p className="text-sm text-zinc-500 mt-2">
          Votre profil est configuré. Faites votre premier envoi maintenant.
        </p>
      </div>
      <Button asChild className="w-full">
        <Link href="/compare">Comparer les transporteurs →</Link>
      </Button>
    </div>
  );
}
```

**Step 5: Update `.env.example` with Clerk sign-up redirect**

Find the existing line:
```
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
```
Change it to:
```
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/onboarding
```

Also update the actual `.env.local` file on the development machine.

---

## Task 6: Pre-fill Compare Form with Default Origin City

**Files:**
- Modify: `src/components/compare/compare-form.tsx`
- Modify: `src/app/(dashboard)/compare/compare-page-client.tsx`

**Step 1: Add `defaultOriginCity` prop to `CompareForm`**

```tsx
// src/components/compare/compare-form.tsx
// Add to interface:
interface CompareFormProps {
  onSubmit:          (data: CompareInput) => void;
  isLoading:         boolean;
  defaultOriginCity?: string;   // ← new
}

// Add useEffect after the useForm call:
import { useEffect } from "react";

// Inside CompareForm, after useForm:
useEffect(() => {
  if (defaultOriginCity) {
    setValue("originCity", defaultOriginCity, { shouldValidate: false });
    setOriginLabel(defaultOriginCity);
  }
}, [defaultOriginCity, setValue]);
```

**Step 2: Pass `defaultOriginCity` from `compare-page-client.tsx`**

```tsx
// src/app/(dashboard)/compare/compare-page-client.tsx
// Add import:
import { useUserProfile } from "@/hooks/use-user-profile";

// Inside the component, before the return:
const { data: profile } = useUserProfile();

// Pass to CompareForm:
<CompareForm
  onSubmit={handleCompare}
  isLoading={compare.isPending}
  defaultOriginCity={profile?.defaultSenderCity ?? undefined}
/>
```

---

## Task 7: Add shadcn Accordion + Landing Page

**Files:**
- Run: `pnpm dlx shadcn@latest add accordion`
- Modify: `src/app/page.tsx`

**Step 1: Install Accordion component**

```bash
pnpm dlx shadcn@latest add accordion
```

Expected: `src/components/ui/accordion.tsx` created.

**Step 2: Replace landing page with full marketing page**

```tsx
// src/app/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const VALUE_PROPS = [
  {
    icon: "💰",
    title: "Économisez sur les frais",
    desc:  "Comparez les tarifs de 5 transporteurs en temps réel et choisissez le moins cher.",
  },
  {
    icon: "⚡",
    title: "Réservez en 1 clic",
    desc:  "Une fois le transporteur choisi, la réservation est confirmée en quelques secondes.",
  },
  {
    icon: "📍",
    title: "Suivi en temps réel",
    desc:  "Suivez chaque colis en direct depuis votre tableau de bord.",
  },
] as const;

const HOW_IT_WORKS = [
  { step: "01", title: "Comparez",  desc: "Entrez la ville de départ, la destination et le poids." },
  { step: "02", title: "Réservez",  desc: "Choisissez votre transporteur et confirmez en 1 clic." },
  { step: "03", title: "Suivez",    desc: "Recevez les mises à jour de livraison en temps réel." },
] as const;

const CARRIERS = ["Amana", "Aramex", "CTM", "Marocolis", "Sendex"] as const;

const FAQ = [
  {
    q: "Quels transporteurs sont disponibles ?",
    a: "Amana, Aramex, CTM, Marocolis et Sendex — les 5 principaux transporteurs COD au Maroc.",
  },
  {
    q: "Comment fonctionne la commission Wassalha ?",
    a: "Une commission est prélevée sur chaque livraison confirmée. Contactez-nous pour les détails.",
  },
  {
    q: "Puis-je utiliser Wassalha depuis mon téléphone ?",
    a: "Oui, l'interface est entièrement optimisée pour mobile.",
  },
  {
    q: "Quels types de colis puis-je envoyer ?",
    a: "Tout colis COD standard : vêtements, électronique, cosmétiques, etc.",
  },
  {
    q: "Comment suivre mes livraisons ?",
    a: "Depuis votre tableau de bord, chaque expédition est suivie en temps réel avec les mises à jour du transporteur.",
  },
] as const;

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b max-w-6xl mx-auto">
        <span className="text-xl font-bold tracking-tight">Wassalha</span>
        <div className="flex gap-3">
          <Button variant="ghost" asChild><Link href="/sign-in">Connexion</Link></Button>
          <Button asChild><Link href="/sign-up">Commencer</Link></Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-6 py-20 max-w-3xl mx-auto">
        <h1 className="text-5xl font-bold tracking-tight text-zinc-900 leading-tight" dir="rtl">
          وصّلها بسهولة
        </h1>
        <p className="mt-4 text-xl text-zinc-500">
          Comparez les transporteurs, réservez en 1 clic, suivez en temps réel.
        </p>
        <div className="mt-8 flex gap-4 justify-center flex-wrap">
          <Button size="lg" asChild>
            <Link href="/sign-up">Commencer gratuitement</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/sign-in">Se connecter</Link>
          </Button>
        </div>
      </section>

      {/* Value Props */}
      <section className="bg-zinc-50 px-6 py-16">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          {VALUE_PROPS.map((v) => (
            <Card key={v.title}>
              <CardContent className="pt-6 space-y-2">
                <div className="text-3xl">{v.icon}</div>
                <h3 className="font-semibold text-zinc-900">{v.title}</h3>
                <p className="text-sm text-zinc-500">{v.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center text-zinc-900 mb-10">
          Comment ça marche ?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.step} className="text-center space-y-2">
              <div className="text-4xl font-black text-primary">{s.step}</div>
              <h3 className="font-semibold text-zinc-900">{s.title}</h3>
              <p className="text-sm text-zinc-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Carrier Logos */}
      <section className="bg-zinc-50 px-6 py-12">
        <p className="text-center text-sm text-zinc-400 mb-6 uppercase tracking-widest">
          Transporteurs partenaires
        </p>
        <div className="flex flex-wrap justify-center gap-8 max-w-3xl mx-auto">
          {CARRIERS.map((c) => (
            <span key={c} className="text-lg font-semibold text-zinc-600">{c}</span>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-16 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-center text-zinc-900 mb-8">
          Questions fréquentes
        </h2>
        <Accordion type="single" collapsible className="space-y-2">
          {FAQ.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
              <AccordionContent className="text-zinc-500">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA Footer */}
      <section className="bg-primary text-primary-foreground px-6 py-16 text-center">
        <h2 className="text-3xl font-bold mb-3">Prêt à démarrer ?</h2>
        <p className="text-primary-foreground/80 mb-8">
          Rejoignez les commerçants marocains qui optimisent leurs livraisons COD.
        </p>
        <Button size="lg" variant="secondary" asChild>
          <Link href="/sign-up">Commencer gratuitement</Link>
        </Button>
        <p className="mt-6 text-sm text-primary-foreground/60">
          Des questions ? Écrivez-nous à{" "}
          <a href="mailto:contact@wassalha.ma" className="underline">
            contact@wassalha.ma
          </a>
        </p>
      </section>
    </main>
  );
}
```

---

## Task 8: Verify + Commit

**Step 1: Run full verification**

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Expected: No TypeScript errors, no lint errors, build succeeds.

**Step 2: Smoke-test checklist**

| # | Test | Expected |
|---|------|---------|
| S1 | Sign up as new user → redirected to `/onboarding` | ✅ Step 1 renders |
| S2 | Complete step 1 (business name + phone) → advance | ✅ Step 2 renders, DB updated |
| S3 | Complete step 2 (address + city) → advance | ✅ Step 3 renders, DB updated |
| S4 | Step 3 CTA → `/compare` | ✅ Redirects to compare page |
| S5 | Sign in as existing (onboarded) user → visit `/onboarding` | ✅ Redirected to `/dashboard` |
| S6 | Go to `/compare` — origin city pre-filled with saved city | ✅ "Recognized: [city]" shown |
| S7 | Visit `/` as signed-out user | ✅ Full landing page renders |
| S8 | Landing page FAQ accordion opens/closes | ✅ Accordion toggles |
| S9 | `GET /api/users/me` as unauthenticated | ✅ 401 returned |
| S10 | `PATCH /api/users/me` with invalid phone | ✅ 422 with Zod issues |

**Step 3: Commit**

```bash
git add src/lib/db/schema/users.ts \
        src/lib/db/migrations/ \
        src/lib/validations/users.ts \
        src/lib/services/users.ts \
        src/app/api/users/me/route.ts \
        src/hooks/use-user-profile.ts \
        src/app/onboarding/ \
        src/components/compare/compare-form.tsx \
        src/app/\(dashboard\)/compare/compare-page-client.tsx \
        src/components/ui/accordion.tsx \
        src/app/page.tsx \
        .env.example

git commit -m "feat: Phase 7 — landing page, onboarding wizard, user profile API"
```
