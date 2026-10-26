# Build Your Own Box — end-to-end test report

Date: 23 October 2026  
Branch: `feature/build-your-own-box` (`7166139` plus the existing uncommitted theme changes)  
Storefront: local theme preview at `http://127.0.0.1:9292`  
No source files were changed for this test. No payment was submitted. No inventory was changed.

## What the code does

`addBundleToCart` in `assets/build-your-box.js` sends one `POST` to `/cart/add.js`. The body is `{ items: [...] }`. Identical variants are grouped. Every line gets the same `_bundle_id` (`crypto.randomUUID()`) and `_bundle_size` (`"3"`, `"5"`, or `"8"`).

While the request is in flight, `isAddingToCart` is true, the button is disabled, and its label is `Adding to Cart...`. A second click returns immediately. On failure, a toast shows `error.message`, then the button label and disabled state are restored from the current selection. On success, the page navigates to `/cart`.

There is no `localStorage` or `sessionStorage` use in the builder or cart scripts. Builder selections live in memory only. Nothing in the theme clears the cart when Checkout is clicked. `sections/cart.liquid` submits Checkout as a normal cart form (`name="checkout"`). `assets/cart.js` intercepts only the Update cart submitter. Shopify checkout and order confirmation are outside the theme, so the theme cannot currently tell a paid order from an abandoned checkout.

## Starting state

Cart before these tests: 8 items, total `$434.92`, one box, `_bundle_size` `"8"`, `_bundle_id` `ae4093ef-4ef9-4d78-b4d6-d959b93130d7`.

A temporary 3-item box was added during the retry test, then removed with `/cart/update.js` (those keys set to `0`). Cart after the session: the original 8-item box only, total `$434.92`.

## Summary

| # | Scenario | Result |
| --- | --- | --- |
| 1 | Storefront password and checkout access | PASS |
| 2 | Successful Bogus Gateway payment | BLOCKED |
| 3 | Declined Bogus Gateway payment | BLOCKED |
| 4 | Sell-out during add-to-cart | SIMULATED |
| 5 | Network failure and retry | FAIL |
| 6 | Double-submit prevention | PASS |
| 7 | Successful checkout cart cleanup | NOT TESTED |
| 8 | Successful checkout `localStorage` cleanup | NOT TESTED |
| 9 | Declined payment state preservation | NOT TESTED |
| 10 | Bundle line properties and grouping | PASS |

Counts: **3 PASS**, **1 FAIL**, **2 BLOCKED**, **1 SIMULATED**, **3 NOT TESTED**.

No test order was created.

## 1. Storefront password and checkout access — PASS

**Method.** Real browser. Checkout from the theme cart left the preview host and opened the online store password page. The storefront password was entered there. Checkout was clicked again from `http://127.0.0.1:9292/cart`.

**Observed.**

1. First Checkout click landed on `https://vera-clothing-y0ijqppy.myshopify.com/password`.
2. After the password was accepted, the browser was on the online store home page. The original checkout POST had not continued.
3. Second Checkout click opened `https://vera-clothing-y0ijqppy.myshopify.com/checkouts/cn/.../en-us` with title `Checkout - Vera Clothing`.
4. Order summary: 8 items, subtotal and total `$434.92`. The same eight products were listed with variant titles (for example `VERA Denim Blue Overshirt` / `S` / `$64.99`).
5. Payment region text: `This store can’t accept payments right now.`
6. `Pay now` was disabled.
7. Expanding the summary also showed a Shopify checkout banner: `There was a problem with our checkout` / `Refresh this page or try again in a few minutes`. No order was submitted.

Entering the storefront password unlocks the online store and checkout page. It does not enable a test payment provider.

## 2. Successful Bogus Gateway payment — BLOCKED

**Method.** Checkout was opened. No card fields were present, so no payment was attempted.

**Observed.** Payment copy was `This store can’t accept payments right now.` Bogus Gateway was not offered.

**Manual step required before this can be tested.** In Shopify admin for this development store:

