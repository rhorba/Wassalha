"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CompareInput } from "@/lib/validations/carriers";

type Mode = CompareInput["mode"];

interface ModeToggleProps {
  value: Mode;
  onChange: (value: Mode) => void;
}

export function ModeToggle({ value, onChange }: ModeToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as Mode);
      }}
      className="justify-start"
    >
      <ToggleGroupItem value="cheapest">Cheapest</ToggleGroupItem>
      <ToggleGroupItem value="balanced">Balanced</ToggleGroupItem>
      <ToggleGroupItem value="fastest">Fastest</ToggleGroupItem>
    </ToggleGroup>
  );
}
