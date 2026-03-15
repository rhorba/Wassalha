import type { CarrierAdapter, CreateShipmentInput, CarrierShipmentResult } from "../types";
import { CarrierApiError } from "../types";

export class SendexAdapter implements CarrierAdapter {
  readonly slug = "sendex";

  private readonly baseUrl  = process.env.SENDEX_API_URL   ?? "";
  private readonly apiToken = process.env.SENDEX_API_TOKEN ?? "";

  async createShipment(input: CreateShipmentInput): Promise<CarrierShipmentResult> {
    const res = await fetch(`${this.baseUrl}/shipments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${this.apiToken}`,
      },
      body: JSON.stringify({
        recipient_name:    input.recipientName,
        recipient_phone:   input.recipientPhone,
        recipient_city:    input.recipientCity,
        recipient_address: input.recipientAddress,
        sender_city:       input.originCity,
        weight_grams:      input.weightG,
        cod_amount_cents:  input.codAmountMad,
        notes:             input.parcelDescription ?? "",
      }),
    });

    if (res.status === 401) throw new CarrierApiError("AUTH_FAILED", "Sendex: authentication failed");
    if (res.status === 422) throw new CarrierApiError("INVALID_ADDRESS", "Sendex: invalid address");
    if (!res.ok)            throw new CarrierApiError("SERVICE_UNAVAILABLE", `Sendex: HTTP ${res.status}`);

    const data = (await res.json()) as {
      tracking_id: string;
      reference_number?: string;
      label?: string;
    };
    return {
      trackingNumber:   data.tracking_id,
      carrierReference: data.reference_number,
      labelUrl:         data.label,
    };
  }
}
