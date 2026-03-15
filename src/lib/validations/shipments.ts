import { z } from "zod";

// Shared between API validation and frontend form
export const BookingInputSchema = z.object({
  carrierId:         z.string().uuid("Invalid carrier ID"),
  // Pre-filled from comparison result (centimes)
  shippingCostMad:   z.number().int().min(1, "Shipping cost required"),
  mode:              z.enum(["cheapest", "balanced", "fastest"]),
  // From original compare input
  originCity:        z.string().min(2, "Origin city required"),
  // Recipient details
  recipientName:     z.string().min(1, "Recipient name required").max(100),
  recipientPhone:    z
    .string()
    .regex(/^\+?[0-9]{9,15}$/, "Enter a valid phone number"),
  recipientCity:     z.string().min(2, "Recipient city required"),
  recipientAddress:  z.string().min(5, "Full address required").max(300),
  // Package
  weightG:           z.number().int().min(1, "Weight must be at least 1g"),
  codAmountMad:      z.number().int().min(0, "COD amount must be >= 0"),
  parcelDescription: z.string().max(200).optional(),
});

export type BookingInput = z.infer<typeof BookingInputSchema>;

export const shipmentStatusValues = [
  "pending",
  "confirmed",
  "picked_up",
  "in_transit",
  "delivered",
  "failed",
  "cancelled",
] as const;

// Response shape from POST /api/shipments
export const ShipmentResponseSchema = z.object({
  id:                    z.string().uuid(),
  status:                z.enum(shipmentStatusValues),
  carrierTrackingNumber: z.string().nullable(),
  carrierId:             z.string().uuid(),
  recipientName:         z.string(),
  recipientCity:         z.string(),
  shippingCostMad:       z.number(),
  codAmountMad:          z.number(),
  createdAt:             z.string(),
});

export type ShipmentResponse = z.infer<typeof ShipmentResponseSchema>;

// Response shape from GET /api/shipments
export const ShipmentsListResponseSchema = z.object({
  shipments: z.array(ShipmentResponseSchema),
  total:     z.number(),
  page:      z.number(),
  pageSize:  z.number(),
});

export type ShipmentsListResponse = z.infer<typeof ShipmentsListResponseSchema>;
