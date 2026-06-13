const DEFAULTS = {
  enabled: true,
  siteOverrides: {},
  elementOverrides: {},
  pickerSelection: null,
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
    surface: 'rgba(255, 255, 255, 0.06)',
    tagBg: 'rgba(147, 197, 253, 0.18)',
    tagFg: '#dbeafe',
    tagBorder: 'rgba(147, 197, 253, 0.34)'
  }
};

async function getState() {
  return chrome.runtime.sendMessage({ type: 'get-state' });
}

async function setEnabled(enabled) {
  await chrome.runtime.sendMessage({ type: 'set-enabled', enabled });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    try {
      await ensureContentScript(tab);
      await chrome.tabs.sendMessage(tab.id, { type: 'refresh-dark-mode' });
    } catch {}
  }
}

async function ensureContentScript(tab) {
  if (!tab?.id || !getTabHost(tab.url)) {
    throw new Error('Unsupported tab');
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'ping-free-dark-mode' });
    return;
  } catch {}

  await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    files: ['content.js'],
  });
}

function rgbaOrHexToHex(color, fallback) {
  if (!color) return fallback;
  if (color.startsWith('#')) return color;
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/i);
  if (!match) return fallback;
  return `#${[match[1], match[2], match[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`;
}

function getTabHost(url) {
  try {
    if (!url || !/^https?:/i.test(url)) return null;
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function setPickerStatus(message) {
  const statusEl = document.getElementById('picker-status');
  if (statusEl) statusEl.textContent = message;
}

function getPresetColors(preset, theme) {
  if (preset === 'surface') {
    return {
      bg: rgbaOrHexToHex(theme.surface, '#1a1f2e'),
      fg: rgbaOrHexToHex(theme.fg, '#e5e7eb'),
      border: rgbaOrHexToHex(theme.border, '#93c5fd'),
    };
  }

  if (preset === 'tag') {
    return {
      bg: rgbaOrHexToHex(theme.tagBg, '#1d4ed8'),
      fg: rgbaOrHexToHex(theme.tagFg, '#dbeafe'),
      border: rgbaOrHexToHex(theme.tagBorder, '#93c5fd'),
    };
  }

  return null;
}

function setColorInputsDisabled(disabled) {
  ['picker-bg', 'picker-fg', 'picker-border'].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.disabled = disabled;
  });
}

function applyPresetToInputs(preset, theme) {
  const colors = getPresetColors(preset, theme);
  if (!colors) return;
  const bgEl = document.getElementById('picker-bg');
  const fgEl = document.getElementById('picker-fg');
  const borderEl = document.getElementById('picker-border');
  if (!bgEl || !fgEl || !borderEl) return;
  bgEl.value = colors.bg;
  fgEl.value = colors.fg;
  borderEl.value = colors.border;
}

function detectSelectionPreset(selection, saved, theme) {
  if (!saved || (!saved.bg && !saved.fg && !saved.border)) return 'custom';

  const surface = getPresetColors('surface', theme);
  const tag = getPresetColors('tag', theme);
  const current = {
    bg: rgbaOrHexToHex(saved.bg || selection?.bg, '#1a1f2e'),
    fg: rgbaOrHexToHex(saved.fg || selection?.fg, '#e5e7eb'),
    border: rgbaOrHexToHex(saved.border || selection?.border, '#93c5fd'),
  };

  if (surface && current.bg === surface.bg && current.fg === surface.fg && current.border === surface.border) {
    return 'surface';
  }

  if (tag && current.bg === tag.bg && current.fg === tag.fg && current.border === tag.border) {
    return 'tag';
  }

  return 'custom';
}

function updatePreview() {
  const preview = document.getElementById('picker-preview');
  const bg = document.getElementById('picker-bg')?.value;
  const fg = document.getElementById('picker-fg')?.value;
  const border = document.getElementById('picker-border')?.value;
  if (!preview || !bg || !fg || !border) return;
  preview.style.backgroundColor = bg;
  preview.style.color = fg;
  preview.style.borderColor = border;
}

function renderSelection(selection, state, host) {
  const detailsEl = document.getElementById('selection-details');
  const labelEl = document.getElementById('selection-label');
  const selectorEl = document.getElementById('selection-selector');
  const bgEl = document.getElementById('picker-bg');
  const fgEl = document.getElementById('picker-fg');
  const borderEl = document.getElementById('picker-border');
  const presetEl = document.getElementById('picker-preset');
  if (!detailsEl || !labelEl || !selectorEl || !bgEl || !fgEl || !borderEl || !presetEl) return;

  if (!selection || selection.host !== host) {
    detailsEl.hidden = true;
    setPickerStatus('No element selected yet.');
    return;
  }

  const saved = state.elementOverrides?.[host]?.[selection.selector] || {};
  detailsEl.hidden = false;
  labelEl.textContent = selection.label || 'Selected element';
  selectorEl.textContent = selection.selector;
  bgEl.value = rgbaOrHexToHex(saved.bg || selection.bg || state.theme.surface, '#1a1f2e');
  fgEl.value = rgbaOrHexToHex(saved.fg || selection.fg || state.theme.fg, '#e5e7eb');
  borderEl.value = rgbaOrHexToHex(saved.border || selection.border || state.theme.border, '#93c5fd');
  presetEl.value = detectSelectionPreset(selection, saved, state.theme || DEFAULTS.theme);
  setColorInputsDisabled(presetEl.value !== 'custom');
  setPickerStatus(`Picked on ${host}. Adjust colors and apply.`);
  updatePreview();
}

