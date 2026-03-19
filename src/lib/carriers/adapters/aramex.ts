import type { CarrierAdapter, CreateShipmentInput, CarrierShipmentResult, TrackingEvent } from "../types";
import { CarrierApiError } from "../types";

// Map Aramex UpdateCode → our shipment status enum
const STATUS_MAP: Record<string, "confirmed" | "picked_up" | "in_transit" | "delivered" | "failed"> = {
  "SH005": "picked_up",
  "SH006": "delivered",
  "SH009": "failed",
  "SH010": "in_transit",
  "SH011": "in_transit",
  "SH014": "failed",
};

export class AramexAdapter implements CarrierAdapter {
  readonly slug = "aramex";

  private readonly baseUrl       = process.env.ARAMEX_API_URL       ?? "";
  private readonly username      = process.env.ARAMEX_USERNAME       ?? "";
  private readonly password      = process.env.ARAMEX_PASSWORD       ?? "";
  private readonly accountNumber = process.env.ARAMEX_ACCOUNT_NUMBER ?? "";
  private readonly accountPin    = process.env.ARAMEX_ACCOUNT_PIN    ?? "";

  async createShipment(input: CreateShipmentInput): Promise<CarrierShipmentResult> {
    if (!this.baseUrl || !this.username) {
      throw new CarrierApiError("SERVICE_UNAVAILABLE", "Aramex: credentials not configured");
    }
    const res = await fetch(`${this.baseUrl}/v1/shipping/shipments/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ClientInfo: {
          UserName:      this.username,
          Password:      this.password,
          AccountNumber: this.accountNumber,
          AccountPin:    this.accountPin,
        },
        Shipments: [
          {
            Consignee: {
              PartyName:    input.recipientName,
              PhoneNumber1: input.recipientPhone,
              City:         input.recipientCity,
              Line1:        input.recipientAddress,
              CountryCode:  "MA",
            },
            ShipmentDetails: {
              WeightUnit:         "G",
              Weight:             input.weightG,
              CashOnDeliveryAmount: {
                Value:        input.codAmountMad / 100,
                CurrencyCode: "MAD",
              },
              DescriptionOfGoods: input.parcelDescription ?? "Merchandise",
            },
          },
        ],
      }),
    });

    if (res.status === 401) throw new CarrierApiError("AUTH_FAILED", "Aramex: authentication failed");
    if (!res.ok)            throw new CarrierApiError("SERVICE_UNAVAILABLE", `Aramex: HTTP ${res.status}`);

    const data = (await res.json()) as {
      ProcessedShipment?: { ID: string; ForeignHAWB: string; LabelURL: string };
      HasErrors: boolean;
    };
    if (data.HasErrors || !data.ProcessedShipment) {
      throw new CarrierApiError("UNKNOWN", "Aramex: shipment creation failed");
    }
    return {
      trackingNumber:   data.ProcessedShipment.ID,
      carrierReference: data.ProcessedShipment.ForeignHAWB,
      labelUrl:         data.ProcessedShipment.LabelURL,
    };
  }

  async getTrackingStatus(trackingNumber: string): Promise<TrackingEvent[]> {
    if (!this.baseUrl || !this.username) {
      throw new CarrierApiError("SERVICE_UNAVAILABLE", "Aramex: credentials not configured");
    }

    const res = await fetch(`${this.baseUrl}/v1/tracking/shipments/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ClientInfo: {
          UserName:      this.username,
          Password:      this.password,
          AccountNumber: this.accountNumber,
          AccountPin:    this.accountPin,
        },
        Shipments: [{ ID: trackingNumber }],
      }),
    });

    if (res.status === 401) throw new CarrierApiError("AUTH_FAILED", "Aramex: authentication failed");
    if (!res.ok)            throw new CarrierApiError("SERVICE_UNAVAILABLE", `Aramex: HTTP ${res.status}`);

    const data = (await res.json()) as {
      TrackingResults?: Array<{
        Value?: Array<{
          UpdateCode:        string;
          UpdateDescription: string;
          UpdateDateTime:    string;
          UpdateLocation?:   string;
        }>;
      }>;
      HasErrors: boolean;
    };

    if (data.HasErrors || !data.TrackingResults?.[0]?.Value) return [];

    return data.TrackingResults[0].Value.map((event) => ({
      carrierRawStatus: event.UpdateCode,
      status:           STATUS_MAP[event.UpdateCode] ?? "in_transit",
      location:         event.UpdateLocation ?? undefined,
      description:      event.UpdateDescription ?? undefined,
      occurredAt:       new Date(event.UpdateDateTime),
    }));
  }
}
