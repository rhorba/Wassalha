"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CarrierResultCard } from "@/components/compare/carrier-result-card";
import type { CarrierResult, CompareInput } from "@/lib/validations/carriers";

type SortKey = "score" | "totalCostMad" | "deliveryDaysMin";

interface ResultsListProps {
  results:      CarrierResult[];
  compareInput: CompareInput;
}

export function ResultsList({ results, compareInput }: ResultsListProps) {
  const [sortKey, setSortKey] = useState<SortKey>("score");

  if (results.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No carriers available for this route and weight.
      </p>
    );
  }

  const sorted = [...results].sort((a, b) => {
    if (sortKey === "score")           return b.score - a.score;
    if (sortKey === "totalCostMad")    return a.totalCostMad - b.totalCostMad;
    if (sortKey === "deliveryDaysMin") return a.deliveryDaysMin - b.deliveryDaysMin;
    return 0;
  });

  const sortLabels: Record<SortKey, string> = {
    score:           "Score",
    totalCostMad:    "Price",
    deliveryDaysMin: "Speed",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Sort by:</span>
        {(Object.keys(sortLabels) as SortKey[]).map((key) => (
          <Button
            key={key}
            size="sm"
            variant={sortKey === key ? "default" : "outline"}
            onClick={() => setSortKey(key)}
          >
            {sortLabels[key]}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((result, i) => (
          <CarrierResultCard
            key={result.carrierId}
            result={result}
            isTop={i === 0}
            compareInput={compareInput}
          />
        ))}
      </div>
    </div>
  );
}
