"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressAutocomplete } from "@/components/forms/address-autocomplete";
import { useUpdateUserProfile } from "@/hooks/use-user-profile";

const schema = z.object({
  defaultSenderAddress: z.string().min(5, "Adresse trop courte").max(300),
  defaultSenderCity:    z.string().min(2, "Ville requise"),
});
type FormData = z.infer<typeof schema>;

interface StepAddressProps { onNext: () => void; }

export function StepAddress({ onNext }: StepAddressProps) {
  const update = useUpdateUserProfile();
  const [address, setAddress] = useState("");
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  function onSubmit(data: FormData) {
    update.mutate(data, { onSuccess: onNext });
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Adresse d&apos;expédition</h1>
        <p className="text-sm text-zinc-500 mt-1">Étape 2 sur 3 — pré-remplie à chaque réservation</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <Label>Adresse complète</Label>
          <AddressAutocomplete
            value={address}
            placeholder="12 Rue Ibn Battouta, Casablanca"
            onChange={(val) => {
              setAddress(val.address);
              setValue("defaultSenderAddress", val.address, { shouldValidate: true });
            }}
          />
          {errors.defaultSenderAddress && (
            <p className="text-xs text-destructive">{errors.defaultSenderAddress.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="defaultSenderCity">Ville</Label>
          <Input
            id="defaultSenderCity"
            placeholder="Casablanca"
            {...register("defaultSenderCity")}
          />
          {errors.defaultSenderCity && (
            <p className="text-xs text-destructive">{errors.defaultSenderCity.message}</p>
          )}
        </div>

        {update.isError && (
          <p className="text-sm text-destructive">Erreur — réessayez.</p>
        )}

        <Button type="submit" className="w-full" disabled={update.isPending}>
          {update.isPending ? "Enregistrement..." : "Continuer →"}
        </Button>
      </form>
    </div>
  );
}
