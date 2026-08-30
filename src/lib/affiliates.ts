/** Shared affiliate helpers. */

/** Compute the commission for a link given a sale amount. */
export function computeCommission(
  commissionType: string,
  commissionValue: number,
  amount: number,
): number {
  return commissionType === "FIXED"
    ? commissionValue
    : Math.round(amount * (commissionValue / 100) * 100) / 100;
}
