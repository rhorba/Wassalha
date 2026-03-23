"use client";

import { useState } from "react";
import { CompareForm } from "@/components/compare/compare-form";
import { ResultsList } from "@/components/compare/results-list";
import { useCompare } from "@/hooks/use-compare";
import { useUserProfile } from "@/hooks/use-user-profile";
import type { CarrierResult, UnavailableCarrier, CompareInput } from "@/lib/validations/carriers";

export function ComparePageClient() {
  const [results, setResults]           = useState<CarrierResult[] | null>(null);
  const [unavailable, setUnavailable]   = useState<UnavailableCarrier[]>([]);
  const [cityNotFound, setCityNotFound] = useState(false);
  const [lastInput, setLastInput]       = useState<CompareInput | null>(null);
  const compare                         = useCompare();
  const { data: profile }               = useUserProfile();

  return (
    <div className="space-y-8">
      <CompareForm
        isLoading={compare.isPending}
        defaultOriginCity={profile?.defaultSenderCity ?? undefined}
        onSubmit={(data) => {
          setCityNotFound(false);
          setLastInput(data);
          compare.mutate(data, {
            onSuccess: (res) => {
              setResults(res.results);
              setUnavailable(res.unavailable ?? []);
              setCityNotFound(res.cityNotFound ?? false);
            },
          });
        }}
      />

      {compare.isError && (
        <p className="text-sm text-destructive">Something went wrong. Please try again.</p>
      )}

      {cityNotFound && (
        <p className="text-sm text-muted-foreground">
          Destination city not recognized — please select a city from the autocomplete dropdown.
        </p>
      )}

      {results !== null && !cityNotFound && lastInput && (
        <ResultsList results={results} compareInput={lastInput} unavailable={unavailable} />
      )}
    </div>
  );
}
