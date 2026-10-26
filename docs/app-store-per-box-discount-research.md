# App Store research — per-box checkout discounts (VÉRA BYOB)

**Date:** 2026-10-26  
**Branch:** `feature/per-box-checkout-discount`  
**Store context:** Shopify Basic (development store). Theme sends `_bundle_id` (UUID per add) and `_bundle_size` (`"3"`, `"5"`, `"8"`) on every box line via `assets/build-your-box.js`.

**No apps were installed.** No Admin, theme publish, or git push was performed for this research.

## Requirements checklist (must all pass after configuration + cart/checkout tests)

| # | Requirement |
|---|-------------|
| R1 | Real automatic discount at checkout (Shopify Function), not theme-only math |
| R2 | 3-item box → 0%; 5-item → 15%; 8-item → 30% on **that box’s lines only** |
| R3 | Multiple boxes in one cart discounted **independently** (no cross-box quantity pooling) |
| R4 | Keep **custom** Build Your Own Box UI (no mandatory replacement with app widget) |
| R5 | Prefer retaining `_bundle_id` / `_bundle_size` (or document minimal, verified property changes) |
| R6 | Non-box catalog lines never receive box tiers |
| R7 | Shopify **Basic** (non-Plus) |

---

## Candidate 1 — Appstle℠ Bundles ([App Store](https://apps.shopify.com/appstle-bundles))

### Official documentation

