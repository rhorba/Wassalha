"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CreateCarrierInput,
  UpdateCarrierInput,
  CreateZoneInput,
  CreatePricingInput,
} from "@/lib/validations/carriers";

// ── Carrier mutations ─────────────────────────────────────────────────────────

export function useCreateCarrier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateCarrierInput) => {
      const res = await fetch("/api/carriers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["carriers"] }),
  });
}

export function useUpdateCarrier(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateCarrierInput) => {
      const res = await fetch(`/api/carriers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["carriers"] });
      qc.invalidateQueries({ queryKey: ["carrier", id] });
    },
  });
}

export function useDeleteCarrier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/carriers/${id}`, { method: "DELETE" });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["carriers"] }),
  });
}

// ── Zone mutations ────────────────────────────────────────────────────────────

export function useCreateZone(carrierId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateZoneInput) => {
      const res = await fetch(`/api/carriers/${carrierId}/zones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["carrier", carrierId] }),
  });
}

export function useDeleteZone(carrierId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (zoneId: string) => {
      const res = await fetch(`/api/carriers/${carrierId}/zones/${zoneId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["carrier", carrierId] }),
  });
}

// ── Pricing mutations ─────────────────────────────────────────────────────────

export function useCreatePricing(carrierId: string, zoneId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePricingInput) => {
      const res = await fetch(
        `/api/carriers/${carrierId}/zones/${zoneId}/pricing`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["carrier", carrierId] }),
  });
}

export function useDeletePricing(carrierId: string, zoneId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pricingId: string) => {
      const res = await fetch(
        `/api/carriers/${carrierId}/zones/${zoneId}/pricing/${pricingId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["carrier", carrierId] }),
  });
}
