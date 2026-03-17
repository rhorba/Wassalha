"use client";

import { useTrackingEvents } from "@/hooks/use-tracking-events";
import { useShipmentStatus } from "@/hooks/use-shipment-status";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import type { TrackingEvent, Shipment } from "@/lib/db/schema";

const ORDERED_STATUSES: Shipment["status"][] = [
  "confirmed",
  "picked_up",
  "in_transit",
  "delivered",
];

function formatDate(date: Date | string) {
  return new Date(date).toLocaleString("fr-MA", {
    day:    "2-digit",
    month:  "short",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

interface TrackingTimelineProps {
  shipment:      Pick<Shipment, "id" | "status">;
  initialEvents: TrackingEvent[];
}

export function TrackingTimeline({ shipment, initialEvents }: TrackingTimelineProps) {
  const events = useTrackingEvents(shipment.id, initialEvents);
  const status = useShipmentStatus(shipment.id, shipment.status);

  const eventByStatus = new Map<string, TrackingEvent>();
  for (const e of events) {
    eventByStatus.set(e.status, e);
  }

  const currentIndex = ORDERED_STATUSES.indexOf(status as Shipment["status"]);

  return (
    <div data-testid="tracking-timeline" className="flex flex-col gap-0">
      {ORDERED_STATUSES.map((status, index) => {
        const isDone    = index < currentIndex || (index === currentIndex && status === "delivered");
        const isCurrent = index === currentIndex && status !== "delivered";
        const event     = eventByStatus.get(status);

        return (
          <div key={status} className="flex gap-3">
            {/* Icon column */}
            <div className="flex flex-col items-center">
              <div className="mt-1">
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : isCurrent ? (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-300" />
                )}
              </div>
              {index < ORDERED_STATUSES.length - 1 && (
                <div className={`mt-1 h-8 w-px ${isDone ? "bg-green-300" : "bg-gray-200"}`} />
              )}
            </div>

            {/* Content column */}
            <div className="pb-6">
              <p className={`text-sm font-medium capitalize ${isDone || isCurrent ? "text-gray-900" : "text-gray-400"}`}>
                {status.replace("_", " ")}
              </p>
              {event ? (
                <>
                  <p className="text-xs text-gray-500">{formatDate(event.occurredAt)}</p>
                  {event.location    && <p className="text-xs text-gray-500">— {event.location}</p>}
                  {event.description && <p className="mt-0.5 text-xs text-gray-400">{event.description}</p>}
                </>
              ) : (
                <p className="text-xs text-gray-400">—</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
