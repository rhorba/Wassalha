"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CreateZoneSchema,
  CreatePricingSchema,
  type CreateZoneInput,
  type CreatePricingInput,
} from "@/lib/validations/carriers";
import {
  useCreateZone,
  useDeleteZone,
  useCreatePricing,
  useDeletePricing,
} from "@/hooks/use-carriers";
import type { CarrierZone, CarrierPricing } from "@/lib/db/schema";

interface ZoneWithPricing extends CarrierZone {
  pricing: CarrierPricing[];
}

interface ZoneAccordionProps {
  carrierId: string;
  zones: ZoneWithPricing[];
}

export function ZoneAccordion({ carrierId, zones }: ZoneAccordionProps) {
  const createZone = useCreateZone(carrierId);
  const deleteZone = useDeleteZone(carrierId);
  const [showZoneForm, setShowZoneForm] = useState(false);

  const zoneForm = useForm<CreateZoneInput>({
    resolver: zodResolver(CreateZoneSchema),
  });

  const onCreateZone = async (data: CreateZoneInput) => {
    await createZone.mutateAsync(data);
    zoneForm.reset();
    setShowZoneForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Zones & Pricing</h3>
        <Button size="sm" variant="outline" onClick={() => setShowZoneForm(!showZoneForm)}>
          + Add Zone
        </Button>
      </div>

      {showZoneForm && (
        <form onSubmit={zoneForm.handleSubmit(onCreateZone)} className="flex gap-2 items-end">
          <div>
            <Label>Zone Name</Label>
            <Input {...zoneForm.register("zoneName")} placeholder="Grand Casablanca" />
          </div>
          <div>
            <Label>Zone Code</Label>
            <Input {...zoneForm.register("zoneCode")} placeholder="ZA" className="w-24" />
          </div>
          <Button type="submit" size="sm" disabled={createZone.isPending}>
            Add
          </Button>
        </form>
      )}

      <Accordion type="multiple" className="w-full">
        {zones.map((zone) => (
          <AccordionItem key={zone.id} value={zone.id}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <span className="font-medium">{zone.zoneName}</span>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {zone.zoneCode}
                </span>
                <span className="text-xs text-muted-foreground">
                  {zone.pricing.length} pricing row{zone.pricing.length !== 1 ? "s" : ""}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <PricingSection
                carrierId={carrierId}
                zone={zone}
                onDeleteZone={() => deleteZone.mutate(zone.id)}
              />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

interface PricingSectionProps {
  carrierId: string;
  zone: ZoneWithPricing;
  onDeleteZone: () => void;
}

function PricingSection({ carrierId, zone, onDeleteZone }: PricingSectionProps) {
  const createPricing = useCreatePricing(carrierId, zone.id);
  const deletePricing = useDeletePricing(carrierId, zone.id);
  const [showForm, setShowForm] = useState(false);

  const form = useForm<CreatePricingInput>({
    resolver: zodResolver(CreatePricingSchema),
  });

  const onSubmit = async (data: CreatePricingInput) => {
    await createPricing.mutateAsync(data);
    form.reset();
    setShowForm(false);
  };

  return (
    <div className="space-y-3 pt-2">
      {zone.pricing.map((row) => (
        <div key={row.id} className="flex items-center gap-4 text-sm bg-muted/50 rounded p-2">
          <span>
            {row.weightMinG}g – {row.weightMaxG ?? "∞"}g
          </span>
          <span className="font-medium">{(row.priceMad / 100).toFixed(2)} MAD</span>
          <span className="text-muted-foreground">
            {row.deliveryDaysMin}–{row.deliveryDaysMax} days
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-destructive"
            onClick={() => deletePricing.mutate(row.id)}
          >
            Remove
          </Button>
        </div>
      ))}

      {showForm ? (
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Min weight (g)</Label>
            <Input
              type="number"
              {...form.register("weightMinG", { valueAsNumber: true })}
            />
          </div>
          <div>
            <Label className="text-xs">Max weight (g, blank = ∞)</Label>
            <Input
              type="number"
              {...form.register("weightMaxG", { valueAsNumber: true })}
            />
          </div>
          <div>
            <Label className="text-xs">Price (centimes)</Label>
            <Input
              type="number"
              {...form.register("priceMad", { valueAsNumber: true })}
            />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div>
              <Label className="text-xs">Min days</Label>
              <Input
                type="number"
                {...form.register("deliveryDaysMin", { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label className="text-xs">Max days</Label>
              <Input
                type="number"
                {...form.register("deliveryDaysMax", { valueAsNumber: true })}
              />
            </div>
          </div>
          <div className="col-span-2 flex gap-2">
            <Button size="sm" type="submit" disabled={createPricing.isPending}>
              Add Row
            </Button>
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
          + Add Pricing Row
        </Button>
      )}

      <Button
        size="sm"
        variant="destructive"
        onClick={onDeleteZone}
        disabled={zone.pricing.length > 0}
        title={zone.pricing.length > 0 ? "Delete all pricing rows first" : undefined}
      >
        Delete Zone
      </Button>
    </div>
  );
}
