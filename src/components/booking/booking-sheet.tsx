"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BookingForm } from "./booking-form";
import { useCreateShipment } from "@/hooks/use-create-shipment";
import type { CarrierResult, CompareInput } from "@/lib/validations/carriers";
import type { BookingInput } from "@/lib/validations/shipments";
import Link from "next/link";

interface BookingSheetProps {
  carrier:      CarrierResult;
  compareInput: CompareInput;
  open:         boolean;
  onOpenChange: (open: boolean) => void;
}

type SuccessState = {
  trackingNumber: string;
  carrierName:    string;
  deliveryMin:    number;
  deliveryMax:    number;
  commissionMad:  number; // centimes
};

export function BookingSheet({
  carrier,
  compareInput,
  open,
  onOpenChange,
}: BookingSheetProps) {
  const [success, setSuccess]  = useState<SuccessState | null>(null);
  const createShipment         = useCreateShipment();

  function handleSubmit(data: BookingInput) {
    createShipment.mutate(data, {
      onSuccess: (res) => {
        setSuccess({
          trackingNumber: res.trackingNumber,
          carrierName:    carrier.name,
          deliveryMin:    carrier.deliveryDaysMin,
          deliveryMax:    carrier.deliveryDaysMax,
          // Approximate commission shown for transparency (10% shipping + 1.5% COD)
          commissionMad:
            Math.round(carrier.totalCostMad * 0.1) +
            Math.round(compareInput.codAmountMad * 0.015),
        });
      },
    });
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) setSuccess(null); // reset on close
    onOpenChange(isOpen);
  }

  const errorMessage =
    createShipment.isError &&
    createShipment.error &&
    typeof createShipment.error === "object" &&
    "error" in createShipment.error
      ? (createShipment.error as { error: { message: string } }).error.message
      : null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {/* Full-screen on mobile, side-panel (420px) on sm+ */}
      <SheetContent side="right" className="w-full sm:max-w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {success ? "Réservation confirmée ✓" : `Réserver avec ${carrier.name}`}
          </SheetTitle>
          {!success && (
            <SheetDescription>
              {(carrier.totalCostMad / 100).toFixed(2)} MAD ·{" "}
              {carrier.deliveryDaysMin === carrier.deliveryDaysMax
                ? `${carrier.deliveryDaysMin} jour(s)`
                : `${carrier.deliveryDaysMin}–${carrier.deliveryDaysMax} jours`}
            </SheetDescription>
          )}
        </SheetHeader>

        <Separator className="my-4" />

        {success ? (
          <div className="space-y-4 text-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Numéro de suivi</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">{success.trackingNumber}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void navigator.clipboard.writeText(success.trackingNumber)
                    }
                  >
                    Copier
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Transporteur</span>
                <span>{success.carrierName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Livraison estimée</span>
                <span>
                  {success.deliveryMin === success.deliveryMax
                    ? `${success.deliveryMin} jour(s)`
                    : `${success.deliveryMin}–${success.deliveryMax} jours`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Commission Wassalha</span>
                <span>{(success.commissionMad / 100).toFixed(2)} MAD</span>
              </div>
            </div>

            <Separator />

            <Button asChild className="w-full">
              <Link href="/shipments">Voir tous mes envois →</Link>
            </Button>
          </div>
        ) : (
          <>
            {errorMessage && (
              <p className="mb-4 text-sm text-destructive">{errorMessage}</p>
            )}
            <BookingForm
              carrier={carrier}
              compareInput={compareInput}
              onSubmit={handleSubmit}
              isPending={createShipment.isPending}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
