"use client";

import { useState } from "react";
import { CompareForm } from "@/components/compare/compare-form";
import { ResultsList } from "@/components/compare/results-list";
import { useCompare } from "@/hooks/use-compare";
import type { CarrierResult, CompareInput } from "@/lib/validations/carriers";

export function ComparePageClient() {
  const [results, setResults]           = useState<CarrierResult[] | null>(null);
  const [cityNotFound, setCityNotFound] = useState(false);
  const [lastInput, setLastInput]       = useState<CompareInput | null>(null);
  const compare = useCompare();

  return (
    <div className="space-y-8">
      <CompareForm
        isLoading={compare.isPending}
        onSubmit={(data) => {
          setCityNotFound(false);
          setLastInput(data);
          compare.mutate(data, {
            onSuccess: (res) => {
              setResults(res.results);
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
        <ResultsList results={results} compareInput={lastInput} />
      )}
    </div>
  );
}
