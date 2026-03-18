"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateUserProfile } from "@/hooks/use-user-profile";

const schema = z.object({
  businessName: z.string().min(1, "Nom requis").max(100),
  phone:        z.string().transform(v => v.replace(/\s+/g, "")).pipe(z.string().regex(/^\+?[0-9]{9,15}$/, "Numéro invalide")),
});
type FormData = z.infer<typeof schema>;

interface StepBusinessProps { onNext: () => void; }

export function StepBusiness({ onNext }: StepBusinessProps) {
  const update = useUpdateUserProfile();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  function onSubmit(data: FormData) {
    update.mutate(data, { onSuccess: onNext });
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Votre entreprise</h1>
        <p className="text-sm text-zinc-500 mt-1">Étape 1 sur 3</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="businessName">Nom de l&apos;entreprise</Label>
          <Input id="businessName" placeholder="Mon Commerce" {...register("businessName")} />
          {errors.businessName && (
            <p className="text-xs text-destructive">{errors.businessName.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="phone">Téléphone</Label>
          <Input id="phone" type="tel" placeholder="+212 6XX XXX XXX" {...register("phone")} />
          {errors.phone && (
            <p className="text-xs text-destructive">{errors.phone.message}</p>
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