1. Go to **Settings → Payments**.
2. If another card provider is active, deactivate it before activating a test provider.
3. Choose **Bogus Gateway** from the test/third-party providers and activate it.
4. Return to checkout. Use only the success card instructions in [Shopify’s Bogus Gateway documentation](https://help.shopify.com/en/manual/checkout-settings/test-orders/payments-test-mode). Do not use a real card.

Place at most one successful test order, then check the confirmation page, an empty cart, and that a fresh builder load has no previous selection.

## 3. Declined Bogus Gateway payment — BLOCKED

Same blocker as scenario 2. No decline was submitted, and none should be recorded as an order.

After Bogus Gateway is active, use Shopify’s documented decline instructions once. Confirm the decline message, that the cart still contains the box, and that builder state is not treated as a completed order.

## 4. Sell-out during add-to-cart — SIMULATED

**Why simulated.** Changing live inventory was avoided. The storefront was not put into a real stock race.

**Method.** On the builder, three available products were selected (`3/3 items selected`). `window.fetch` was stubbed so `/cart/add.js` returned HTTP 422:

```json
{ "status": 422, "message": "Cart Error", "description": "The product is already sold out." }
```

**Observed.**

- One add request was sent.
- Toast: `The product is already sold out.` Class `box-toast box-toast--error is-visible`.
- Button returned to `Add Box to Cart` and was enabled.
- Selection stayed at `3/3 items selected — 0 more to go`.
- `/cart.js` stayed at 8 items. No partial box was added.
- The page did not show the success toast and did not redirect to the cart.

The UI path for a JSON error from `/cart/add.js` behaves correctly. This was not a live inventory rejection.

## 5. Network failure and retry — FAIL

**Method.** Same filled 3-item box. `/cart/add.js` was stubbed twice, then allowed through.

| Attempt | Stub | Toast | Button after | Cart |
| --- | --- | --- | --- | --- |
| Offline | `TypeError: Failed to fetch` | `Failed to fetch` | `Add Box to Cart`, enabled | unchanged (8) |
| HTTP 500 | plain-text `Internal Server Error` | `Failed to execute 'json' on 'Response': Unexpected token 'I', "Internal S"... is not valid JSON` | `Add Box to Cart`, enabled | unchanged (8) |
| Retry | real `/cart/add.js` after a 1.2s delay | success path; browser landed on `/cart` | n/a (navigated) | 11, then restored to 8 |

**What passed.** The button is usable again after both failures. The failed requests did not add lines. The later real request added one complete 3-item box (`_bundle_id` `76c390e9-8bfa-47c7-b131-b19d2149ed0a`, `_bundle_size` `"3"` on all three lines) and left the original 8-item box untouched. That test box was then removed. Final cart: 8 items, `$434.92`, original bundle id only.

**What failed.** A non-JSON error response is parsed with `response.json()` before `response.ok` is checked (`assets/build-your-box.js`, `addBundleToCart`). The shopper sees a JavaScript parse error instead of a cart error. `Failed to fetch` is understandable but is the raw browser message.

**Smallest safe fix (not applied).** Read the body only when the response is JSON. If parsing fails or `response.ok` is false, toast `result.description`, `result.message`, or a fixed string such as `Unable to add your box to the cart.` Do not toast `SyntaxError` text.

**Atomicity.** These failures were stubs, so the server never partially wrote lines. The implementation sends one items array and has no rollback if Shopify were to persist some lines and then error. That live partial-add case was not reproduced.

## 6. Double-submit prevention — PASS

**Method.** Real add, with the request delayed 1.2s. The enabled button was clicked, then clicked twice more while it showed `Adding to Cart...` and `disabled: true`.

**Observed.** The delay-mode log recorded **1** `/cart/add.js` call. The cart gained exactly one 3-item box, not two. `_bundle_id` and `_bundle_size` matched across its three lines.

## 7. Successful checkout cart cleanup — NOT TESTED

No order was completed, so post-order cleanup was not observed.

What was observed: opening checkout does not empty the cart. Checkout showed the same 8 items and `$434.92`. Returning to the theme cart still showed that box. The theme does not clear the cart on Checkout click. Shopify empties the cart only after a completed checkout, which this session did not reach.

## 8. Successful checkout `localStorage` cleanup — NOT TESTED

No completed order.

On the builder, `localStorage` keys were only `signInWithShop:cartSyncTransferAttemptedAt` and `__hr`. Neither is builder state. A fresh builder load showed `0/3 items selected` and a disabled `Add Box to Cart` button. Selections are in memory and disappear when the page is left, including the redirect to `/cart` after a successful add. That is not order confirmation.

There is no theme code that can reliably detect a paid checkout. A supported check is the order status page, a post-purchase extension, or reading the cart after Shopify’s own checkout completion. Do not clear state on the Checkout click.

## 9. Declined payment state preservation — NOT TESTED

Blocked with scenarios 2 and 3. No decline was submitted, so this was not recorded as an order and no cleanup was attributed to it.

## 10. Bundle line properties and grouping — PASS

**Add payload (simulated 422 call, parsed before it was discarded).** 3 items, quantities `[1,1,1]`, one `_bundle_id` (`f24d6b0f-7c63-4b61-b930-f3297cd4f151`), `_bundle_size` `"3"` on every line.

**Cart after the real retry.** The new box’s three lines shared `76c390e9-8bfa-47c7-b131-b19d2149ed0a` / `"3"`. The original box’s eight lines still shared `ae4093ef-4ef9-4d78-b4d6-d959b93130d7` / `"8"`. The theme cart grouped the original box as `Build your own box` / `8 items` / `$434.92` after the test box was removed.

**Checkout.** The eight products and `$434.92` were visible. The checkout summary did not show `_bundle_id` or `_bundle_size`. Shopify hides line properties whose names start with `_` from the buyer-facing checkout. Association on a completed order was not checked, because no order was placed.

## Remaining blockers

1. **Payments.** Admin must activate Bogus Gateway. Until then, checkout shows `This store can’t accept payments right now` and `Pay now` stays disabled.
2. **Scenarios that depend on a completed or declined payment:** successful order, cart empty after payment, order-level line properties, and proof that a decline does not clear the cart.
3. **Checkout banner.** `There was a problem with our checkout` appeared while the payment provider was missing. Re-check after Bogus Gateway is enabled before treating it as a theme defect.

## Files changed

| File | Why |
| --- | --- |
| `docs/build-your-box-testing-report.md` | This report |

No theme code was edited. The cart was restored to the original 8-item box.

## Next manual action

In Shopify admin, open **Settings → Payments**, activate **Bogus Gateway** for this development store, then say when that is done. The success and decline checkouts can be run after that, using Shopify’s published test values only, one success and one decline.
