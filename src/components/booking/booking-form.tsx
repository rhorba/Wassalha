"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BookingInputSchema, type BookingInput } from "@/lib/validations/shipments";
import type { CarrierResult, CompareInput } from "@/lib/validations/carriers";

interface BookingFormProps {
  carrier:      CarrierResult;
  compareInput: CompareInput;
  onSubmit:     (data: BookingInput) => void;
  isPending:    boolean;
}

export function BookingForm({
  carrier,
  compareInput,
  onSubmit,
  isPending,
}: BookingFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BookingInput>({
    resolver: zodResolver(BookingInputSchema),
    defaultValues: {
      carrierId:       carrier.carrierId,
      shippingCostMad: carrier.totalCostMad,
      mode:            compareInput.mode,
      originCity:      compareInput.originCity,
      recipientCity:   compareInput.destinationCity,
      codAmountMad:    compareInput.codAmountMad,
      weightG:         compareInput.weightG,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
      {/* Hidden fields — pre-filled from comparison */}
      <input type="hidden" {...register("carrierId")} />
      <input type="hidden" {...register("shippingCostMad", { valueAsNumber: true })} />
      <input type="hidden" {...register("mode")} />
      <input type="hidden" {...register("originCity")} />
      <input type="hidden" {...register("weightG", { valueAsNumber: true })} />
      <input type="hidden" {...register("codAmountMad", { valueAsNumber: true })} />

      {/* Recipient name */}
      <div className="space-y-1">
        <Label htmlFor="recipientName">Nom du destinataire</Label>
        <Input
          id="recipientName"
          placeholder="Mohammed Benali"
          {...register("recipientName")}
        />
        {errors.recipientName && (
          <p className="text-xs text-destructive">{errors.recipientName.message}</p>
        )}
      </div>

      {/* Recipient phone */}
      <div className="space-y-1">
        <Label htmlFor="recipientPhone">Téléphone</Label>
        <Input
          id="recipientPhone"
          placeholder="+212 6XX XXX XXX"
          type="tel"
          {...register("recipientPhone")}
        />
        {errors.recipientPhone && (
          <p className="text-xs text-destructive">{errors.recipientPhone.message}</p>
        )}
      </div>

      {/* Recipient city — read-only, pre-filled from comparison */}
      <div className="space-y-1">
        <Label htmlFor="recipientCity">Ville de destination</Label>
        <Input
          id="recipientCity"
          readOnly
          className="bg-muted cursor-not-allowed"
          {...register("recipientCity")}
        />
      </div>

      {/* Recipient address */}
      <div className="space-y-1">
        <Label htmlFor="recipientAddress">Adresse complète</Label>
        <Textarea
          id="recipientAddress"
          placeholder="12 Rue Ibn Battouta, Quartier Agdal"
          rows={3}
          {...register("recipientAddress")}
        />
        {errors.recipientAddress && (
          <p className="text-xs text-destructive">{errors.recipientAddress.message}</p>
        )}
      </div>

      {/* Parcel description (optional) */}
      <div className="space-y-1">
        <Label htmlFor="parcelDescription">
          Description du colis{" "}
          <span className="text-muted-foreground text-xs">(optionnel)</span>
        </Label>
        <Input
          id="parcelDescription"
          placeholder="Vêtements, électronique..."
          {...register("parcelDescription")}
        />
        {errors.parcelDescription && (
          <p className="text-xs text-destructive">{errors.parcelDescription.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Réservation en cours..." : "Confirmer la réservation"}
      </Button>
    </form>
  );
}
