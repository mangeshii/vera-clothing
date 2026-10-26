## Build Your Own Box — Vera Clothing

The Build Your Own Box feature allows customers to select products and
variants, choose a box size, and add their completed box to the cart.

### Box Sizes and Discount Tiers

| Box Size | Discount |
|----------|----------|
| 3 items  | 0%       |
| 5 items  | 15%      |
| 8 items  | 30%      |

Discounts must be applied by Shopify at checkout. Displaying a discounted
total in the theme UI does not constitute an actual discount.

### How It Works

The builder is implemented in `assets/build-your-box.js`.

The current implementation:

- Lets customers choose a box size and select products and variants.
- Displays the subtotal, expected discount, and estimated total.
- Validates box completion, product selection limits, and available stock.
- Stores the builder selection in browser local storage.
- Adds selected items to the Shopify cart using the Ajax Cart API.
- Attaches `_bundle_id` and `_bundle_size` line-item properties to identify
  items belonging to the same box.

Each box receives a unique bundle ID when it is added to the cart.

**Important:** The current JavaScript calculates the discount for display
purposes only. It does not apply an actual Shopify cart or checkout discount.

### Actual discount implementation (current status)

**Not verified at checkout.** The builder preview (`pricing()` in
`assets/build-your-box.js`) is **not** a Shopify discount. The cart shows
discounts only when Shopify sets `final_line_price` below `original_line_price`
and `cart.total_discount` > 0 (`sections/cart.liquid`).

**Why Admin “15% off collection when qty ≥ 5” failed:** Shopify counts
qualifying items across the cart; it cannot group by `_bundle_id`. That rule
incorrectly discounted 3-item boxes when combined with other boxes or collection
lines.

**Chosen direction (documented, not deployed here):** A **Shopify Discount
Function** installed via a **public App Store app** (Basic-compatible) that
reads line attributes `_bundle_id` and `_bundle_size`, groups lines per box, and
applies 0% / 15% / 30% per complete box. A **custom** Function app built only
for this store requires **Shopify Plus**; it is not assumed available.

Full plan, acceptance tests, and rollback:
[`docs/per-box-discount-implementation.md`](docs/per-box-discount-implementation.md).

App Store comparison (no installs performed):
[`docs/app-store-per-box-discount-research.md`](docs/app-store-per-box-discount-research.md).
**Pilot candidate:** Function Studio — discount function by `_bundle_size` /
`_bundle_id`, not verified on this store yet.

**Git isolation (local only — nothing pushed):**

| Branch | Purpose |
|--------|---------|
| `backup/pre-per-box-discount-2026-10-26` | Snapshot of all BYOB work before discount docs |
| `feature/per-box-checkout-discount` | Discount implementation planning branch |

Rollback: `git checkout backup/pre-per-box-discount-2026-10-26`

### Configuration

Before testing the builder:

1. Create or select the collection used by the box builder.
2. Add eligible, active products to the collection.
3. Publish those products to the Online Store sales channel.
4. Open the theme editor and configure the builder product collection.
5. Configure the selected discount implementation.
6. Verify that the discount applies to actual cart and checkout prices.

Do not treat the discount as production-ready until the checkout behavior
has been verified.

### Testing checklist

Run on an **unpublished development theme** after a verified discount app or
Function is configured. **Do not use the live theme** without explicit approval.

| Scenario | Expected result | Verified? |
|----------|-----------------|-----------|
| Complete 3-item box | 0% at cart/checkout | **No** — pending app/Function |
| Complete 5-item box | 15% on bundle lines only | **No** |
| Complete 8-item box | 30% on bundle lines only | **No** |
| 3-item + 5-item in one cart | 0% and 15% independently | **No** |
| Two 5-item boxes | 15% each, not combined | **No** |
| Box + normal product | Normal product undiscounted | **No** |
| Remove one box | Other box unchanged | **No** |
| Checkout total | Matches `cart.total_price` | **No** |

Builder-only and Oct 2026 cart tests did **not** show a real 30% checkout
discount on an 8-item box — see `docs/build-your-box-testing-report.md`.

### Limitations and Maintenance

- The builder's displayed prices are estimates until the actual discount
  implementation is configured and verified.
- Line-item properties identify bundle membership but do not enforce
  discount eligibility on their own.
- Cart and checkout discount calculations must be handled by Shopify's
  discount system.
- Update this documentation whenever the discount rules or implementation
  change.