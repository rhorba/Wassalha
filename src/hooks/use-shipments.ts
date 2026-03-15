"use client";

import { useQuery } from "@tanstack/react-query";
import type { ShipmentsListResponse } from "@/lib/validations/shipments";

export function useShipments(page = 1, pageSize = 20) {
  return useQuery<ShipmentsListResponse>({
    queryKey: ["shipments", page, pageSize],
    queryFn:  async () => {
      const res = await fetch(`/api/shipments?page=${page}&pageSize=${pageSize}`);
      if (!res.ok) throw new Error("Failed to fetch shipments");
      return res.json() as Promise<ShipmentsListResponse>;
    },
  });
}
