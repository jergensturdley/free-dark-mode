const DEFAULTS = {
  enabled: true,
  siteOverrides: {},
  theme: {
    brightness: 92,
    contrast: 108,
    sepia: 4,
    grayscale: 0,
    hue: 0,
    bg: '#111827',
    fg: '#e5e7eb',
    link: '#93c5fd',
    border: 'rgba(255, 255, 255, 0.14)',
    surface: 'rgba(255, 255, 255, 0.06)'
  }
};

async function getState() {
  return chrome.runtime.sendMessage({ type: 'get-state' });
}

async function setEnabled(enabled) {
  await chrome.runtime.sendMessage({ type: 'set-enabled', enabled });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'refresh-dark-mode' });
}

document.addEventListener('DOMContentLoaded', async () => {
  const enabledEl = document.getElementById('enabled');
  const toggleSiteEl = document.getElementById('toggle-site');

  const state = await getState();
  enabledEl.checked = !!state.enabled;

  enabledEl.addEventListener('change', async () => {
    await setEnabled(enabledEl.checked);
  });

  toggleSiteEl.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const response = await chrome.runtime.sendMessage({ type: 'toggle-site', url: tab.url });
    if (response?.ok) {
      chrome.tabs.sendMessage(tab.id, { type: 'refresh-dark-mode' });
    }
  });
});
