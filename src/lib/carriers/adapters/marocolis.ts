import type { CarrierAdapter, CreateShipmentInput, CarrierShipmentResult, TrackingEvent } from "../types";
import { CarrierApiError } from "../types";

export class MarocolisAdapter implements CarrierAdapter {
  readonly slug = "marocolis";

  private readonly baseUrl      = process.env.MAROCOLIS_API_URL      ?? "";
  private readonly clientId     = process.env.MAROCOLIS_CLIENT_ID     ?? "";
  private readonly clientSecret = process.env.MAROCOLIS_CLIENT_SECRET ?? "";

  private async getToken(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     this.clientId,
        client_secret: this.clientSecret,
      }),
    });
    if (!res.ok) throw new CarrierApiError("AUTH_FAILED", "Marocolis: token request failed");
    const { access_token } = (await res.json()) as { access_token: string };
    return access_token;
  }

  async createShipment(input: CreateShipmentInput): Promise<CarrierShipmentResult> {
    // STUB — real API credentials pending signed contract
    const ref = Date.now().toString(36).toUpperCase();
    return { trackingNumber: `MRC-MA-${ref}`, carrierReference: `MRC-REF-${ref}` };

    const token = await this.getToken();

    const res = await fetch(`${this.baseUrl}/api/v1/colis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        destinataire_nom:     input.recipientName,
        destinataire_tel:     input.recipientPhone,
        destinataire_ville:   input.recipientCity,
        destinataire_adresse: input.recipientAddress,
        expediteur_ville:     input.originCity,
        poids:                input.weightG,
        valeur_cod:           input.codAmountMad,
        description:          input.parcelDescription ?? "",
      }),
    });

    if (!res.ok) throw new CarrierApiError("SERVICE_UNAVAILABLE", `Marocolis: HTTP ${res.status}`);

    const data = (await res.json()) as { code_suivi: string; id_colis?: string };
    return {
      trackingNumber:   data.code_suivi,
      carrierReference: data.id_colis,
    };
  }

  async getTrackingStatus(_trackingNumber: string): Promise<TrackingEvent[]> {
    throw new CarrierApiError("SERVICE_UNAVAILABLE", "Marocolis: tracking API not yet integrated");
  }
}