- Headless / custom UI: [Build bundles with your own storefront UI](https://developers.appstle.com/bundles/headless-overview)
- Dynamic BYOB: [Dynamic pricing bundle with a custom storefront](https://developers.appstle.com/bundles/dynamic-pricing-bundle)
- Tiered volume: [Volume discount bundle with a custom storefront](https://developers.appstle.com/bundles/volume-discount-bundle)

### What is verified

| Item | Evidence |
|------|----------|
| Custom storefront UI | Headless overview: *“the only thing you replace is the UI”*; Ajax `cart/add.js` with Appstle attributes |
| Checkout discount via Function | *“Appstle’s automatic discount (Shopify Function)”*; discounts apply in cart and checkout |
| Basic / non-Plus | Public App Store app provisioning Functions (listing: *Edit Shopify Functions*, *Edit discounts*) |
| Build-a-box type | `CLASSIC_BUILD_A_BOX` with `minProductCount` / `maxProductCount` and `PERCENTAGE` / `NO_DISCOUNT` |

### What is **not** verified for VÉRA

| Gap | Why it matters |
|-----|----------------|
| **`_bundle_id` not supported** | Contract requires `_appstle-bb-id` = rule `uniqueRef`, not a per-box UUID ([headless overview — Required cart line attributes](https://developers.appstle.com/bundles/headless-overview)) |
| **No documented per-instance grouping** | All lines in one add share the same `_appstle-bb-id`; docs do not describe a merchant UUID like `_bundle_id` for separating two 5-item boxes |
| **Volume tiers ≠ fixed box tiers** | `VOLUME_DISCOUNT` applies the **best qualifying tier** from `tieredDiscount` across qualifying lines ([volume guide — Tier selection](https://developers.appstle.com/bundles/volume-discount-bundle)), which risks the same cross-cart pooling native automatic discounts caused |
| **3 / 5 / 8 as mutually exclusive complete boxes** | Would require three `CLASSIC_BUILD_A_BOX` rules (min=max 3, 5, 8) and swapping `uniqueRef` per size — still **no per-box instance id** for two boxes of the same size |

### Builder UI replacement

**Not required** for headless mode (keep theme builder). Requires **property contract change** (`_appstle-*` attributes + active Appstle rules in Admin + app embed for metafield).

### Verdict

**Does not meet R4+R5 as-is without abandoning `_bundle_id` and without proof of independent multi-box discounts.** Not recommended until Appstle support confirms instance-level grouping (e.g. custom line property read by their Function).

---

## Candidate 2 — Function Studio ([App Store](https://apps.shopify.com/easylogic-functions-studio))

### Official documentation

- App listing: [Function Studio](https://apps.shopify.com/easylogic-functions-studio) — *“Works for all Shopify plans”* via public Function app; cart transforms from **$39/mo** tier
- Dynamic merge on **`_bundle_id`**: [Cart Transform: Merge Lines — Dynamic bundle mode](https://function-studio.app/docs/cart-merge/) — *“Lines are grouped by a shared identifier field”*; example keys include `_bundle_id`
- Per-line discount from properties: [Metafield Discounts — Bundle builder with line properties](https://function-studio.app/docs/discount-metafield-settings/) — link **Discount value** to `properties._bundle_discount`
- **`_bundle_id` + tier in one flow**: [Function Studio vs SMART comparison (Function Studio)](https://function-studio.app/smart-functions-creator-vs-function-studio/) — *“A bundle builder writes two line item properties: a bundle ID and a tier … Both properties in one flow”* (Function Studio side)
- Line properties on discount input: [Changelog v0.11.36](https://function-studio.app/changelog/) — *“Line item properties are now available in cart focused metafield input for discounts”*

### What is verified

| Item | Evidence |
|------|----------|
| **`_bundle_id` as bundle instance key** | Cart merge docs explicitly use `_bundle_id`; dynamic mode: *“Each distinct `_bundle_id` value becomes its own merged bundle”* |
| **Multiple bundles in one cart** | Same merge doc: *“Multiple different bundles can exist in the same cart simultaneously”* |
| **Custom builder (no app widget)** | Merchant builds a **Discount** or **Cart transform** flow; storefront only needs line properties (your theme already sets them) |
| **Basic plan** | App Store listing; free tier **development/staging stores only** — production Basic needs paid plan (**$20/mo+** for flow builder per listing) |
| **Real checkout discount** | Shopify Function app (*Edit Shopify Functions* on listing) |

### Recommended configuration path (merchant build — **not tested on VÉRA store**)

**Option A — Keep separate cart lines (matches current `sections/cart.liquid` grouping):**

1. Create an automatic **Discount** function (not cart transform).
2. Define line groups using line item properties (e.g. `_bundle_size` is `5`, `_bundle_size` is `8`; omit or 0% branch for `3`).
3. Apply **Apply Product Discount** (15% / 30%) scoped to each group.
4. Exclude lines without `_bundle_id` by requiring a line-property condition on `_bundle_id` (non-empty) or by excluding lines missing box properties.

Because every box line already carries the correct `_bundle_size`, **two 5-item boxes both get 15% on their lines without aggregating counts across boxes** (each line’s tier is local to that add).

**Option B — Link discount % to a numeric line property** (if one flow is simpler):

- Add `_bundle_discount` (`0` / `15` / `30`) in the theme at add time **or** map in Function Studio from `_bundle_size` via separate groups.
- Link discount value to `_bundle_discount` per [Metafield Discounts](https://function-studio.app/docs/discount-metafield-settings/).

**Option C — Cart transform merge:** Supported with `_bundle_id`, but **changes cart line presentation** (merged parent line). Conflicts with current multi-line bundle UX unless you redesign cart templates.

### Gaps / risks (not verified on your store)

- No single published “recipe” for exact 3/5/8 + `_bundle_id` validation (count per id equals `_bundle_size`); merchant must build/test the flow (Advanced plan **cart tester** helps).
- Production requires **paid** plan; cart transform features need **$39/mo** tier if you choose merge.
- Dynamic merge may require **`_bundle_parent_variant_id`** or parent marker unless you use discount-only Option A.

### Builder UI replacement

**Not required.** Keep VÉRA builder; optional small addition of `_bundle_discount` if you use linked discount values.

### Verdict

**Best-documented fit for `_bundle_id` and independent boxes.** Recommend for **dev-store pilot** using **Option A (discount function, no merge)** first. **R1–R7 are not satisfied until you configure the function and run the acceptance matrix in `docs/per-box-discount-implementation.md`.**

---

## Candidate 3 — NERD Discount/Bundle Functions ([App Store](https://apps.shopify.com/nerd-functions))

### Official documentation

- Listing: [NERD Functions](https://apps.shopify.com/nerd-functions) — *“This app works on any Shopify plan!”*; *“Use metafields, line item properties or metaobjects”*; discount + cart transform
- Review evidence (not product docs): merchant review citing *“dynamic discount for specific product combinations, with conditions based on cart line properties”* (Oct 2026, on listing)

### What is verified

| Item | Evidence |
|------|----------|
| Basic / any plan | App Store copy |
| Line item properties in rules | Listing + review |
| Custom discount Function | *Edit Shopify Functions* scope |

### What is **not** verified

| Gap | Why it matters |
|-----|----------------|
| **No public doc for `_bundle_id` grouping** | No developer docs found equivalent to Function Studio’s `_bundle_id` merge/discount recipes |
| **Per-box tier logic** | No published rule template for 3/5/8 per instance |
| **Headless BYOB contract** | No documented attribute keys; likely requires NERD support to implement |

### Builder UI replacement

**Not stated.** Assumed custom storefront possible if rules are driven by your line properties (support-led).

### Verdict

**Plausible on paper (Functions + line properties on Basic), but requirements R2–R5 are not verifiable from official docs alone.** Treat as **support/consulting path** (listing reviews mention vendor setup). **Not recommended over Function Studio without a written spec from Bosidev.**

---

## Also evaluated briefly

| App | Result |
|-----|--------|
| **SMART Functions Creator** ([App Store](https://apps.shopify.com/functions-creator)) | [Line property discount guide](https://functions-creator.com/guides/shopify-discounts-line-item-properties): fixed **15%** when `_offer` = `custom`; **one property key per function**; *“does not calculate arbitrary prices or percentages from numbers stored in properties.”* Could approximate 3/5/8 with **three rules** on `_bundle_size` values, but **`_bundle_id` independence not documented**; weaker than Function Studio for two-property flows ([comparison](https://function-studio.app/smart-functions-creator-vs-function-studio/)). |
| **Calio Products Box** | [App Store listing unavailable](https://apps.shopify.com/calio-products-box) — not installable; no checkout Function documentation found. |
| **Shopify Bundles (native)** | [Help Center](https://help.shopify.com/en/manual/products/bundles/shopify-bundles): parent bundle products + component allocation — does not read custom `_bundle_id` on mix-and-match theme lines. |

---

## Comparison summary

| | Appstle | Function Studio | NERD |
|---|---------|-----------------|------|
| Real checkout Function | Yes (documented) | Yes | Yes (listing) |
| Keep custom builder | Yes (headless) | Yes | Unknown |
| Uses **`_bundle_id`** as-is | **No** (`_appstle-bb-id`) | **Yes** (documented) | Unknown |
| Independent multi-box | **Not documented** | **Yes** (per `_bundle_id` or per-line `_bundle_size`) | Unknown |
| 3 / 5 / 8 tier semantics | Partial (separate rules / volume best-tier risk) | Configurable (groups / linked fields) | Unknown |
| Basic production cost | Free–$39.99/mo (bundle sales caps on lower tiers) | **$20/mo+** (free = dev stores only) | **$29/mo+** |
| Replaces builder UI | No (headless) | No | Unknown |

---

## Recommendation

**Pilot: [Function Studio](https://apps.shopify.com/easylogic-functions-studio)** on the **development store only**, using a **Discount function** (Option A above) that targets lines with box properties and applies 0% / 15% / 30% by `_bundle_size`, **without** cart-transform merge unless you intentionally change cart UX.

**Do not treat Appstle as compatible with `_bundle_id`** without a confirmed instance-level attribute strategy from Appstle.

**No recommendation is “verified” for checkout totals** until the acceptance tests in `docs/per-box-discount-implementation.md` pass on your dev theme.

---

## Next steps (manual, when you approve)

1. Install Function Studio on **dev store only**; use unpublished dev theme.
2. Build and activate one automatic discount function (future start date while testing).
3. Run acceptance tests; capture `GET /cart.js` and checkout summary.
4. Update README “Verified?” column with pass/fail evidence only.
5. Rollback: disable discount + uninstall app on dev store; git checkout backup branch if needed.
