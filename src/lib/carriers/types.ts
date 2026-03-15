import type { shipmentStatusEnum } from "@/lib/db/schema";

type ShipmentStatus = (typeof shipmentStatusEnum.enumValues)[number];

// Unified input for all carrier shipment creation calls
export interface CreateShipmentInput {
  recipientName:     string;
  recipientPhone:    string;
  recipientCity:     string;
  recipientAddress:  string;
  originCity:        string;
  weightG:           number;
  codAmountMad:      number;       // centimes
  parcelDescription?: string;
}

// Normalized response from any carrier API
export interface CarrierShipmentResult {
  trackingNumber:    string;
  carrierReference?: string;
  labelUrl?:         string;       // PDF waybill URL, if carrier provides it
}

// Normalized tracking event from any carrier API
export interface TrackingEvent {
  carrierRawStatus: string;
  status:           ShipmentStatus;
  location?:        string;
  description?:     string;
  occurredAt:       Date;
}

// All carrier adapters implement this interface
export interface CarrierAdapter {
  slug: string;
  createShipment(input: CreateShipmentInput): Promise<CarrierShipmentResult>;
  getTrackingStatus(trackingNumber: string): Promise<TrackingEvent[]>;
}

// Thrown by adapters on carrier API failure — caught by booking service
export class CarrierApiError extends Error {
  constructor(
    public readonly code:
      | "AUTH_FAILED"
      | "INVALID_ADDRESS"
      | "SERVICE_UNAVAILABLE"
      | "UNKNOWN",
    message: string,
  ) {
    super(message);
    this.name = "CarrierApiError";
  }
}
