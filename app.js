'use strict';

const consent = document.getElementById('legal-consent');
const downloadStatus = document.getElementById('download-status');
const downloads = document.querySelectorAll('[data-download-url]');

function syncDownloadConsent() {
  const agreed = consent.checked;
  for (const link of downloads) {
    link.setAttribute('aria-disabled', String(!agreed));
    if (agreed) link.href = link.dataset.downloadUrl;
    else link.removeAttribute('href');
  }
  downloadStatus.textContent = agreed ? 'Downloads are available.' : 'Agree to the terms to download Nexa.';
}

consent.addEventListener('change', syncDownloadConsent);
window.addEventListener('pageshow', syncDownloadConsent);
for (const link of downloads) {
  link.addEventListener('click', (event) => {
    if (!consent.checked) {
      event.preventDefault();
      syncDownloadConsent();
      consent.focus();
    }
  });
  link.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !consent.checked) {
      event.preventDefault();
      consent.focus();
    }
  });
}
syncDownloadConsent();

function openLinkedDetails() {
  const target = document.getElementById(window.location.hash.slice(1));
  if (target instanceof HTMLDetailsElement) target.open = true;
}

window.addEventListener('hashchange', openLinkedDetails);
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', () => {
    const target = document.getElementById(link.hash.slice(1));
    if (target instanceof HTMLDetailsElement) target.open = true;
  });
});
openLinkedDetails();

const copyStatus = document.getElementById('copy-status');
document.querySelectorAll('.copy-btn').forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      button.textContent = 'Copied';
      copyStatus.textContent = 'Checksum copied.';
    } catch {
      const checksum = button.parentElement.querySelector('code');
      const range = document.createRange();
      range.selectNodeContents(checksum);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      button.textContent = 'Selected';
      copyStatus.textContent = 'Checksum selected. Press Ctrl+C to copy.';
    }
  });
});
