"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { TrackingEvent } from "@/lib/db/schema";

export function useTrackingEvents(
  shipmentId:    string,
  initialEvents: TrackingEvent[],
): TrackingEvent[] {
  const [events, setEvents] = useState<TrackingEvent[]>(initialEvents);

  useEffect(() => {
    const channel = supabase
      .channel(`tracking-events:${shipmentId}`)
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "tracking_events",
          filter: `shipment_id=eq.${shipmentId}`,
        },
        (payload) => {
          const raw = payload.new as Record<string, unknown>;
          const event: TrackingEvent = {
            id:               raw.id               as string,
            shipmentId:       raw.shipment_id       as string,
            status:           raw.status            as TrackingEvent["status"],
            carrierRawStatus: raw.carrier_raw_status as string,
            location:         raw.location          as string | null,
            description:      raw.description       as string | null,
            source:           raw.source            as string,
            occurredAt:       new Date(raw.occurred_at as string),
            createdAt:        new Date(raw.created_at  as string),
          };
          setEvents((prev) => [...prev, event]);
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [shipmentId]);

  return [...events].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
}
