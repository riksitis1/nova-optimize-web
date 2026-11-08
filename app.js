'use strict';

(function () {
  const consentCheckbox = document.getElementById('legal-consent');
  const consentHint = document.getElementById('consent-hint');
  const downloadBtns = document.querySelectorAll('[data-requires-consent="true"]');

  function syncConsentState() {
    const agreed = Boolean(consentCheckbox && consentCheckbox.checked);
    downloadBtns.forEach((btn) => {
      btn.classList.toggle('is-disabled', !agreed);
      btn.setAttribute('aria-disabled', agreed ? 'false' : 'true');
    });
    if (consentHint) {
      consentHint.textContent = agreed
        ? 'Thank you — downloads are unlocked. Remember to create a Windows Restore Point before applying tweaks.'
        : 'Check the legal acknowledgment box above to unlock the download buttons.';
      consentHint.classList.toggle('is-ready', agreed);
    }
  }

  if (consentCheckbox) {
    consentCheckbox.addEventListener('change', syncConsentState);
    syncConsentState();
  }

  downloadBtns.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      if (!consentCheckbox || !consentCheckbox.checked) {
        event.preventDefault();
        if (consentHint) {
          consentHint.textContent = 'Please check the legal agreement box above before downloading Nova Optimize.';
        }
        if (consentCheckbox) consentCheckbox.focus();
      }
    });
  });

  // Preview tabs
  const previewTabs = document.querySelectorAll('.preview-tab');
  const previewPanels = {
    overview: document.getElementById('preview-overview'),
    games: document.getElementById('preview-games'),
    tweaks: document.getElementById('preview-tweaks'),
    network: document.getElementById('preview-network'),
  };

  previewTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-preview');
      previewTabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      Object.entries(previewPanels).forEach(([key, panel]) => {
        if (!panel) return;
        const show = key === target;
        panel.classList.toggle('active', show);
        panel.hidden = !show;
      });
    });
  });

  // Copy SHA-256 hash buttons
  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.getAttribute('data-copy');
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        const prev = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = prev;
        }, 1800);
      } catch {
        // Fallback if clipboard permission denied
      }
    });
  });

  // Legal modal
  const modal = document.getElementById('legal-modal');
  const openBtn = document.getElementById('open-legal-modal');
  const closeBtn = document.getElementById('close-legal-modal');
  const acceptModalBtn = document.getElementById('accept-from-modal');

  function openModal() {
    if (!modal) return;
    modal.hidden = false;
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    if (openBtn) openBtn.focus();
  }

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (acceptModalBtn) {
    acceptModalBtn.addEventListener('click', () => {
      if (consentCheckbox) {
        consentCheckbox.checked = true;
        syncConsentState();
      }
      closeModal();
    });
  }

  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal && !modal.hidden) {
      closeModal();
    }
  });
})();

