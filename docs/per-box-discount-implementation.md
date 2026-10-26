# Per-box checkout discount — implementation plan (VÉRA Build Your Own Box)

**Status:** Not production-ready. **No checkout discount has been verified** on the development store as part of this task. No Shopify Admin discounts were changed. Nothing was pushed or published to the live theme.

## Requirement

| `_bundle_size` | Lines per `_bundle_id` (qty sum) | Checkout discount |
|----------------|----------------------------------|-------------------|
| `3` | exactly 3 | 0% |
| `5` | exactly 5 | 15% on those lines only |
| `8` | exactly 8 | 30% on those lines only |

Theme builder already sends:

- `_bundle_id` — UUID per box add (`assets/build-your-box.js` → `cartLines()`)
- `_bundle_size` — `"3"`, `"5"`, or `"8"`

Cart UI groups by `_bundle_id` in `sections/cart.liquid`. **No theme change is required** for discount logic if Shopify applies line-level discounts correctly.

## Why native automatic discounts failed (evidence)

Admin rules such as “15% off collection X when quantity ≥ 5”:

- Cannot read `_bundle_id` or require “complete box only.”
- Combine quantities across **separate boxes** and unrelated lines from the same collection.
- Can discount a **3-item box** when another box pushes total collection qty over the threshold (observed when a 15% automatic rule was enabled).

The theme cart **does not** apply bundle percentages anymore; it only **displays** Shopify’s gap between `original_line_price` and `final_line_price` (`sections/cart.liquid`).

## Chosen direction (recommended, not yet verified on your store)

### Primary: **Shopify Discount Function delivered by an app**

Use Shopify’s [Discount Function API](https://shopify.dev/docs/api/functions/latest/discount) (`cart.lines.discounts.generate.run`) to:

1. Read each cart line’s attributes with **fixed keys** in the Function input query, e.g.  
   `attribute(key: "_bundle_id")` and `attribute(key: "_bundle_size")` ([Shopify community guidance](https://community.shopify.dev/t/discount-function-not-getting-line-item-properties/5797)).
2. Group lines by `_bundle_id`.
3. For each group, sum `quantity` and read `_bundle_size`.
4. Apply **product** discount to **only** lines in that group when:
   - `quantity sum == 3` and size `3` → no discount
   - `quantity sum == 5` and size `5` → 15%
   - `quantity sum == 8` and size `8` → 30%
   - Otherwise → no bundle discount for that group (incomplete or inconsistent size)
5. Ignore lines with blank `_bundle_id` (normal catalog products).

This matches the existing storefront cart (multiple lines per box) and does **not** require Cart Transform / `linesMerge` unless you later want a single visible parent line.

### Plan compatibility (Basic Development store)

| Approach | Basic (non-Plus) | Per-`_bundle_id` tiers |
|----------|------------------|-------------------------|
| Theme JS / Liquid % math | Display only | Possible in UI, **not checkout** |
| Native automatic discount (collection qty) | Yes | **No** — fails acceptance tests |
| **Custom app** with your own Function | **No** — custom Function apps require [Shopify Plus](https://help.shopify.com/en/manual/checkout-settings/customize-checkout-configurations/checkout-apps) |
| **Public App Store app** that ships a Discount Function | **Yes** | **Only if the app supports line attributes / custom bundle rules** — must be verified in app docs before install |

**Do not assume** any named app supports `_bundle_id` until its documentation or support confirms attribute-based grouping.

### Apps to evaluate (merchant must verify)

No app was installed on this project. Before install on a **duplicate unpublished dev theme only**:

1. Search the Shopify App Store for “automatic discount function”, “bundle discount”, or “line item property discount.”
2. Confirm in writing (docs or support) that the app can:
   - Target cart lines by **line item property** (or equivalent), not only collection + cart quantity.
   - Apply **different percentages per group** in one cart.
   - Leave non-bundle lines undiscounted.
3. Reject apps that only merge bundles into one SKU unless you accept changing the cart UX.

If **no** suitable public app exists, the feasible path on Basic is:

- Partner builds a Function app and **lists it on the App Store** (or the store upgrades to Plus for a custom app), **or**
- Accept documented limitations of collection-based automatic discounts (not acceptable for this spec).

This repository **does not** include a deployed Function app; only the theme and this plan.

## What we are **not** doing

- Installing or configuring apps in Admin (manual step).
- Publishing to the live theme.
- Creating, editing, or deactivating Admin discounts.
- Claiming checkout totals are discounted until `cart.js` / checkout show allocations.

## Isolated testing procedure (unpublished dev theme)

1. **Theme:** Use `shopify theme dev` or push only to an **unpublished** development theme (never `#189857661235` live without explicit approval).
2. **Discount:** Install and configure the chosen app on the **dev store**; create one **automatic app discount** tied to the app’s Function.
3. **Builder:** Add boxes via Build Your Own Box; confirm lines still have `_bundle_id` / `_bundle_size` in `GET /cart.js`.
4. **Acceptance tests** (record `cart.total_discount`, line `line_level_discount_allocations`, checkout subtotal):

| # | Scenario | Pass criteria |
|---|----------|----------------|
| 1 | One 3-item box | `total_discount` ≈ 0; totals = sum of line prices |
| 2 | One 5-item box | 15% off **bundle lines only**; checkout matches cart |
| 3 | One 8-item box | 30% off bundle lines only |
| 4 | 3-item + 5-item boxes | 0% on first group, 15% on second |
| 5 | Two 5-item boxes | 15% on **each** group independently |
| 6 | Box + normal PDP product | Normal product undiscounted |
| 7 | Remove one box | Other box discount unchanged |
| 8 | Builder preview | Informational only; **cart/checkout** is source of truth |

## Rollback

### Git

```bash
# Return to pre-discount-documentation state (includes full BYOB work)
git checkout backup/pre-per-box-discount-2026-10-26

# Or return to original main-only skeleton
git checkout main
```

### Shopify

- Disable or uninstall the discount app on the dev store.
- Do not change live theme or production discounts without approval.

## Files in this repo related to discounts

| File | Role |
|------|------|
| `assets/build-your-box.js` | Preview `pricing()`; `cart/add.js` with properties |
| `sections/cart.liquid` | Displays Shopify line/cart discount fields only |
| `assets/cart.js` | Bundle remove / qty protection — no discount math |
| `docs/build-your-box-discount-setup.md` | Earlier setup notes |
| `docs/build-your-box-testing-report.md` | Oct 2026 tests; checkout showed **no** 30% on 8-item box |

## Next implementation step (after you approve an app or app build)

1. Configure Function input query for `_bundle_id` and `_bundle_size`.
2. Implement grouping + tier logic (3/5/8).
3. Create automatic app discount in Admin on **dev store only**.
4. Run acceptance table above and update this doc with **pass/fail** and screenshots or JSON snippets.
