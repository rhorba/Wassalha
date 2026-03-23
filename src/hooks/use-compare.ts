"use client";

import { useMutation } from "@tanstack/react-query";
import type { CompareInput, CarrierResult, UnavailableCarrier } from "@/lib/validations/carriers";

type CompareResponse = {
  results:      CarrierResult[];
  unavailable:  UnavailableCarrier[];
  cityNotFound?: boolean;
};

export function useCompare() {
  return useMutation<CompareResponse, Error, CompareInput>({
    mutationFn: async (data) => {
      const res = await fetch("/api/carriers/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw await res.json();
      return res.json() as Promise<CompareResponse>;
    },
  });
}
