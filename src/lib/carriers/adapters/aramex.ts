import { callAramex, buildClientInfo } from "../aramex-soap";
import { CarrierApiError } from "../types";
import type {
  CarrierAdapter,
  CreateShipmentInput,
  CarrierShipmentResult,
  TrackingEvent,
} from "../types";

// ── Endpoints ────────────────────────────────────────────────────────────────
const SHIPPING_ENDPOINT =
  "https://ws.aramex.net/shippingapi/shipping/service_1_0.svc";
const TRACKING_ENDPOINT =
  "http://ws.aramex.net/shippingapi/tracking/service_1_0.svc";
const RATE_ENDPOINT =
  "http://ws.staging.aramex.net/ratecalculator/service_1_0.svc";

// ── Status code map ───────────────────────────────────────────────────────────
const STATUS_MAP: Record<
  string,
  "confirmed" | "picked_up" | "in_transit" | "delivered" | "failed"
> = {
  SH001: "confirmed",  // Shipment Booked
  SH003: "confirmed",  // Shipment Data Received
  SH005: "picked_up",  // Shipment Picked Up
  SH006: "delivered",  // Shipment Delivered
  SH009: "failed",     // Delivery Failed
  SH010: "in_transit", // In Transit
  SH011: "in_transit", // Out for Delivery
  SH012: "in_transit", // Arrived at Destination
  SH013: "in_transit", // Customs Clearance
  SH014: "failed",     // Return to Shipper
  SH015: "failed",     // Shipment Cancelled
  SH016: "in_transit", // On Hold
  SH017: "in_transit", // Address Correction
  SH018: "in_transit", // Attempted Delivery
  SH019: "in_transit", // Awaiting Customer Collection
  SH020: "in_transit", // Transferred to Partner
  SH021: "in_transit", // Received at Origin Station
  SH022: "in_transit", // Departed Origin Station
  SH023: "in_transit", // Arrived at Hub
  SH024: "in_transit", // Departed Hub
  SH025: "in_transit", // Arrived at Destination Station
  SH026: "in_transit", // Customs Hold
  SH027: "failed",     // Lost
  SH028: "in_transit", // Delayed
  SH029: "in_transit", // Misrouted
  SH030: "in_transit", // Received at Delivery Station
  SH034: "in_transit", // In Transit to Hub
};

// ── Adapter ───────────────────────────────────────────────────────────────────
export class AramexAdapter implements CarrierAdapter {
  readonly slug = "aramex";

  async createShipment(input: CreateShipmentInput): Promise<CarrierShipmentResult> {
    const xml = `
      <v1:ShipmentCreationRequest>
        ${buildClientInfo()}
        <v1:Transaction><v1:Reference1>book-${Date.now()}</v1:Reference1></v1:Transaction>
        <v1:Shipments>
          <v1:Shipment>
            <v1:Shipper>
              <v1:Reference1>${process.env.ARAMEX_ACCOUNT_NUMBER ?? ""}</v1:Reference1>
              <v1:AccountNumber>${process.env.ARAMEX_ACCOUNT_NUMBER ?? ""}</v1:AccountNumber>
              <v1:PartyAddress>
                <v1:City>${input.originCity}</v1:City>
                <v1:CountryCode>MA</v1:CountryCode>
              </v1:PartyAddress>
              <v1:Contact>
                <v1:PersonName>Wassalha Sender</v1:PersonName>
                <v1:PhoneNumber1>0600000000</v1:PhoneNumber1>
                <v1:EmailAddress>ops@wassalha.ma</v1:EmailAddress>
              </v1:Contact>
            </v1:Shipper>
            <v1:Consignee>
              <v1:PartyAddress>
                <v1:Line1>${input.recipientAddress}</v1:Line1>
                <v1:City>${input.recipientCity}</v1:City>
                <v1:CountryCode>MA</v1:CountryCode>
              </v1:PartyAddress>
              <v1:Contact>
                <v1:PersonName>${input.recipientName}</v1:PersonName>
                <v1:PhoneNumber1>${input.recipientPhone}</v1:PhoneNumber1>
              </v1:Contact>
            </v1:Consignee>
            <v1:Details>
              <v1:Dimensions>
                <v1:Length>10</v1:Length>
                <v1:Width>10</v1:Width>
                <v1:Height>10</v1:Height>
                <v1:Unit>cm</v1:Unit>
              </v1:Dimensions>
              <v1:ActualWeight>
                <v1:Value>${(input.weightG / 1000).toFixed(3)}</v1:Value>
                <v1:Unit>Kg</v1:Unit>
              </v1:ActualWeight>
              <v1:ProductGroup>EXP</v1:ProductGroup>
              <v1:ProductType>PDX</v1:ProductType>
              <v1:PaymentType>P</v1:PaymentType>
              <v1:NumberOfPieces>1</v1:NumberOfPieces>
              <v1:DescriptionOfGoods>${input.parcelDescription ?? "Merchandise"}</v1:DescriptionOfGoods>
              <v1:CashOnDeliveryAmount>
                <v1:Value>${(input.codAmountMad / 100).toFixed(2)}</v1:Value>
                <v1:CurrencyCode>MAD</v1:CurrencyCode>
              </v1:CashOnDeliveryAmount>
            </v1:Details>
          </v1:Shipment>
        </v1:Shipments>
        <v1:LabelInfo>
          <v1:ReportID>9201</v1:ReportID>
          <v1:ReportType>URL</v1:ReportType>
        </v1:LabelInfo>
      </v1:ShipmentCreationRequest>`;

    const data = await callAramex(
      SHIPPING_ENDPOINT,
      "http://ws.aramex.net/ShippingAPI/v1/Service_1_0/CreateShipments",
      xml,
    );

    const processed = (
      data["Shipments"] as Array<{ ID: string; ForeignHAWB?: string }> | undefined
    )?.[0];

    if (!processed?.ID) {
      throw new CarrierApiError("UNKNOWN", "Aramex: no shipment ID in response");
    }

    return {
      trackingNumber: processed.ID,
      carrierReference: processed.ForeignHAWB,
      // labelUrl intentionally omitted — fetched on demand via PrintLabel
    };
  }

