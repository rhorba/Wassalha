"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { BookingInput } from "@/lib/validations/shipments";
import type { Shipment } from "@/lib/db/schema";

type CreateShipmentResponse = {
  shipment:       Shipment;
  trackingNumber: string;
};

type CarrierApiErrorResponse = {
  error: { code: string; message: string };
};

export function useCreateShipment() {
  const queryClient = useQueryClient();

  return useMutation<CreateShipmentResponse, CarrierApiErrorResponse, BookingInput>({
    mutationFn: async (input) => {
      const res = await fetch("/api/shipments", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(input),
      });
      const data = (await res.json()) as CreateShipmentResponse | CarrierApiErrorResponse;
      if (!res.ok) throw data as CarrierApiErrorResponse;
      return data as CreateShipmentResponse;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["shipments"] });
    },
  });
}
