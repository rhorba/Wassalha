interface WhatsAppShipmentParams {
  recipientPhone:     string;
  recipientName:      string;
  carrierName:        string;
  trackingNumber:     string;
  senderBusinessName: string;
}

/**
 * Send a WhatsApp template message to the parcel recipient.
 * Uses WhatsApp Business Cloud API (Meta).
 * Credentials: WHATSAPP_API_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_TEMPLATE_NAME.
 */
export async function sendRecipientWhatsApp(
  params: WhatsAppShipmentParams,
): Promise<void> {
  const phoneId      = process.env.WHATSAPP_PHONE_ID      ?? "";
  const token        = process.env.WHATSAPP_API_TOKEN     ?? "";
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME ?? "shipment_notification";

  if (!phoneId || !token) {
    console.warn("[whatsapp] Missing credentials — skipping WhatsApp notification");
    return;
  }

  // Normalize phone: strip spaces
  const phone = params.recipientPhone.replace(/\s/g, "");

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to:                phone,
        type:              "template",
        template: {
          name:     templateName,
          language: { code: "fr" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: params.recipientName },
                { type: "text", text: params.senderBusinessName },
                { type: "text", text: params.trackingNumber },
                { type: "text", text: params.carrierName },
              ],
            },
          ],
        },
      }),
    },
  );

  if (!res.ok) {
    const err = (await res.json()) as unknown;
    console.error("[whatsapp] Failed to send notification:", err);
  }
}
