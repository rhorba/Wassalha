"use client";

import { useState } from "react";
import { CompareForm } from "@/components/compare/compare-form";
import { ResultsList } from "@/components/compare/results-list";
import { useCompare } from "@/hooks/use-compare";
import type { CarrierResult } from "@/lib/validations/carriers";

export function ComparePageClient() {
  const [results, setResults] = useState<CarrierResult[] | null>(null);
  const [cityNotFound, setCityNotFound] = useState(false);
  const compare = useCompare();

  return (
    <div className="space-y-8">
      <CompareForm
        isLoading={compare.isPending}
        onSubmit={(data) => {
          setCityNotFound(false);
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

      {results !== null && !cityNotFound && <ResultsList results={results} />}
    </div>
  );
}
