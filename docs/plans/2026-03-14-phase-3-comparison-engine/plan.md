# Phase 3 — Comparison Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: use executing-plans skill to implement this plan task-by-task.

**Goal:** Build a carrier comparison engine that ranks active carriers by cost, speed, and reliability for a given shipment (weight + origin/destination city + COD amount).

**Architecture:** Two new DB columns extend existing `carriers` and `carrier_pricing` tables. A new `comparison.ts` service implements the ranking logic. A single `POST /api/carriers/compare` route handles queries. The frontend is a two-phase page: form → results, with client-side sort and a "Book Now" stub.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Drizzle ORM, Zod, React Hook Form, TanStack Query, shadcn/ui, Tailwind CSS 4.

**Sprint:** W3 — Comparison Engine

---

## Task 1: Schema — Add COD fee + reliability columns

**Files:**
- Modify: `src/lib/db/schema/carriers.ts`

**Step 1: Add `reliabilityScore` to `carriers` table**

In `src/lib/db/schema/carriers.ts`, add the import `numeric` from `drizzle-orm/pg-core` isn't needed — `integer` is already imported. Add the column inside the `carriers` pgTable definition, after `isActive`:

```ts
reliabilityScore: integer("reliability_score").notNull().default(80),
// 0–100, admin-set. Default 80 = neutral starting point.
```

**Step 2: Add COD fee columns to `carrierPricing` table**

Add `numeric` to the `drizzle-orm/pg-core` import at the top of the file. Then add inside the `carrierPricing` pgTable, after `deliveryDaysMax`:

```ts
codFeeMad:     integer("cod_fee_mad"),
// flat COD surcharge in centimes, nullable

codFeePercent: numeric("cod_fee_percent", { precision: 5, scale: 2 }),
// percentage of COD amount, e.g. "1.50" = 1.5%, nullable
```

**Step 3: Update exported types**

The existing `export type Carrier = typeof carriers.$inferSelect` and `export type CarrierPricing = typeof carrierPricing.$inferSelect` at the bottom of the file will automatically pick up the new columns — no manual change needed.

**Step 4: Generate and apply migration**

```bash
pnpm db:generate
pnpm db:migrate
```

Expected: a new migration file in `src/lib/db/migrations/` with `ALTER TABLE carriers ADD COLUMN reliability_score integer NOT NULL DEFAULT 80` and `ALTER TABLE carrier_pricing ADD COLUMN cod_fee_mad integer` + `ADD COLUMN cod_fee_percent numeric(5,2)`.

---

## Task 2: Zod validation — extend pricing + carrier schemas

**Files:**
- Modify: `src/lib/validations/carriers.ts`

**Step 1: Update `CreatePricingSchema`**

Add two optional fields inside the existing `z.object({...})` before the `.refine()` calls:

```ts
codFeeMad:     z.number().int().min(0).nullable().optional(),
codFeePercent: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a decimal like 1.50").nullable().optional(),
```

> Note: `codFeePercent` arrives as a string from the DB (`numeric` type in Drizzle). Store it as string in Zod to match.

Add a third `.refine()` after the existing two:

```ts
.refine(
  (data) =>
    data.codFeePercent === null ||
    data.codFeePercent === undefined ||
    parseFloat(data.codFeePercent) <= 100,
  { message: "COD fee percent must be between 0 and 100", path: ["codFeePercent"] }
)
```

**Step 2: Update `CreateCarrierSchema`**

Add `reliabilityScore` as an optional field (admin can override default):

```ts
reliabilityScore: z.number().int().min(0).max(100).optional(),
```

**Step 3: Export new types**

The existing `export type CreatePricingInput = z.infer<typeof CreatePricingSchema>` and `export type CreateCarrierInput` will automatically include the new fields.

**Step 4: Add `CompareInputSchema` + `CarrierResult` type**

At the bottom of `src/lib/validations/carriers.ts`, append:

```ts
export const CompareInputSchema = z.object({
  originCity:      z.string().min(2, "Origin city required"),
  destinationCity: z.string().min(2, "Destination city required"),
  weightG:         z.number().int().min(1, "Weight must be at least 1g"),
  codAmountMad:    z.number().int().min(0),
  mode:            z.enum(["cheapest", "balanced", "fastest"]).default("balanced"),
});

export type CompareInput = z.infer<typeof CompareInputSchema>;

export type CarrierResult = {
  carrierId:        string;
  name:             string;
  logoUrl:          string | null;
  totalCostMad:     number;
  deliveryDaysMin:  number;
  deliveryDaysMax:  number;
  reliabilityScore: number;
  score:            number;
  codFeeBreakdown: {
    flatMad:    number;
    percentFee: number;
    total:      number;
  };
};
```

