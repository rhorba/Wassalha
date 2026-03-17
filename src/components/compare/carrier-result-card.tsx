"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookingSheet } from "@/components/booking/booking-sheet";
import type { CarrierResult, CompareInput } from "@/lib/validations/carriers";

interface CarrierResultCardProps {
  result:       CarrierResult;
  isTop:        boolean;
  compareInput: CompareInput;
}

function StarRating({ score }: { score: number }) {
  const stars = Math.round((score / 100) * 5);
  return (
    <span className="text-sm text-muted-foreground" aria-label={`${stars} out of 5 stars`}>
      {"★".repeat(stars)}
      {"☆".repeat(5 - stars)}
    </span>
  );
}

export function CarrierResultCard({ result, isTop, compareInput }: CarrierResultCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const costMad = (result.totalCostMad / 100).toFixed(2);

  return (
    <>
      <Card data-testid="carrier-result-card" className="relative">
        {isTop && (
          <Badge className="absolute top-3 right-3" variant="default">
            Best Match
          </Badge>
        )}
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            {result.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.logoUrl}
                alt={result.name}
                className="h-8 w-auto object-contain"
              />
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
          <Button
            variant="default"
            className="w-full"
            onClick={() => setSheetOpen(true)}
          >
            Réserver →
          </Button>
        </CardContent>
      </Card>

      <BookingSheet
        carrier={result}
        compareInput={compareInput}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
