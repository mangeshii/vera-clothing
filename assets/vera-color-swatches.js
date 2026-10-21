document.addEventListener('click', (event) => {
  const swatch = event.target.closest('.vera-color-swatch');
  if (!swatch) return;

  event.preventDefault();

  const card = swatch.closest('.vera-product-card');
  if (!card) return;

  const image = card.querySelector('.vera-product-card__main-image');
  const link = card.querySelector('.vera-product-card__link');

  if (image && swatch.dataset.imageUrl) {
    image.removeAttribute('srcset');
    image.removeAttribute('sizes');
    image.src = swatch.dataset.imageUrl;

    if (swatch.dataset.imageAlt) {
      image.alt = swatch.dataset.imageAlt;
    }

    const width = Number(swatch.dataset.imageWidth);
    const height = Number(swatch.dataset.imageHeight);

    if (width > 0 && height > 0) {
      image.width = width;
      image.height = height;
    }
  }

  if (link && swatch.dataset.variantUrl) {
    link.href = swatch.dataset.variantUrl;
  }

  card.querySelectorAll('.vera-color-swatch').forEach((button) => {
    const active = button === swatch;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
});
