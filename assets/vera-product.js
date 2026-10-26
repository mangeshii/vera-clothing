(function () {
  function moneyFormatForCurrency(moneyFormat, currencyCode) {
    if (currencyCode === 'INR') {
      return '₹{{amount}}';
    }

    return moneyFormat || '${{amount}}';
  }

  function formatMoney(cents, moneyFormat, currencyCode) {
    const format = moneyFormatForCurrency(moneyFormat, currencyCode);

    if (typeof Shopify !== 'undefined' && typeof Shopify.formatMoney === 'function') {
      return Shopify.formatMoney(cents, format);
    }

    if (currencyCode === 'INR') {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
      }).format(cents / 100);
    }

    return (cents / 100).toFixed(2);
  }

  function parseProductData(root) {
    const node = root.querySelector('[data-vera-product-json]');
    if (!node) return null;

    try {
      return JSON.parse(node.textContent);
    } catch (_error) {
      return null;
    }
  }

  function getSelectedOptions(root) {
    const options = [];
    root.querySelectorAll('[data-vera-option-index].is-selected').forEach((button) => {
      const index = Number(button.dataset.veraOptionIndex);
      options[index] = button.dataset.veraOptionValue;
    });
    return options;
  }

  function findVariant(variants, selectedOptions, initialVariantId) {
    const hasSelection = selectedOptions.some((value) => value != null && value !== '');

    if (!hasSelection) {
      return (
        variants.find((variant) => variant.id === initialVariantId) || variants[0] || null
      );
    }

    return (
      variants.find((variant) => {
        if (selectedOptions[0] != null && variant.option1 !== selectedOptions[0]) return false;
        if (selectedOptions[1] != null && variant.option2 !== selectedOptions[1]) return false;
        if (selectedOptions[2] != null && variant.option3 !== selectedOptions[2]) return false;
        return true;
      }) || null
    );
  }

  function variantMatchesPartial(variant, optionIndex, optionValue, selectedOptions) {
    if (variant[`option${optionIndex + 1}`] !== optionValue) return false;

    for (let i = 0; i < selectedOptions.length; i += 1) {
      if (i === optionIndex) continue;
      if (selectedOptions[i] == null) continue;
      if (variant[`option${i + 1}`] !== selectedOptions[i]) return false;
    }

    return true;
  }

  function isOptionValueAvailable(variants, optionIndex, optionValue, selectedOptions) {
    return variants.some((variant) =>
      variantMatchesPartial(variant, optionIndex, optionValue, selectedOptions)
    );
  }

  function updateOptionAvailability(root, variants, selectedOptions) {
    root.querySelectorAll('[data-vera-option-index]').forEach((button) => {
      const optionIndex = Number(button.dataset.veraOptionIndex);
      const optionValue = button.dataset.veraOptionValue;
      const available = isOptionValueAvailable(
        variants,
        optionIndex,
        optionValue,
        selectedOptions
      );

      button.classList.toggle('is-unavailable', !available);
      if (available) {
        button.removeAttribute('aria-disabled');
      } else {
        button.setAttribute('aria-disabled', 'true');
      }
    });
  }

  function setSelectedButtons(root, selectedOptions) {
    root.querySelectorAll('[data-vera-option-index]').forEach((button) => {
      const optionIndex = Number(button.dataset.veraOptionIndex);
      const isSelected = button.dataset.veraOptionValue === selectedOptions[optionIndex];
      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });

    root.querySelectorAll('[data-vera-option-selected]').forEach((label) => {
      const index = Number(label.dataset.veraOptionSelected);
      label.textContent = selectedOptions[index] ? `: ${selectedOptions[index]}` : '';
    });
  }

  function updateGalleryImage(root, imagePayload) {
    const mainImage = root.querySelector('.vera-product-gallery__main-image');
    const placeholder = root.querySelector('[data-vera-product-placeholder]');

    if (!mainImage) return;

    if (!imagePayload || !imagePayload.src) {
      if (placeholder) placeholder.hidden = false;
      mainImage.hidden = true;
      return;
    }

    if (placeholder) placeholder.hidden = true;
    mainImage.hidden = false;
    mainImage.src = imagePayload.src;
    mainImage.alt = imagePayload.alt || '';
    mainImage.width = imagePayload.width || mainImage.width;
    mainImage.height = imagePayload.height || mainImage.height;
    mainImage.removeAttribute('srcset');
    mainImage.removeAttribute('sizes');
  }

  function syncThumbnailState(root, mediaId) {
    root.querySelectorAll('[data-vera-gallery-thumb]').forEach((thumb) => {
      const active = thumb.dataset.veraGalleryThumb === String(mediaId);
      thumb.classList.toggle('is-active', active);
    });
  }

  function buildVariantImagePayload(variant, product, fallbackImage) {
    const image = variant?.featured_image || fallbackImage;
    if (!image) return null;

    return {
      src: image.src || image,
      alt: image.alt || product.title,
      width: image.width,
      height: image.height,
      id: image.id,
    };
  }

  function getMaxQuantity(variant) {
    if (!variant || !variant.available) return 1;

    if (
      variant.inventory_management === 'shopify' &&
      variant.inventory_policy === 'deny' &&
      typeof variant.inventory_quantity === 'number'
    ) {
      return Math.max(1, variant.inventory_quantity);
    }

    return null;
  }

  function clampQuantity(input, maxQuantity) {
    let value = parseInt(input.value, 10);
    if (Number.isNaN(value) || value < 1) value = 1;
    if (maxQuantity != null && value > maxQuantity) value = maxQuantity;
    input.value = String(value);
    return value;
  }

  function updateVariantState(root, data) {
    const {
      variants,
      product,
      strings,
      moneyFormat,
      currency,
      fallbackImage,
      showAvailability,
    } = data;

    const selectedOptions = getSelectedOptions(root);
    const variant = findVariant(variants, selectedOptions, data.initialVariantId);
    const variantInput = root.querySelector('[data-vera-variant-input]');
    const priceEl = root.querySelector('[data-vera-product-price]');
    const compareEl = root.querySelector('[data-vera-product-compare-price]');
    const availabilityEl = root.querySelector('[data-vera-product-availability]');
    const submitButton = root.querySelector('[data-vera-add-to-cart]');
    const quantityInput = root.querySelector('[data-vera-quantity-input]');
    const minusButton = root.querySelector('[data-vera-quantity-minus]');
    const plusButton = root.querySelector('[data-vera-quantity-plus]');
    const statusLive = root.querySelector('[data-vera-variant-status-live]');

    updateOptionAvailability(root, variants, selectedOptions);

    let availabilityKey = 'unavailable';
    let submitLabel = strings.unavailable;
    let canPurchase = false;

    if (variant) {
      if (variant.available) {
        availabilityKey = 'in_stock';
        submitLabel = strings.add_to_cart;
        canPurchase = true;
      } else {
        availabilityKey = 'sold_out';
        submitLabel = strings.sold_out;
      }
    }

    if (variantInput) {
      variantInput.value = variant ? String(variant.id) : '';
    }

    if (priceEl) {
      if (variant) {
        priceEl.textContent = formatMoney(variant.price, moneyFormat, currency);
        priceEl.hidden = false;
      } else {
        priceEl.hidden = true;
      }
    }

    if (compareEl) {
      const showCompare =
        variant &&
        variant.compare_at_price != null &&
        variant.compare_at_price > variant.price;

      compareEl.hidden = !showCompare;
      if (showCompare) {
        compareEl.textContent = formatMoney(
          variant.compare_at_price,
          moneyFormat,
          currency
        );
      }
    }

    if (showAvailability && availabilityEl) {
      availabilityEl.hidden = false;
      availabilityEl.textContent = strings[availabilityKey] || '';
      availabilityEl.classList.remove('is-in-stock', 'is-sold-out', 'is-unavailable');
      availabilityEl.classList.add(`is-${availabilityKey.replace(/_/g, '-')}`);
    }

    if (submitButton) {
      submitButton.disabled = !canPurchase;
      submitButton.textContent = submitLabel;
    }

    const maxQuantity = variant ? getMaxQuantity(variant) : 1;

    if (quantityInput) {
      quantityInput.disabled = !canPurchase;
      clampQuantity(quantityInput, maxQuantity);
    }

    if (minusButton) minusButton.disabled = !canPurchase;
    if (plusButton) {
      plusButton.disabled =
        !canPurchase ||
        (maxQuantity != null && Number(quantityInput?.value || 1) >= maxQuantity);
    }

    if (variant) {
      const imagePayload = buildVariantImagePayload(variant, product, fallbackImage);
      if (imagePayload?.id) {
        updateGalleryImage(root, imagePayload);
        syncThumbnailState(root, imagePayload.id);
      }

      const url = new URL(window.location.href);
      url.searchParams.set('variant', String(variant.id));
      window.history.replaceState({}, '', url.toString());
    }

    if (statusLive && variant) {
      statusLive.textContent = `${strings.option_updated}: ${variant.title}`;
    }

    root.dataset.veraMaxQuantity = maxQuantity == null ? '' : String(maxQuantity);
  }

  function initProduct(root) {
    const data = parseProductData(root);
    if (!data) return;

    const quantityInput = root.querySelector('[data-vera-quantity-input]');
    const minusButton = root.querySelector('[data-vera-quantity-minus]');
    const plusButton = root.querySelector('[data-vera-quantity-plus]');
    const form = root.querySelector('form[action*="/cart/add"]');
    const feedback = root.querySelector('[data-vera-form-feedback]');
    const mainImage = root.querySelector('.vera-product-gallery__main-image');

    updateVariantState(root, data);

    root.addEventListener('click', (event) => {
      const optionButton = event.target.closest('[data-vera-option-index]');
      if (optionButton) {
        event.preventDefault();

        if (optionButton.classList.contains('is-unavailable')) return;

        const optionIndex = Number(optionButton.dataset.veraOptionIndex);
        const selectedOptions = getSelectedOptions(root);
        selectedOptions[optionIndex] = optionButton.dataset.veraOptionValue;
        setSelectedButtons(root, selectedOptions);
        updateVariantState(root, data);
        return;
      }

      const thumb = event.target.closest('[data-vera-gallery-thumb]');
      if (thumb) {
        event.preventDefault();
        updateGalleryImage(root, {
          src: thumb.dataset.src,
          alt: thumb.dataset.alt,
          width: Number(thumb.dataset.width),
          height: Number(thumb.dataset.height),
          id: thumb.dataset.veraGalleryThumb,
        });
        syncThumbnailState(root, thumb.dataset.veraGalleryThumb);
        return;
      }

      if (event.target.closest('[data-vera-quantity-minus]') && quantityInput) {
        event.preventDefault();
        const maxQuantity = root.dataset.veraMaxQuantity
          ? Number(root.dataset.veraMaxQuantity)
          : null;
        quantityInput.value = String(
          clampQuantity(
            { value: String(Math.max(1, Number(quantityInput.value || 1) - 1)) },
            maxQuantity
          )
        );
        updateVariantState(root, data);
        return;
      }

      if (event.target.closest('[data-vera-quantity-plus]') && quantityInput) {
        event.preventDefault();
        const maxQuantity = root.dataset.veraMaxQuantity
          ? Number(root.dataset.veraMaxQuantity)
          : null;
        const next = Number(quantityInput.value || 1) + 1;
        quantityInput.value = String(
          clampQuantity({ value: String(next) }, maxQuantity)
        );
        updateVariantState(root, data);
      }
    });

    if (quantityInput) {
      quantityInput.addEventListener('change', () => {
        const maxQuantity = root.dataset.veraMaxQuantity
          ? Number(root.dataset.veraMaxQuantity)
          : null;
        clampQuantity(quantityInput, maxQuantity);
        updateVariantState(root, data);
      });
    }

    if (form) {
      form.addEventListener('submit', (event) => {
        const submitButton = root.querySelector('[data-vera-add-to-cart]');
        const variantInput = root.querySelector('[data-vera-variant-input]');

        if (!variantInput?.value) {
          event.preventDefault();
          if (feedback) {
            feedback.textContent = data.strings.unavailable;
            feedback.classList.remove('is-success');
          }
          return;
        }

        if (submitButton?.disabled) {
          event.preventDefault();
          return;
        }

        if (form.dataset.veraSubmitting === 'true') {
          event.preventDefault();
          return;
        }

        form.dataset.veraSubmitting = 'true';
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = data.strings.adding;
        }
      });
    }

    if (mainImage) {
      mainImage.addEventListener('load', () => {
        mainImage.hidden = false;
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-vera-product]').forEach(initProduct);
  });
})();