---

## Task 3: Admin UI — add `reliabilityScore` field to carrier edit form

**Files:**
- Modify: `src/components/carriers/carrier-form.tsx`

**Step 1: Add field to form**

`CarrierForm` uses `useForm<CreateCarrierInput>` with `zodResolver(CreateCarrierSchema)`. Since `CreateCarrierSchema` now includes `reliabilityScore`, just add the input to the JSX after the `logoUrl` field:

```tsx
<div className="space-y-1">
  <Label htmlFor="reliabilityScore">Reliability Score (0–100)</Label>
  <Input
    id="reliabilityScore"
    type="number"
    {...register("reliabilityScore", { valueAsNumber: true })}
    placeholder="80"
  />
  {errors.reliabilityScore && (
    <p className="text-sm text-destructive">{errors.reliabilityScore.message}</p>
  )}
</div>
```

**Step 2: Add to `defaultValues`**

In the existing `defaultValues` object (edit mode), add:

```ts
reliabilityScore: carrier.reliabilityScore ?? 80,
```

> The `Carrier` type already includes `reliabilityScore` after the schema change in Task 1 — no additional type import needed.

---

## Task 4: City-zones static mapping

**Files:**
- Create: `src/lib/carriers/city-zones.json`

**Step 1: Create the file**

```json
{
  "casablanca": "ZA",
  "dar el beida": "ZA",
  "mohammedia": "ZA",
  "rabat": "ZB",
  "sale": "ZB",
  "temara": "ZB",
  "kenitra": "ZB",
  "marrakech": "ZC",
  "agadir": "ZC",
  "essaouira": "ZC",
  "fes": "ZD",
  "meknes": "ZD",
  "ifrane": "ZD",
  "tanger": "ZE",
  "tetouan": "ZE",
  "larache": "ZE",
  "oujda": "ZF",
  "nador": "ZF",
  "berkane": "ZF",
  "el jadida": "ZG",
  "safi": "ZG",
  "khouribga": "ZG",
  "beni mellal": "ZH",
  "khenifra": "ZH",
  "errachidia": "ZH",
  "laayoune": "ZI",
  "dakhla": "ZI",
  "ouarzazate": "ZJ",
  "zagora": "ZJ",
  "al hoceima": "ZK",
  "chefchaouen": "ZK"
}
```

> Zone codes (`ZA`–`ZK`) must match the `zoneCode` values in `carrier_zones` as seeded by `src/lib/db/seed.ts`. Verify alignment after running the seed.

**Step 2: Create a typed lookup helper**

Create `src/lib/carriers/city-zones.ts`:

```ts
import cityZonesMap from "./city-zones.json";

/**
 * Normalize a city name and look up its zone code.
 * Returns undefined if the city is not in the static map.
 */
export function cityToZoneCode(city: string): string | undefined {
  const key = city.toLowerCase().trim();
  return (cityZonesMap as Record<string, string>)[key];
}
```

---

## Task 5: Comparison service

**Files:**
- Create: `src/lib/services/comparison.ts`

**Step 1: Write the service**

