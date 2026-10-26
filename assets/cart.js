
(() => {
  if (window.__veraCartBundleRemovalInitialized) return;
  window.__veraCartBundleRemovalInitialized = true;

  document.addEventListener('click', async (event) => {
    const qtyDecrease = event.target.closest('[data-qty-decrease]');
    const qtyIncrease = event.target.closest('[data-qty-increase]');

    if (qtyDecrease || qtyIncrease) {
      event.preventDefault();

      const control = qtyDecrease || qtyIncrease;
      const wrap = control.closest('[data-vera-cart-qty]');
      const input = wrap?.querySelector('.vera-cart-qty__input');

      if (!input) return;

      const current = parseInt(input.value, 10) || 0;
      const next = qtyIncrease ? current + 1 : Math.max(0, current - 1);

      input.value = String(next);
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    const button = event.target.closest('[data-remove-entire-box]');

    if (!button || button.disabled) return;

    event.preventDefault();

    const bundleId = button.dataset.removeEntireBox;

    if (!bundleId) return;

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = 'Removing box...';

    try {
      const root = window.Shopify?.routes?.root || '/';

      const cartResponse = await fetch(`${root}cart.js`, {
        headers: {
          Accept: 'application/json'
        }
      });

      if (!cartResponse.ok) {
        throw new Error('Could not load your cart. Please try again.');
      }

      const cart = await cartResponse.json();

      const matchingItems = cart.items.filter(
        (item) => String(item.properties?._bundle_id || '') === bundleId
      );

      if (matchingItems.length === 0) {
        window.location.reload();
        return;
      }

      const updates = {};

      matchingItems.forEach((item) => {
        updates[item.key] = 0;
      });

      const updateResponse = await fetch(`${root}cart/update.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ updates })
      });

      const result = await updateResponse.json();

      if (!updateResponse.ok || result.errors) {
        throw new Error(
          typeof result.errors === 'string'
            ? result.errors
            : 'Could not remove the box. Please try again.'
        );
      }

      window.location.reload();
    } catch (error) {
      console.error('Remove entire box failed:', error);

      window.alert(
        error.message || 'Something went wrong. Please try again.'
      );

      button.disabled = false;
      button.textContent = originalText;
    }
  });

  // Theme-level protection: prevent cart form updates from changing bundle quantities.
  // This does not prevent direct Shopify Cart API requests.
  document.addEventListener('submit', async (event) => {
    const form = event.target;

    if (!form.matches('form.vera-cart__form')) return;

    // Only intercept Update cart, never Checkout.
    if (event.submitter?.name !== 'update') return;

    event.preventDefault();

    const updateButton = event.submitter;
    if (updateButton.disabled) return;

    const originalText = updateButton.textContent;
    updateButton.disabled = true;
    updateButton.textContent = 'Updating...';

    try {
      const root = window.Shopify?.routes?.root || '/';

      const cartResponse = await fetch(`${root}cart.js`, {
        headers: { Accept: 'application/json' }
      });

      if (!cartResponse.ok) {
        throw new Error('Could not load your cart. Please try again.');
      }

      const cart = await cartResponse.json();
      const normalLineKeys = new Set(
        cart.items
          .filter((item) => !item.properties?._bundle_id)
          .map((item) => item.key)
      );

      const formData = new FormData(form);
      const updates = {};

      for (const [name, value] of formData.entries()) {
        const match = name.match(/^updates\[(.+)\]$/);

        if (!match) continue;

        const lineKey = match[1];

        // Only accept keys belonging to current, non-bundle cart lines.
        if (!normalLineKeys.has(lineKey)) continue;

        const quantity = Number.parseInt(String(value), 10);

        if (!Number.isFinite(quantity) || quantity < 0) {
          throw new Error('Please enter a valid product quantity.');
        }

        updates[lineKey] = quantity;
      }

      const updateResponse = await fetch(`${root}cart/update.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ updates })
      });

      const result = await updateResponse.json();

      if (!updateResponse.ok || result.errors) {
        throw new Error(
          typeof result.errors === 'string'
            ? result.errors
            : 'Could not update your cart. Please try again.'
        );
      }

      window.location.reload();
    } catch (error) {
      console.error('Update cart failed:', error);

      window.alert(
        error.message || 'Something went wrong. Please try again.'
      );

      updateButton.disabled = false;
      updateButton.textContent = originalText;
    }
  });
})();
