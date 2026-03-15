// Commission rates as typed constants — no DB table at MVP scale.
// Update these values to change rates globally.
const COMMISSION_RATES = {
  shippingFeePercent: 10,   // 10% of carrier shipping cost
  codFeePercent:      1.5,  // 1.5% of COD amount collected
} as const;

export interface CommissionBreakdown {
  shippingFeePercent:   number;
  shippingFeeAmountMad: number; // centimes
  codFeePercent:        number;
  codFeeAmountMad:      number; // centimes
  totalCommissionMad:   number; // centimes
}

/**
 * Calculate Wassalha commission for a shipment.
 * Both inputs are in centimes (integers).
 * Returns all amounts in centimes.
 */
export function calculateCommission(
  shippingCostMad: number,
  codAmountMad: number,
): CommissionBreakdown {
  const shippingFee = Math.round(
    (shippingCostMad * COMMISSION_RATES.shippingFeePercent) / 100,
  );
  const codFee = Math.round(
    (codAmountMad * COMMISSION_RATES.codFeePercent) / 100,
  );
  return {
    shippingFeePercent:   COMMISSION_RATES.shippingFeePercent,
    shippingFeeAmountMad: shippingFee,
    codFeePercent:        COMMISSION_RATES.codFeePercent,
    codFeeAmountMad:      codFee,
    totalCommissionMad:   shippingFee + codFee,
  };
}
