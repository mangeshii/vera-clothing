(function () {
  function closeAllSubmenus(root, except) {
    root.querySelectorAll('[data-vera-submenu-trigger]').forEach((trigger) => {
      if (except && trigger === except) return;
      trigger.setAttribute('aria-expanded', 'false');
    });
  }

  function initMobileMenu(header) {
    const toggle = header.querySelector('[data-vera-menu-toggle]');
    const panel = header.querySelector('[data-vera-mobile-panel]');
    const backdrop = header.querySelector('[data-vera-mobile-backdrop]');

    if (!toggle || !panel) return;

    const closeMenu = () => {
      toggle.setAttribute('aria-expanded', 'false');
      panel.classList.remove('is-open');
      document.body.classList.remove('vera-header-menu-open');
      toggle.setAttribute('aria-label', toggle.dataset.openLabel || 'Open menu');
    };

    const openMenu = () => {
      toggle.setAttribute('aria-expanded', 'true');
      panel.classList.add('is-open');
      document.body.classList.add('vera-header-menu-open');
      toggle.setAttribute('aria-label', toggle.dataset.closeLabel || 'Close menu');
    };

    toggle.addEventListener('click', () => {
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    if (backdrop) {
      backdrop.addEventListener('click', closeMenu);
    }

    panel.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && panel.classList.contains('is-open')) {
        closeMenu();
        toggle.focus();
      }
    });
  }

  function initSubmenus(header) {
    header.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-vera-submenu-trigger]');
      if (!trigger) return;

      event.preventDefault();
      const panel = document.getElementById(trigger.getAttribute('aria-controls'));
      if (!panel) return;

      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      closeAllSubmenus(header, expanded ? null : trigger);

      trigger.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    });

    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-vera-header]')) return;
      closeAllSubmenus(header);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeAllSubmenus(header);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-vera-header]').forEach((header) => {
      initMobileMenu(header);
      initSubmenus(header);
    });
  });
})();