```ts
import { and, eq, isNull, lte, gte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { carriers, carrierZones, carrierPricing } from "@/lib/db/schema";
import { cityToZoneCode } from "@/lib/carriers/city-zones";
import type { CompareInput, CarrierResult } from "@/lib/validations/carriers";

const MODE_WEIGHTS = {
  cheapest: { cost: 0.7, speed: 0.2, reliability: 0.1 },
  balanced: { cost: 0.4, speed: 0.3, reliability: 0.3 },
  fastest:  { cost: 0.2, speed: 0.5, reliability: 0.3 },
} as const;

export type CompareError =
  | { code: "CITY_NOT_FOUND"; field: "originCity" | "destinationCity" }
  | { code: "NO_RESULTS" };

export async function compareCarriers(
  input: CompareInput
): Promise<{ results: CarrierResult[] } | { error: CompareError }> {
  // 1. Resolve destination city → zone code
  const destZoneCode = cityToZoneCode(input.destinationCity);
  if (!destZoneCode) {
    return { error: { code: "CITY_NOT_FOUND", field: "destinationCity" } };
  }

  // 2. Query active carriers that have a zone matching destZoneCode
  const rows = await db.query.carriers.findMany({
    where: eq(carriers.isActive, true),
    with: {
      zones: {
        where: eq(carrierZones.zoneCode, destZoneCode),
        with: { pricing: true },
      },
    },
  });

  // 3. For each carrier, find the matching pricing tier by weight
  type RawResult = {
    carrierId:        string;
    name:             string;
    logoUrl:          string | null;
    reliabilityScore: number;
    priceMad:         number;
    codFeeMad:        number;
    codFeePercent:    number;
    deliveryDaysMin:  number;
    deliveryDaysMax:  number;
  };

  const matched: RawResult[] = [];

  for (const carrier of rows) {
    // Skip carriers with no zone matching destZoneCode
    if (carrier.zones.length === 0) continue;

    const zone = carrier.zones[0];

    // Find pricing tier: weightMinG <= input.weightG AND (weightMaxG IS NULL OR weightMaxG >= input.weightG)
    const tier = zone.pricing.find(
      (p) =>
        p.weightMinG <= input.weightG &&
        (p.weightMaxG === null || p.weightMaxG >= input.weightG)
    );

    // Skip carrier silently if no tier matches weight
    if (!tier) continue;

    const flatMad        = tier.codFeeMad ?? 0;
    const percentFeeRate = tier.codFeePercent ? parseFloat(tier.codFeePercent) : 0;
    const percentFee     = Math.round((percentFeeRate / 100) * input.codAmountMad);

    matched.push({
      carrierId:        carrier.id,
      name:             carrier.name,
      logoUrl:          carrier.logoUrl,
      reliabilityScore: carrier.reliabilityScore,
      priceMad:         tier.priceMad,
      codFeeMad:        flatMad,
      codFeePercent:    percentFeeRate,
      deliveryDaysMin:  tier.deliveryDaysMin,
      deliveryDaysMax:  tier.deliveryDaysMax,
    });
  }

  if (matched.length === 0) return { results: [] };

  // 4. Min-max normalize each signal (0 = worst, 1 = best)
  const costs    = matched.map((r) => r.priceMad + r.codFeeMad + Math.round((r.codFeePercent / 100) * input.codAmountMad));
  const speeds   = matched.map((r) => r.deliveryDaysMin); // lower = faster = better
  const relScores = matched.map((r) => r.reliabilityScore);

  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const minSpeed = Math.min(...speeds);
  const maxSpeed = Math.max(...speeds);
  const minRel = Math.min(...relScores);
  const maxRel = Math.max(...relScores);

  const normalize = (val: number, min: number, max: number, invert = false): number => {
    if (max === min) return 1; // all same → no differentiation, give everyone 1
    const n = (val - min) / (max - min);
    return invert ? 1 - n : n;
  };

  const weights = MODE_WEIGHTS[input.mode];

  // 5. Score and build output
  const results: CarrierResult[] = matched.map((r, i) => {
    const totalCost    = costs[i];
    const costScore    = normalize(totalCost, minCost, maxCost, true); // lower cost = higher score
    const speedScore   = normalize(r.deliveryDaysMin, minSpeed, maxSpeed, true); // fewer days = higher score
    const relScore     = normalize(r.reliabilityScore, minRel, maxRel, false);

    const score =
      costScore * weights.cost +
      speedScore * weights.speed +
      relScore  * weights.reliability;

    const percentFee = Math.round((r.codFeePercent / 100) * input.codAmountMad);

    return {
      carrierId:        r.carrierId,
      name:             r.name,
      logoUrl:          r.logoUrl,
      totalCostMad:     totalCost,
      deliveryDaysMin:  r.deliveryDaysMin,
      deliveryDaysMax:  r.deliveryDaysMax,
      reliabilityScore: r.reliabilityScore,
      score:            Math.round(score * 1000) / 1000, // 3 decimal places
      codFeeBreakdown: {
        flatMad:    r.codFeeMad,
        percentFee,
        total:      r.codFeeMad + percentFee,
      },
    };
  });

  // 6. Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return { results };
}
```

---

## Task 6: Compare API route

**Files:**
- Create: `src/app/api/carriers/compare/route.ts`

**Step 1: Create the route handler**

```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { CompareInputSchema } from "@/lib/validations/carriers";
import { compareCarriers } from "@/lib/services/comparison";

export async function POST(req: Request) {
  // Any authenticated user may compare — no admin check
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await req.json();
  const parsed = CompareInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const outcome = await compareCarriers(parsed.data);

  if ("error" in outcome) {
    if (outcome.error.code === "CITY_NOT_FOUND") {
      return NextResponse.json(
        { error: "City not found", field: outcome.error.field, code: "CITY_NOT_FOUND" },
        { status: 422 }
      );
    }
  }

  // "results" always present (may be empty array)
  return NextResponse.json("results" in outcome ? outcome : { results: [] });
}
```

