import type { CarrierAdapter, CreateShipmentInput, CarrierShipmentResult } from "../types";
import { CarrierApiError } from "../types";

export class CtmAdapter implements CarrierAdapter {
  readonly slug = "ctm";

  private readonly baseUrl = process.env.CTM_API_URL ?? "";
  private readonly apiKey  = process.env.CTM_API_KEY  ?? "";

  async createShipment(input: CreateShipmentInput): Promise<CarrierShipmentResult> {
    const res = await fetch(`${this.baseUrl}/api/shipments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": this.apiKey,
      },
      body: JSON.stringify({
        destinataire: {
          nom:      input.recipientName,
          telephone: input.recipientPhone,
          ville:    input.recipientCity,
          adresse:  input.recipientAddress,
        },
        ville_expediteur: input.originCity,
        poids_g:          input.weightG,
        montant_cod:      input.codAmountMad,
        description:      input.parcelDescription ?? "",
      }),
    });

    if (res.status === 403) throw new CarrierApiError("AUTH_FAILED", "CTM: authentication failed");
    if (res.status === 400) throw new CarrierApiError("INVALID_ADDRESS", "CTM: invalid request data");
    if (!res.ok)            throw new CarrierApiError("SERVICE_UNAVAILABLE", `CTM: HTTP ${res.status}`);

    const data = (await res.json()) as { numero_suivi: string; reference?: string };
    return {
      trackingNumber:   data.numero_suivi,
      carrierReference: data.reference,
    };
  }
}
