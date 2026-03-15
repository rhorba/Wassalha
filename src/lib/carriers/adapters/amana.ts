import type { CarrierAdapter, CreateShipmentInput, CarrierShipmentResult } from "../types";
import { CarrierApiError } from "../types";

export class AmanaAdapter implements CarrierAdapter {
  readonly slug = "amana";

  private readonly baseUrl   = process.env.AMANA_API_URL   ?? "";
  private readonly apiKey    = process.env.AMANA_API_KEY    ?? "";
  private readonly accountId = process.env.AMANA_ACCOUNT_ID ?? "";

  async createShipment(input: CreateShipmentInput): Promise<CarrierShipmentResult> {
    const res = await fetch(`${this.baseUrl}/shipments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        account_id: this.accountId,
        recipient: {
          name:    input.recipientName,
          phone:   input.recipientPhone,
          city:    input.recipientCity,
          address: input.recipientAddress,
        },
        sender_city:  input.originCity,
        weight_g:     input.weightG,
        cod_amount:   input.codAmountMad,
        description:  input.parcelDescription ?? "",
      }),
    });

    if (res.status === 401) throw new CarrierApiError("AUTH_FAILED", "Amana: authentication failed");
    if (res.status === 422) throw new CarrierApiError("INVALID_ADDRESS", "Amana: invalid address or city");
    if (!res.ok)            throw new CarrierApiError("SERVICE_UNAVAILABLE", `Amana: HTTP ${res.status}`);

    const data = (await res.json()) as {
      tracking_number: string;
      reference?: string;
      label_url?: string;
    };
    return {
      trackingNumber:   data.tracking_number,
      carrierReference: data.reference,
      labelUrl:         data.label_url,
    };
  }
}
