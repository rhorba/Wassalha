"use client";

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
  const stars = Math.round((score / 100) * 5);
  return (
    <span className="text-sm text-muted-foreground" aria-label={`${stars} out of 5 stars`}>
      {"★".repeat(stars)}
      {"☆".repeat(5 - stars)}
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
        <Button asChild variant="default" className="w-full" disabled>
          <Link href={`/dashboard/shipments/new?carrierId=${result.carrierId}`}>
            Book Now →
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