---

## Task 7: TanStack Query hook

**Files:**
- Create: `src/hooks/use-compare.ts`

**Step 1: Create the hook**

Follow the same pattern as `use-carriers.ts` — `useMutation` with typed input/output:

```ts
"use client";

import { useMutation } from "@tanstack/react-query";
import type { CompareInput, CarrierResult } from "@/lib/validations/carriers";

type CompareResponse = {
  results: CarrierResult[];
  message?: "no_coverage" | "no_results";
};

export function useCompare() {
  return useMutation<CompareResponse, Error, CompareInput>({
    mutationFn: async (data) => {
      const res = await fetch("/api/carriers/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw await res.json();
      return res.json() as Promise<CompareResponse>;
    },
  });
}
```

> No `onSuccess` cache invalidation needed — comparison results are not cached.

---

## Task 8: shadcn/ui components

**Step 1: Add required shadcn/ui primitives (if not already installed)**

```bash
pnpm dlx shadcn@latest add toggle-group card badge
```

Expected: `src/components/ui/toggle-group.tsx`, `card.tsx`, `badge.tsx` created (or already exist).

---

## Task 9: ModeToggle component

**Files:**
- Create: `src/components/compare/mode-toggle.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CompareInput } from "@/lib/validations/carriers";

type Mode = CompareInput["mode"];

interface ModeToggleProps {
  value: Mode;
  onChange: (value: Mode) => void;
}

export function ModeToggle({ value, onChange }: ModeToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => { if (v) onChange(v as Mode); }}
      className="justify-start"
    >
      <ToggleGroupItem value="cheapest">Cheapest</ToggleGroupItem>
      <ToggleGroupItem value="balanced">Balanced</ToggleGroupItem>
      <ToggleGroupItem value="fastest">Fastest</ToggleGroupItem>
    </ToggleGroup>
  );
}
```

---

## Task 10: CarrierResultCard component

**Files:**
- Create: `src/components/compare/carrier-result-card.tsx`

**Step 1: Create the component**

```tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { CarrierResult } from "@/lib/validations/carriers";

interface CarrierResultCardProps {
  result: CarrierResult;
  isTop: boolean;
}

function StarRating({ score }: { score: number }) {
  // Reliability 0–100 mapped to 0–5 stars
  const stars = Math.round((score / 100) * 5);
  return (
    <span className="text-sm text-muted-foreground">
      {"★".repeat(stars)}{"☆".repeat(5 - stars)}
    </span>
  );
}

export function CarrierResultCard({ result, isTop }: CarrierResultCardProps) {
  const costMad = (result.totalCostMad / 100).toFixed(2);

  return (
    <Card className="relative">
      {isTop && (
        <Badge className="absolute top-3 right-3" variant="default">
          Best Match
        </Badge>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          {result.logoUrl && (
            <img src={result.logoUrl} alt={result.name} className="h-8 w-auto object-contain" />
          )}
          <h3 className="font-semibold text-lg">{result.name}</h3>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold">{costMad} MAD</span>
          <StarRating score={result.reliabilityScore} />
        </div>
        <p className="text-sm text-muted-foreground">
          {result.deliveryDaysMin === result.deliveryDaysMax
            ? `${result.deliveryDaysMin} day${result.deliveryDaysMin > 1 ? "s" : ""}`
            : `${result.deliveryDaysMin}–${result.deliveryDaysMax} days`}
        </p>
        {result.codFeeBreakdown.total > 0 && (
          <p className="text-xs text-muted-foreground">
            COD fee: {(result.codFeeBreakdown.total / 100).toFixed(2)} MAD
          </p>
        )}
        <Button asChild variant="default" className="w-full" disabled>
          <Link href={`/dashboard/shipments/new?carrierId=${result.carrierId}`}>
            Book Now →
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
```

> `Button` is `disabled` — "Book Now" is a Phase 4 stub. The `asChild` + `disabled` combo greys it out without navigation.

---

## Task 11: CompareForm component

**Files:**
- Create: `src/components/compare/compare-form.tsx`

**Step 1: Create the form**

