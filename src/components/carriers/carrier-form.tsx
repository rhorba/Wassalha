"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreateCarrierSchema, type CreateCarrierInput } from "@/lib/validations/carriers";
import { useCreateCarrier, useUpdateCarrier } from "@/hooks/use-carriers";
import type { Carrier } from "@/lib/db/schema";

interface CarrierFormProps {
  carrier?: Carrier; // if provided → edit mode
}

export function CarrierForm({ carrier }: CarrierFormProps) {
  const router = useRouter();
  const createCarrier = useCreateCarrier();
  const updateCarrier = useUpdateCarrier(carrier?.id ?? "");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateCarrierInput>({
    resolver: zodResolver(CreateCarrierSchema),
    defaultValues: carrier
      ? { name: carrier.name, slug: carrier.slug, logoUrl: carrier.logoUrl ?? undefined }
      : undefined,
  });

  const onSubmit = async (data: CreateCarrierInput) => {
    if (carrier) {
      await updateCarrier.mutateAsync(data);
    } else {
      await createCarrier.mutateAsync(data);
    }
    router.push("/admin/carriers");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register("name")} placeholder="Amana" />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="slug">Slug</Label>
        <Input id="slug" {...register("slug")} placeholder="amana" />
        {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="logoUrl">Logo URL (optional)</Label>
        <Input id="logoUrl" {...register("logoUrl")} placeholder="https://..." />
        {errors.logoUrl && <p className="text-sm text-destructive">{errors.logoUrl.message}</p>}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {carrier ? "Update Carrier" : "Create Carrier"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
