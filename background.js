const DEFAULTS = {
  enabled: true,
  siteOverrides: {},
  elementOverrides: {},
  pickerSelection: null,
  theme: {
    brightness: 92,
    contrast: 102,
    sepia: 4,
    grayscale: 0,
    hue: 0,
    bg: '#111827',
    fg: '#e5e7eb',
    link: '#93c5fd',
    border: 'rgba(255, 255, 255, 0.14)',
    surface: 'rgba(255, 255, 255, 0.06)',
    tagBg: 'rgba(147, 197, 253, 0.18)',
    tagFg: '#dbeafe',
    tagBorder: 'rgba(147, 197, 253, 0.34)',
    detectLightness: 58,
    detectOpacity: 60,
    detectTags: true
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

  if (message?.type === 'set-picker-selection') {
    chrome.storage.local.set({ pickerSelection: message.selection || null }).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message?.type === 'save-element-override') {
    chrome.storage.local.get(DEFAULTS).then(async ({ elementOverrides, pickerSelection }) => {
      const selection = message.selection || pickerSelection;
      if (!selection?.host || !selection?.selector) {
        sendResponse({ ok: false, error: 'No selection available' });
        return;
      }

      const next = { ...(elementOverrides || {}) };
      const hostOverrides = { ...(next[selection.host] || {}) };
      hostOverrides[selection.selector] = {
        bg: message.colors?.bg,
        fg: message.colors?.fg,
        border: message.colors?.border,
        label: selection.label,
      };
      next[selection.host] = hostOverrides;

      await chrome.storage.local.set({ elementOverrides: next, pickerSelection: selection });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message?.type === 'clear-element-override') {
    chrome.storage.local.get(DEFAULTS).then(async ({ elementOverrides, pickerSelection }) => {
      const selection = message.selection || pickerSelection;
      if (!selection?.host || !selection?.selector) {
        sendResponse({ ok: false, error: 'No selection available' });
        return;
      }

      const next = { ...(elementOverrides || {}) };
      const hostOverrides = { ...(next[selection.host] || {}) };
      delete hostOverrides[selection.selector];

      if (Object.keys(hostOverrides).length) {
        next[selection.host] = hostOverrides;
      } else {
        delete next[selection.host];
      }

      await chrome.storage.local.set({ elementOverrides: next, pickerSelection: selection });
      sendResponse({ ok: true });
    });
    return true;
  }
});
