/**
 * Pricing engine. 
 *
 * All money is handled in pence to avoid floating point rounding issues
 *
 * Currrent rule order (documented here + README):
 *   1. BOGOF applied first because it changes
 *      how many units of an item are actually charged for, which is an
 *      input to everything downstream.
 *   2. Percentage off the cart, applied to the subtotal *after* BOGOF,
 *      so you don't get a percentage discount on units that were free anyway.
 *   3. Flat coupon code is applied last, since coupons
 *      are usually "£5 off however much you've already saved".
 *   4. Clamp at 0 so that the total can never go negative.
 */

export function priceCart(cartItems, { bxgyRules, percentRules, coupon }) {
  if (!cartItems.length) {
    return {
      subtotal_pence: 0,
      discounts: [],
      total_pence: 0,
      line_items: [],
    };
  }

  const line_items = cartItems.map((item) => ({
    id: item.id,
    name: item.name,
    unit_price_pence: item.unit_price_pence,
    quantity: item.quantity,
    line_total_pence: item.unit_price_pence * item.quantity,
  }));

  const subtotal_pence = line_items.reduce((sum, li) => sum + li.line_total_pence, 0);

  const discounts = [];
  let running_total = subtotal_pence;

  // 1. BXGY per matching item
  for (const item of cartItems) {
    const rule = bxgyRules.find((r) => r.item_name === item.name);
    if (!rule || item.quantity <= 0) continue;

    const groupSize = rule.buy_quantity + rule.free_quantity;
    const freeUnits = Math.floor(item.quantity / groupSize) * rule.free_quantity;
    if (freeUnits > 0) {
      const amount_pence = freeUnits * item.unit_price_pence;
      discounts.push({
        type: 'bxgy',
        description: `Buy ${rule.buy_quantity} ${item.name}, get ${rule.free_quantity} free (${freeUnits} free unit(s))`,
        amount_pence,
      });
      running_total -= amount_pence;
    }
  }

  // 2. Percentage off whole cart, based on the *post-BXGY* running total,
  // gated by the highest threshold the running total clears.
  const eligiblePercentRule = percentRules
    .filter((r) => running_total >= r.threshold_pence)
    .sort((a, b) => b.threshold_pence - a.threshold_pence)[0];

  if (eligiblePercentRule) {
    const amount_pence = Math.round((running_total * eligiblePercentRule.percent_off) / 100);
    discounts.push({
      type: 'percent',
      description: `${eligiblePercentRule.percent_off}% off orders over £${(
        eligiblePercentRule.threshold_pence / 100
      ).toFixed(2)}`,
      amount_pence,
    });
    running_total -= amount_pence;
  }

  // 3. Flat coupon
  if (coupon) {
    const amount_pence = Math.min(coupon.amount_off_pence, Math.max(running_total, 0));
    discounts.push({
      type: 'coupon',
      description: `Coupon ${coupon.code}: £${(coupon.amount_off_pence / 100).toFixed(2)} off`,
      amount_pence,
    });
    running_total -= amount_pence;
  }

  // 4. Clamp
  const total_pence = Math.max(running_total, 0);

  return { subtotal_pence, discounts, total_pence, line_items };
}
