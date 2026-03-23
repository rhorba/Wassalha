import { XMLParser } from "fast-xml-parser";
import { CarrierApiError } from "./types";

const SOAP_NS = "http://schemas.xmlsoap.org/soap/envelope/";
const ARAMEX_NS = "http://ws.aramex.net/ShippingAPI/v1/";

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true, // strips "v1:" / "soap:" prefixes from keys
  isArray: (name) =>
    ["Notifications", "Shipments", "ProcessedShipments", "TrackingResults"].includes(name),
});

export function buildClientInfo(): string {
  return `
    <v1:ClientInfo>
      <v1:UserName>${process.env.ARAMEX_USERNAME ?? ""}</v1:UserName>
      <v1:Password>${process.env.ARAMEX_PASSWORD ?? ""}</v1:Password>
      <v1:Version>v1.0</v1:Version>
      <v1:AccountNumber>${process.env.ARAMEX_ACCOUNT_NUMBER ?? ""}</v1:AccountNumber>
      <v1:AccountPin>${process.env.ARAMEX_ACCOUNT_PIN ?? ""}</v1:AccountPin>
      <v1:AccountEntity>${process.env.ARAMEX_ACCOUNT_ENTITY ?? "CAS"}</v1:AccountEntity>
      <v1:AccountCountryCode>${process.env.ARAMEX_ACCOUNT_COUNTRY_CODE ?? "MA"}</v1:AccountCountryCode>
    </v1:ClientInfo>`;
}

export function buildEnvelope(body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="${SOAP_NS}" xmlns:v1="${ARAMEX_NS}">
  <soap:Body>${body}</soap:Body>
</soap:Envelope>`;
}

export async function callAramex(
  endpoint: string,
  soapAction: string,
  xmlBody: string,
): Promise<Record<string, unknown>> {
  const envelope = buildEnvelope(xmlBody);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `"${soapAction}"`,
    },
    body: envelope,
  });

  const text = await res.text();

  if (!res.ok) {
    throw new CarrierApiError(
      "SERVICE_UNAVAILABLE",
      `Aramex HTTP ${res.status}: ${text.slice(0, 200)}`,
    );
  }

  const parsed = parser.parse(text) as Record<string, unknown>;

  // Unwrap: Envelope > Body > *Response
  const body = (parsed["Envelope"] as Record<string, unknown>)?.["Body"] as
    | Record<string, unknown>
    | undefined;

  if (!body) {
    throw new CarrierApiError("UNKNOWN", "Aramex: empty SOAP body");
  }

  // The response key is the first child of Body (e.g. "ShipmentCreationResponse")
  const responseKey = Object.keys(body)[0];
  const inner = body[responseKey] as Record<string, unknown>;

  if (!inner) {
    throw new CarrierApiError("UNKNOWN", "Aramex: unrecognised SOAP response");
  }

  // Check HasErrors
  if (inner["HasErrors"] === true || inner["HasErrors"] === "true") {
    const notifications = inner["Notifications"] as
      | Array<{ Code: string; Message: string }>
      | undefined;
    const msg = notifications?.[0]?.Message ?? "Aramex: unknown error";
    throw new CarrierApiError("UNKNOWN", msg);
  }

  return inner;
}
