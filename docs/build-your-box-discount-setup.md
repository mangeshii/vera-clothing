# Build Your Own Box — checkout discount setup

The theme tags each box line with:

- `_bundle_id` — shared UUID for one box
- `_bundle_size` — `"3"`, `"5"`, or `"8"`

The builder UI calculates **preview** pricing in JavaScript (cents + `Shopify.formatMoney`). The cart page shows **Shopify’s** line and cart totals (`original_line_price`, `final_line_price`, `cart.total_discount`, `cart.total_price`). It does **not** subtract a second, theme-only discount.

## Why native automatic discounts are usually not enough

Standard **Discounts → Automatic discount** rules (collection + minimum quantity, cart total, etc.) cannot read `_bundle_id`. They may:

- Discount standalone products from the same collection as the builder
- Treat two separate 5-item boxes as one 10-item threshold
- Apply 15% to an incomplete 5-item selection once the cart hits five lines from that collection

That does **not** match “one complete bundle per `_bundle_id` only.”

## Store plan: Basic (Development)

| Mechanism | Basic Development store |
| --- | --- |
| Custom app with Shopify **Discount Function** (your own code) | **Not available** — custom Function apps require **Shopify Plus** ([Shopify Help — checkout app availability](https://help.shopify.com/en/manual/checkout-settings/customize-checkout-configurations/checkout-apps)). |
| **Public** App Store app that ships a Discount Function | **Available** on Basic — must implement bundle-by-property (or equivalent) logic inside the app. |
| Theme / Liquid / JS-only percentage | **Does not** change checkout tax or payment total. |

A Shopify Function you build in this repo is **not** checkout-effective on this plan until it is distributed as a **public** app or the store upgrades to Plus and installs it as a custom app.

## Recommended path to a real checkout discount

1. **Choose a public app** whose discount engine supports **line-item properties** or **fixed bundle groups** (verify in app docs before install). Configure it to:
   - Apply **0%** when `_bundle_size` is `3` and line count for that `_bundle_id` equals 3
   - Apply **15%** to lines sharing one `_bundle_id` when `_bundle_size` is `5` and total quantity for that id is 5
   - Apply **30%** when `_bundle_size` is `8` and total quantity for that id is 8
   - Ignore lines without `_bundle_id`
2. In **Discounts**, create an **automatic app discount** provided by that app (not a manual theme calculation).
3. **Verify** (required before marking the assignment complete):
   - Cart page `cart.total_price` matches checkout subtotal after discounts
   - Two boxes in one cart: each bundle discounted independently
   - Standalone product in cart: not discounted unless intended
   - Incomplete box: no bundle discount at checkout

## Interim automatic discount (limitations)

If you must use **only** Shopify Admin automatic discounts (no app):

- Create percentage-off rules on the **builder collection** with minimum quantities 5 and 8.
- Accept that checkout will **not** match the builder rules in edge cases (multiple boxes, incomplete boxes, mixed cart).

Do not rely on this for assignment sign-off.

## Verification checklist

- [ ] Complete 3-item box: checkout total equals sum of line prices (no discount).
- [ ] Complete 5-item box: checkout shows 15% off **bundle lines only** (via app/automatic discount).
- [ ] Complete 8-item box: 30% off bundle lines only.
- [ ] Incomplete 5/8 box: no bundle discount at checkout.
- [ ] Remove one item from a previously complete box: discount removed or reduced per app rules.
- [ ] Two boxes + normal product: discounts isolated to bundles.
- [ ] Currency matches presentment currency on builder and checkout.