document.addEventListener('DOMContentLoaded', async () => {
  const enabledEl = document.getElementById('enabled');
  const toggleSiteEl = document.getElementById('toggle-site');
  const pickElementEl = document.getElementById('pick-element');
  const applyElementStyleEl = document.getElementById('apply-element-style');
  const clearElementStyleEl = document.getElementById('clear-element-style');
  const presetEl = document.getElementById('picker-preset');
  const pickerInputs = ['picker-bg', 'picker-fg', 'picker-border']
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const state = await getState();
  enabledEl.checked = !!state.enabled;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const host = getTabHost(tab?.url);
  renderSelection(state.pickerSelection, state, host);

  if (!host) {
    pickElementEl.disabled = true;
    setPickerStatus('Element picker is only available on normal web pages.');
  }

  pickerInputs.forEach((input) => input.addEventListener('input', updatePreview));
  presetEl?.addEventListener('change', async () => {
    const freshState = await getState();
    if (presetEl.value === 'custom') {
      setColorInputsDisabled(false);
      updatePreview();
      return;
    }

    if (presetEl.value === 'auto') {
      setColorInputsDisabled(true);
      updatePreview();
      return;
    }

    setColorInputsDisabled(true);
    applyPresetToInputs(presetEl.value, freshState.theme || DEFAULTS.theme);
    updatePreview();
  });

  enabledEl.addEventListener('change', async () => {
    await setEnabled(enabledEl.checked);
  });

  toggleSiteEl.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const response = await chrome.runtime.sendMessage({ type: 'toggle-site', url: tab.url });
    if (response?.ok) {
      try {
        await ensureContentScript(tab);
        await chrome.tabs.sendMessage(tab.id, { type: 'refresh-dark-mode' });
      } catch {
        setPickerStatus('Extension could not reach this page.');
      }
    }
  });

  pickElementEl?.addEventListener('click', async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) return;
    try {
      await ensureContentScript(activeTab);
      await chrome.tabs.sendMessage(activeTab.id, { type: 'start-element-picker' });
    } catch {
      setPickerStatus('Picker is unavailable on this page.');
      return;
    }
    window.close();
  });

  applyElementStyleEl?.addEventListener('click', async () => {
    const freshState = await getState();
    const selection = freshState.pickerSelection;
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!selection || !activeTab?.id) return;

    if (presetEl?.value === 'auto') {
      await chrome.runtime.sendMessage({ type: 'clear-element-override', selection });
      try {
        await ensureContentScript(activeTab);
        await chrome.tabs.sendMessage(activeTab.id, { type: 'refresh-element-overrides' });
      } catch {
        setPickerStatus('Override saved, but this page is not reachable right now.');
        return;
      }
      setPickerStatus('Auto-detect restored for this element.');
      renderSelection(selection, await getState(), host);
      return;
    }

    if (presetEl && presetEl.value !== 'custom') {
      applyPresetToInputs(presetEl.value, freshState.theme || DEFAULTS.theme);
    }

    await chrome.runtime.sendMessage({
      type: 'save-element-override',
      selection,
      colors: {
        bg: document.getElementById('picker-bg')?.value,
        fg: document.getElementById('picker-fg')?.value,
        border: document.getElementById('picker-border')?.value,
      },
    });
    try {
      await ensureContentScript(activeTab);
      await chrome.tabs.sendMessage(activeTab.id, { type: 'refresh-element-overrides' });
    } catch {
      setPickerStatus('Override saved, but this page is not reachable right now.');
      return;
    }
    setPickerStatus('Override applied on this site.');
    renderSelection(selection, await getState(), host);
  });

  clearElementStyleEl?.addEventListener('click', async () => {
    const freshState = await getState();
    const selection = freshState.pickerSelection;
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!selection || !activeTab?.id) return;

    await chrome.runtime.sendMessage({ type: 'clear-element-override', selection });
    try {
      await ensureContentScript(activeTab);
      await chrome.tabs.sendMessage(activeTab.id, { type: 'refresh-element-overrides' });
    } catch {
      setPickerStatus('Override cleared, but this page is not reachable right now.');
      return;
    }
    setPickerStatus('Override cleared for this element.');
    renderSelection(selection, await getState(), host);
  });
});
