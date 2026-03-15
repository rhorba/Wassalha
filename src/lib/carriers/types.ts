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

// All carrier adapters implement this interface
export interface CarrierAdapter {
  slug: string;
  createShipment(input: CreateShipmentInput): Promise<CarrierShipmentResult>;
  // getTrackingStatus() deferred to Phase 5
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
