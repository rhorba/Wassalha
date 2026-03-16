"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModeToggle } from "@/components/compare/mode-toggle";
import { CityAutocomplete } from "@/components/compare/city-autocomplete";
import { CompareInputSchema, type CompareInput } from "@/lib/validations/carriers";

interface CompareFormProps {
  onSubmit:          (data: CompareInput) => void;
  isLoading:         boolean;
  defaultOriginCity?: string;
}

export function CompareForm({ onSubmit, isLoading, defaultOriginCity }: CompareFormProps) {
  // Track displayed city names separately so we can show them under the input
  const [originLabel, setOriginLabel] = useState("");
  const [destLabel, setDestLabel] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<CompareInput>({
    resolver: zodResolver(CompareInputSchema),
    defaultValues: { mode: "balanced", codAmountMad: 0 },
  });

  // Pre-fill origin city from user's saved default
  useEffect(() => {
    if (defaultOriginCity) {
      setValue("originCity", defaultOriginCity, { shouldValidate: false });
      setOriginLabel(defaultOriginCity);
    }
  }, [defaultOriginCity, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="originCity">From city</Label>
          <CityAutocomplete
            id="originCity"
            placeholder="Casablanca"
            onChange={(cityName) => {
              setOriginLabel(cityName);
              setValue("originCity", cityName, { shouldValidate: true });
            }}
          />
          {originLabel && (
            <p className="text-xs text-muted-foreground">Recognized: {originLabel}</p>
          )}
          {errors.originCity && (
            <p className="text-sm text-destructive">{errors.originCity.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="destinationCity">To city</Label>
          <CityAutocomplete
            id="destinationCity"
            placeholder="Marrakech"
            onChange={(cityName) => {
              setDestLabel(cityName);
              setValue("destinationCity", cityName, { shouldValidate: true });
            }}
          />
          {destLabel && (
            <p className="text-xs text-muted-foreground">Recognized: {destLabel}</p>
          )}
          {errors.destinationCity && (
            <p className="text-sm text-destructive">{errors.destinationCity.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="weightG">Weight (grams)</Label>
          <Input
            id="weightG"
            type="number"
            {...register("weightG", { valueAsNumber: true })}
            placeholder="500"
          />
          {errors.weightG && (
            <p className="text-sm text-destructive">{errors.weightG.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="codAmountMad">COD Amount (centimes)</Label>
          <Input
            id="codAmountMad"
            type="number"
            {...register("codAmountMad", { valueAsNumber: true })}
            placeholder="15000"
          />
          {errors.codAmountMad && (
            <p className="text-sm text-destructive">{errors.codAmountMad.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label>Priority</Label>
        <Controller
          name="mode"
          control={control}
          render={({ field }) => (
            <ModeToggle value={field.value} onChange={field.onChange} />
          )}
        />
      </div>

      <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
        {isLoading ? "Comparing..." : "Compare Carriers"}
      </Button>
    </form>
  );
}
