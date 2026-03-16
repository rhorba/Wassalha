"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateRangePickerProps {
  from:         Date;
  to:           Date;
  onFromChange: (d: Date) => void;
  onToChange:   (d: Date) => void;
}

export function DateRangePicker({ from, to, onFromChange, onToChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarIcon className="h-4 w-4" />
          {format(from, "dd/MM/yyyy")} – {format(to, "dd/MM/yyyy")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex gap-4 p-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1 font-medium">Début</p>
            <Calendar
              mode="single"
              selected={from}
              onSelect={(d) => { if (d) { onFromChange(d); } }}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1 font-medium">Fin</p>
            <Calendar
              mode="single"
              selected={to}
              onSelect={(d) => { if (d) { onToChange(d); setOpen(false); } }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