```tsx
"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModeToggle } from "@/components/compare/mode-toggle";
import { CompareInputSchema, type CompareInput } from "@/lib/validations/carriers";

interface CompareFormProps {
  onSubmit: (data: CompareInput) => void;
  isLoading: boolean;
}

export function CompareForm({ onSubmit, isLoading }: CompareFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CompareInput>({
    resolver: zodResolver(CompareInputSchema),
    defaultValues: { mode: "balanced", codAmountMad: 0 },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="originCity">From city</Label>
          <Input id="originCity" {...register("originCity")} placeholder="Casablanca" />
          {errors.originCity && (
            <p className="text-sm text-destructive">{errors.originCity.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="destinationCity">To city</Label>
          <Input id="destinationCity" {...register("destinationCity")} placeholder="Marrakech" />
          {errors.destinationCity && (
            <p className="text-sm text-destructive">{errors.destinationCity.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="weightG">Weight (grams)</Label>
          <Input
            id="weightG"
            type="number"
            {...register("weightG", { valueAsNumber: true })}
            placeholder="500"
          />
          {errors.weightG && (
            <p className="text-sm text-destructive">{errors.weightG.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="codAmountMad">COD Amount (centimes)</Label>
          <Input
            id="codAmountMad"
            type="number"
            {...register("codAmountMad", { valueAsNumber: true })}
            placeholder="15000"
          />
          {errors.codAmountMad && (
            <p className="text-sm text-destructive">{errors.codAmountMad.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label>Priority</Label>
        <Controller
          name="mode"
          control={control}
          render={({ field }) => (
            <ModeToggle value={field.value} onChange={field.onChange} />
          )}
        />
      </div>

      <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
        {isLoading ? "Comparing..." : "Compare Carriers"}
      </Button>
    </form>
  );
}
```

---

## Task 12: ResultsList component

**Files:**
- Create: `src/components/compare/results-list.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CarrierResultCard } from "@/components/compare/carrier-result-card";
import type { CarrierResult } from "@/lib/validations/carriers";

type SortKey = "score" | "totalCostMad" | "deliveryDaysMin";

interface ResultsListProps {
  results: CarrierResult[];
}

export function ResultsList({ results }: ResultsListProps) {
  const [sortKey, setSortKey] = useState<SortKey>("score");

  if (results.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No carriers available for this route and weight.
      </p>
    );
  }

  const sorted = [...results].sort((a, b) => {
    if (sortKey === "score")          return b.score - a.score;
    if (sortKey === "totalCostMad")   return a.totalCostMad - b.totalCostMad;
    if (sortKey === "deliveryDaysMin") return a.deliveryDaysMin - b.deliveryDaysMin;
    return 0;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Sort by:</span>
        {(["score", "totalCostMad", "deliveryDaysMin"] as SortKey[]).map((key) => (
          <Button
            key={key}
            size="sm"
            variant={sortKey === key ? "default" : "outline"}
            onClick={() => setSortKey(key)}
          >
            {key === "score" ? "Score" : key === "totalCostMad" ? "Price" : "Speed"}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((result, i) => (
          <CarrierResultCard key={result.carrierId} result={result} isTop={i === 0} />
        ))}
      </div>
    </div>
  );
}
```

---

## Task 13: Compare page

**Files:**
- Create: `src/app/(dashboard)/compare/page.tsx`

**Step 1: Create the page shell**

```tsx
import { ComparePageClient } from "./compare-page-client";

export default function ComparePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Compare Carriers</h1>
        <p className="text-muted-foreground">
          Enter your shipment details to find the best carrier.
        </p>
      </div>
      <ComparePageClient />
    </div>
  );
}
```

**Step 2: Create the client wrapper**

Create `src/app/(dashboard)/compare/compare-page-client.tsx`:

```tsx
"use client";

import { useState } from "react";
import { CompareForm } from "@/components/compare/compare-form";
import { ResultsList } from "@/components/compare/results-list";
import { useCompare } from "@/hooks/use-compare";
import type { CarrierResult } from "@/lib/validations/carriers";

export function ComparePageClient() {
  const [results, setResults] = useState<CarrierResult[] | null>(null);
  const compare = useCompare();

  return (
    <div className="space-y-8">
      <CompareForm
        isLoading={compare.isPending}
        onSubmit={(data) => {
          compare.mutate(data, {
            onSuccess: (res) => setResults(res.results),
          });
        }}
      />

      {compare.isError && (
        <p className="text-sm text-destructive">
          {(compare.error as { field?: string; error?: string })?.field === "destinationCity"
            ? "Destination city not found. Try a major Moroccan city."
            : "Something went wrong. Please try again."}
        </p>
      )}

      {results !== null && <ResultsList results={results} />}
    </div>
  );
}
```

