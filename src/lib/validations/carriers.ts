import { z } from "zod";

export const CreateCarrierSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  logoUrl: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().url("Must be a valid URL").nullable().optional()
  ),
  reliabilityScore: z.preprocess(
    (v) => (typeof v === "number" && isNaN(v) ? undefined : v),
    z.number().int().min(0).max(100).optional()
  ),
});

export const UpdateCarrierSchema = CreateCarrierSchema.partial();

export const CreateZoneSchema = z.object({
  zoneName: z.string().min(1, "Zone name is required").max(100),
  zoneCode: z.string().min(1, "Zone code is required").max(20),
});

export const CreatePricingSchema = z
  .object({
    weightMinG: z.number().int().min(0, "Min weight must be >= 0"),
    weightMaxG: z.number().int().min(1).nullable().optional(),
    priceMad: z.number().int().min(1, "Price must be >= 1 centime"),
    deliveryDaysMin: z.number().int().min(1),
    deliveryDaysMax: z.number().int().min(1),
    codFeeMad: z.number().int().min(0).nullable().optional(),
    codFeePercent: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Must be a decimal like 1.50")
      .nullable()
      .optional(),
  })
  .refine(
    (data) =>
      data.weightMaxG === null ||
      data.weightMaxG === undefined ||
      data.weightMaxG > data.weightMinG,
    { message: "Max weight must be greater than min weight", path: ["weightMaxG"] }
  )
  .refine((data) => data.deliveryDaysMax >= data.deliveryDaysMin, {
    message: "Max delivery days must be >= min",
    path: ["deliveryDaysMax"],
  })
  .refine(
    (data) =>
      data.codFeePercent === null ||
      data.codFeePercent === undefined ||
      parseFloat(data.codFeePercent) <= 100,
    { message: "COD fee percent must be between 0 and 100", path: ["codFeePercent"] }
  );

export type CreateCarrierInput = z.infer<typeof CreateCarrierSchema>;
export type UpdateCarrierInput = z.infer<typeof UpdateCarrierSchema>;
export type CreateZoneInput = z.infer<typeof CreateZoneSchema>;
export type CreatePricingInput = z.infer<typeof CreatePricingSchema>;

// ── Comparison ────────────────────────────────────────────────────────────────

export const CompareInputSchema = z.object({
  originCity:      z.string().min(2, "Origin city required"),
  destinationCity: z.string().min(2, "Destination city required"),
  weightG:         z.number().int().min(1, "Weight must be at least 1g"),
  codAmountMad:    z.number().int().min(0),
  mode:            z.enum(["cheapest", "balanced", "fastest"]).default("balanced"),
});

export type CompareInput = z.infer<typeof CompareInputSchema>;

export type CarrierResult = {
  carrierId:        string;
  slug:             string;
  name:             string;
  logoUrl:          string | null;
  totalCostMad:     number;
  deliveryDaysMin:  number;
  deliveryDaysMax:  number;
  reliabilityScore: number;
  score:            number;
  codFeeBreakdown: {
    flatMad:    number;
    percentFee: number;
    total:      number;
  };
};

export type UnavailableCarrier = {
  slug:   string;
  name:   string;
  reason: "rate_unavailable";
};

// ── Bulk comparison ────────────────────────────────────────────────────────────

export const BulkCompareRowSchema = z.object({
  rowIndex:        z.number().int().min(0),
  label:           z.string().optional(),
  originCity:      z.string().min(2, "Origin city required"),
  destinationCity: z.string().min(2, "Destination city required"),
  weightG:         z.coerce.number().int().min(1, "Weight must be at least 1g"),
  codAmountMad:    z.coerce.number().int().min(0),
  mode:            z.enum(["cheapest", "balanced", "fastest"]).optional(),
});

export const BulkCompareRequestSchema = z.object({
  globalMode: z.enum(["cheapest", "balanced", "fastest"]).default("balanced"),
  rows: z
    .array(BulkCompareRowSchema)
    .min(1, "At least 1 row required")
    .max(50, "Max 50 rows per request"),
});

export type BulkCompareRow     = z.infer<typeof BulkCompareRowSchema>;
export type BulkCompareRequest = z.infer<typeof BulkCompareRequestSchema>;

export type BulkCompareResultRow = {
  rowIndex:     number;
  label:        string | undefined;
  input:        BulkCompareRow;
  bestCarrier:  CarrierResult | null;
  allResults:   CarrierResult[];
  cityNotFound: boolean;
  error:        string | null;
};
