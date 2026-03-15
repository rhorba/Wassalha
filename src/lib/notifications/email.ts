import { Resend } from "resend";
import type { Shipment, Carrier } from "@/lib/db/schema";
import type { CommissionBreakdown } from "@/lib/services/commission";

interface BookingEmailParams {
  retailerEmail: string;
  retailerName:  string;
  shipment:      Shipment;
  carrier:       Carrier;
  commission:    CommissionBreakdown;
}

export async function sendBookingConfirmationEmail(
  params: BookingEmailParams,
): Promise<void> {
  if (!params.retailerEmail) {
    console.warn("[email] No retailer email — skipping confirmation email");
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping confirmation email");
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const costMad       = (params.shipment.shippingCostMad / 100).toFixed(2);
  const commissionMad = (params.commission.totalCommissionMad / 100).toFixed(2);
  const codMad        = (params.shipment.codAmountMad / 100).toFixed(2);

  const { error } = await resend.emails.send({
    from:    process.env.RESEND_FROM_EMAIL ?? "Wassalha <onboarding@resend.dev>",
    to:      params.retailerEmail,
    subject: `Réservation confirmée — ${params.carrier.name} — ${params.shipment.carrierTrackingNumber ?? ""}`,
    html: `
      <h2>Réservation confirmée ✓</h2>
      <p>Bonjour ${params.retailerName},</p>
      <p>Votre envoi a été réservé avec succès.</p>
      <table cellpadding="8" style="border-collapse:collapse">
        <tr><td><strong>Transporteur</strong></td><td>${params.carrier.name}</td></tr>
        <tr><td><strong>Numéro de suivi</strong></td><td>${params.shipment.carrierTrackingNumber ?? "—"}</td></tr>
        <tr><td><strong>Destinataire</strong></td><td>${params.shipment.recipientName} — ${params.shipment.recipientCity}</td></tr>
        <tr><td><strong>Montant COD</strong></td><td>${codMad} MAD</td></tr>
        <tr><td><strong>Frais de transport</strong></td><td>${costMad} MAD</td></tr>
        <tr><td><strong>Commission Wassalha</strong></td><td>${commissionMad} MAD</td></tr>
      </table>
      <p>Merci d'utiliser Wassalha.</p>
    `,
  });

  if (error) {
    console.error("[email] Failed to send booking confirmation:", error);
  }
}
