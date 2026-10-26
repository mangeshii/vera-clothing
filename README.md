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

### Actual Discount Implementation

The discount must be applied through Shopify's discount system rather than
through frontend price calculations.

Shopify's native automatic discounts support percentage discounts and
minimum-quantity requirements. However, a collection-based quantity rule
does not, by itself, guarantee that qualifying items belong to the same box.

The implementation must therefore ensure that:

- A completed 3-item box receives no discount.
- A completed 5-item box receives a 15% discount.
- A completed 8-item box receives a 30% discount.
- Items from separate boxes are evaluated independently when required.
- Ordinary products outside the intended promotion are not unintentionally
  discounted.
- The actual discount is visible in the cart and checkout.

If native discount configuration cannot enforce these requirements,
evaluate a compatible Shopify discount app or a Shopify Discount Function.

Before selecting a custom Function implementation, verify the store's plan
and app deployment requirements. Custom apps using Shopify Functions have
plan restrictions, while eligible public App Store apps may support
additional plans.

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

### Testing Checklist

Test the following scenarios in a development or test store:

| Scenario | Expected Result |
|----------|----------------|
| Complete 3-item box | 0% discount |
| Complete 5-item box | 15% discount |
| Complete 8-item box | 30% discount |
| Incomplete box | Cannot be added to the cart |
| Two separate boxes | Each box is evaluated independently |
| Box mixed with unrelated products | Only eligible box items receive the intended discount |
| Discount configuration disabled | No frontend-only discount is presented as an applied discount |
| Cart quantity or box contents changed | Discount eligibility is recalculated correctly |
| Checkout | Actual Shopify discount matches the applicable tier |

### Limitations and Maintenance

- The builder's displayed prices are estimates until the actual discount
  implementation is configured and verified.
- Line-item properties identify bundle membership but do not enforce
  discount eligibility on their own.
- Cart and checkout discount calculations must be handled by Shopify's
  discount system.
- Update this documentation whenever the discount rules or implementation
  change.