---

## Task 14: Navigation — add Compare link to dashboard sidebar

**Files:**
- Modify: whichever file contains the dashboard navigation links (check `src/app/(dashboard)/layout.tsx` or a sidebar component)

**Step 1: Find the sidebar**

```bash
grep -r "shipments\|carriers\|admin" src/app/\(dashboard\) --include="*.tsx" -l
```

**Step 2: Add the Compare link**

Add a link with `href="/compare"` and label "Compare" alongside the existing dashboard nav items.

---

## Task 15: Tests — comparison service unit tests

**Files:**
- Create: `src/lib/services/__tests__/comparison.test.ts`

**Step 1: Write unit tests**

Test the scoring/normalization logic in isolation by mocking the DB and `cityToZoneCode`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB and city lookup before importing the service
vi.mock("@/lib/db", () => ({ db: { query: { carriers: { findMany: vi.fn() } } } }));
vi.mock("@/lib/carriers/city-zones", () => ({
  cityToZoneCode: (city: string) => (city === "casablanca" ? "ZA" : undefined),
}));

import { compareCarriers } from "@/lib/services/comparison";
import { db } from "@/lib/db";

describe("compareCarriers", () => {
  it("returns CITY_NOT_FOUND error for unknown destination", async () => {
    const result = await compareCarriers({
      originCity: "casablanca",
      destinationCity: "unknown-city",
      weightG: 500,
      codAmountMad: 15000,
      mode: "balanced",
    });
    expect(result).toEqual({ error: { code: "CITY_NOT_FOUND", field: "destinationCity" } });
  });

  it("returns empty results when no carriers cover zone", async () => {
    vi.mocked(db.query.carriers.findMany).mockResolvedValue([]);
    const result = await compareCarriers({
      originCity: "casablanca",
      destinationCity: "casablanca",
      weightG: 500,
      codAmountMad: 0,
      mode: "balanced",
    });
    expect("results" in result && result.results).toEqual([]);
  });

  it("ranks cheapest carrier first in cheapest mode", async () => {
    vi.mocked(db.query.carriers.findMany).mockResolvedValue([
      {
        id: "1", name: "Carrier A", logoUrl: null, isActive: true,
        reliabilityScore: 80, slug: "a", createdAt: new Date(), updatedAt: new Date(),
        zones: [{
          id: "z1", carrierId: "1", zoneName: "ZA", zoneCode: "ZA", createdAt: new Date(),
          pricing: [{ id: "p1", zoneId: "z1", weightMinG: 0, weightMaxG: null,
            priceMad: 3000, codFeeMad: null, codFeePercent: null,
            deliveryDaysMin: 3, deliveryDaysMax: 5, createdAt: new Date() }],
        }],
      },
      {
        id: "2", name: "Carrier B", logoUrl: null, isActive: true,
        reliabilityScore: 90, slug: "b", createdAt: new Date(), updatedAt: new Date(),
        zones: [{
          id: "z2", carrierId: "2", zoneName: "ZA", zoneCode: "ZA", createdAt: new Date(),
          pricing: [{ id: "p2", zoneId: "z2", weightMinG: 0, weightMaxG: null,
            priceMad: 5000, codFeeMad: null, codFeePercent: null,
            deliveryDaysMin: 1, deliveryDaysMax: 1, createdAt: new Date() }],
        }],
      },
    ] as never);

    const result = await compareCarriers({
      originCity: "casablanca", destinationCity: "casablanca",
      weightG: 500, codAmountMad: 0, mode: "cheapest",
    });

    expect("results" in result).toBe(true);
    if ("results" in result) {
      expect(result.results[0].name).toBe("Carrier A"); // cheapest wins
    }
  });
});
```

**Step 2: Run tests**

```bash
pnpm test
```

Expected: all existing 71 tests pass + 3 new comparison tests pass.

---

## Task 16: Final verification

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Expected: No TypeScript errors, no ESLint errors, production build succeeds.

**Manual smoke test:**
1. Run `pnpm dev`
2. Sign in as any non-admin user
3. Navigate to `/compare`
4. Enter: From "Casablanca", To "Marrakech", Weight 500g, COD 15000, mode Balanced
5. Click "Compare Carriers"
6. Verify: results cards appear, sorted by score, "Book Now" buttons disabled
7. Click Sort by "Price" → cards reorder client-side without network request
8. Sign in as admin, go to `/admin/carriers`, edit a carrier → verify "Reliability Score" field appears