  async getTrackingStatus(trackingNumber: string): Promise<TrackingEvent[]> {
    const xml = `
      <v1:ShipmentTrackingRequest>
        ${buildClientInfo()}
        <v1:Transaction><v1:Reference1>track-${Date.now()}</v1:Reference1></v1:Transaction>
        <v1:Shipments>
          <v1:string>${trackingNumber}</v1:string>
        </v1:Shipments>
        <v1:GetLastTrackingUpdateOnly>false</v1:GetLastTrackingUpdateOnly>
      </v1:ShipmentTrackingRequest>`;

    const data = await callAramex(
      TRACKING_ENDPOINT,
      "http://ws.aramex.net/ShippingAPI/v1/Service_1_0/TrackShipments",
      xml,
    );

    type RawEvent = {
      UpdateCode: string;
      UpdateDescription: string;
      UpdateDateTime: string;
      UpdateLocation?: string;
    };

    const results = data["TrackingResults"] as
      | Array<{ KeyValueOfstringArrayOfTrackingResultmFAkxlpY?: { Value?: RawEvent[] } }>
      | undefined;

    const events: RawEvent[] =
      results?.[0]?.["KeyValueOfstringArrayOfTrackingResultmFAkxlpY"]?.["Value"] ?? [];

    return events.map((e) => ({
      carrierRawStatus: e.UpdateCode,
      status: STATUS_MAP[e.UpdateCode] ?? "in_transit",
      location: e.UpdateLocation,
      description: e.UpdateDescription,
      occurredAt: new Date(e.UpdateDateTime),
    }));
  }

  // Not part of CarrierAdapter interface — called directly by comparison service
  async calculateRate(
    originCity: string,
    destCity: string,
    weightG: number,
    codAmountMad: number,
  ): Promise<{ totalMad: number }> {
    const xml = `
      <v1:RateCalculatorRequest>
        ${buildClientInfo()}
        <v1:Transaction><v1:Reference1>rate-${Date.now()}</v1:Reference1></v1:Transaction>
        <v1:OriginAddress>
          <v1:City>${originCity}</v1:City>
          <v1:CountryCode>MA</v1:CountryCode>
        </v1:OriginAddress>
        <v1:DestinationAddress>
          <v1:City>${destCity}</v1:City>
          <v1:CountryCode>MA</v1:CountryCode>
        </v1:DestinationAddress>
        <v1:ShipmentDetails>
          <v1:PaymentType>P</v1:PaymentType>
          <v1:ProductGroup>EXP</v1:ProductGroup>
          <v1:ProductType>PDX</v1:ProductType>
          <v1:ActualWeight>
            <v1:Value>${(weightG / 1000).toFixed(3)}</v1:Value>
            <v1:Unit>KG</v1:Unit>
          </v1:ActualWeight>
          <v1:ChargeableWeight>
            <v1:Value>${(weightG / 1000).toFixed(3)}</v1:Value>
            <v1:Unit>KG</v1:Unit>
          </v1:ChargeableWeight>
          <v1:NumberOfPieces>1</v1:NumberOfPieces>
          <v1:CashOnDeliveryAmount>
            <v1:Value>${(codAmountMad / 100).toFixed(2)}</v1:Value>
            <v1:CurrencyCode>MAD</v1:CurrencyCode>
          </v1:CashOnDeliveryAmount>
        </v1:ShipmentDetails>
      </v1:RateCalculatorRequest>`;

    const data = await callAramex(
      RATE_ENDPOINT,
      "http://ws.aramex.net/ShippingAPI/v1/Service_1_0/CalculateRate",
      xml,
    );

    const total = data["TotalAmount"] as
      | { Value: number | string; CurrencyCode: string }
      | undefined;

    if (!total?.Value) {
      throw new CarrierApiError("UNKNOWN", "Aramex: no rate in response");
    }

    return { totalMad: Number(total.Value) };
  }

  // Called by the label download route
  async printLabel(trackingNumber: string): Promise<string> {
    const xml = `
      <v1:LabelPrintingRequest>
        ${buildClientInfo()}
        <v1:Transaction><v1:Reference1>label-${trackingNumber}</v1:Reference1></v1:Transaction>
        <v1:ShipmentNumber>${trackingNumber}</v1:ShipmentNumber>
        <v1:ProductGroup>EXP</v1:ProductGroup>
        <v1:OriginEntity>${process.env.ARAMEX_ACCOUNT_ENTITY ?? "CAS"}</v1:OriginEntity>
        <v1:LabelInfo>
          <v1:ReportID>9201</v1:ReportID>
          <v1:ReportType>URL</v1:ReportType>
        </v1:LabelInfo>
      </v1:LabelPrintingRequest>`;

    const data = await callAramex(
      SHIPPING_ENDPOINT,
      "http://ws.aramex.net/ShippingAPI/v1/Service_1_0/PrintLabel",
      xml,
    );

    const label = data["ShipmentLabel"] as { LabelURL?: string } | undefined;

    if (!label?.LabelURL) {
      throw new CarrierApiError("UNKNOWN", "Aramex: no label URL in response");
    }

    return label.LabelURL;
  }
}
