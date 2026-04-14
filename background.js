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

function getState() {
  return chrome.storage.local.get(DEFAULTS);
}

async function setEnabled(enabled) {
  await chrome.storage.local.set({ enabled: !!enabled });
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await getState();
  await chrome.storage.local.set(current);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'get-state') {
    getState().then(sendResponse);
    return true;
  }

  if (message?.type === 'set-enabled') {
    setEnabled(message.enabled).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === 'toggle-site') {
    chrome.storage.local.get(DEFAULTS).then(async ({ siteOverrides }) => {
      const url = message.url || sender?.tab?.url || '';
      const hostname = new URL(url).hostname;
      const next = { ...(siteOverrides || {}) };
      next[hostname] = !next[hostname];
      await chrome.storage.local.set({ siteOverrides: next });
      sendResponse({ ok: true, enabled: next[hostname] });
    });
    return true;
  }

  if (message?.type === 'remove-site') {
    chrome.storage.local.get(DEFAULTS).then(async ({ siteOverrides }) => {
      const next = { ...(siteOverrides || {}) };
      delete next[message.hostname];
      await chrome.storage.local.set({ siteOverrides: next });
      sendResponse({ ok: true });
    });
    return true;
  }
});
