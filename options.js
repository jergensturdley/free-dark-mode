const DEFAULTS = {
  enabled: true,
  siteOverrides: {},
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

const PRESET_THEMES = {
  slate: {
    bg: '#111827',
    fg: '#e5e7eb',
    link: '#93c5fd',
    border: 'rgba(255, 255, 255, 0.14)',
    surface: 'rgba(255, 255, 255, 0.06)',
    tagBg: 'rgba(147, 197, 253, 0.18)',
    tagFg: '#dbeafe',
    tagBorder: 'rgba(147, 197, 253, 0.34)'
  },
  graphite: {
    bg: '#101214',
    fg: '#f3f4f6',
    link: '#a7f3d0',
    border: 'rgba(255, 255, 255, 0.16)',
    surface: 'rgba(255, 255, 255, 0.08)',
    tagBg: 'rgba(255, 255, 255, 0.1)',
    tagFg: '#f9fafb',
    tagBorder: 'rgba(255, 255, 255, 0.22)'
  },
  forest: {
    bg: '#0b1b16',
    fg: '#e5fff4',
    link: '#86efac',
    border: 'rgba(134, 239, 172, 0.24)',
    surface: 'rgba(110, 231, 183, 0.08)',
    tagBg: 'rgba(52, 211, 153, 0.18)',
    tagFg: '#d1fae5',
    tagBorder: 'rgba(52, 211, 153, 0.34)'
  },
  amber: {
    bg: '#1b1408',
    fg: '#fff7ed',
    link: '#fdba74',
    border: 'rgba(251, 191, 36, 0.24)',
    surface: 'rgba(251, 191, 36, 0.08)',
    tagBg: 'rgba(245, 158, 11, 0.2)',
    tagFg: '#fffbeb',
    tagBorder: 'rgba(245, 158, 11, 0.36)'
  },
  contrast: {
    bg: '#05070a',
    fg: '#ffffff',
    link: '#7dd3fc',
    border: 'rgba(255, 255, 255, 0.28)',
    surface: 'rgba(255, 255, 255, 0.1)',
    tagBg: 'rgba(125, 211, 252, 0.24)',
    tagFg: '#ffffff',
    tagBorder: 'rgba(125, 211, 252, 0.42)'
  }
};

const SIMPLE_CONTROLS = [
  ['brightness', 'brightness', 'range'],
  ['contrast', 'contrast', 'range'],
  ['sepia', 'sepia', 'range'],
  ['grayscale', 'grayscale', 'range'],
  ['hue', 'hue', 'range'],
  ['bg', 'bg', 'color'],
  ['fg', 'fg', 'color'],
  ['link', 'link', 'color'],
  ['tag-fg', 'tagFg', 'color'],
  ['detect-lightness', 'detectLightness', 'range'],
  ['detect-opacity', 'detectOpacity', 'range'],
  ['detect-tags', 'detectTags', 'checkbox']
];

const RGBA_CONTROLS = [
  ['border', 'border'],
  ['surface', 'surface'],
  ['tag-bg', 'tagBg'],
  ['tag-border', 'tagBorder']
];

// Draft theme to hold in-memory state during rapid edits
let draftTheme = { ...DEFAULTS.theme };

function el(id) {
  return document.getElementById(id);
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex) {
  const cleanHex = hex.replace(/^#/, '');
  const bigint = parseInt(cleanHex, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

function parseRgbaValue(value) {
  const match = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
  if (!match) return null;
  return {
    r: parseInt(match[1], 10),
    g: parseInt(match[2], 10),
    b: parseInt(match[3], 10),
    a: match[4] == null ? 1 : parseFloat(match[4])
  };
}

function setRangeValueLabel(id, value) {
  const valueEl = el(`${id}-value`);
  if (valueEl) valueEl.textContent = `${value}%`;
}

// Extract hostname from a URL or return the string if it's already a hostname
function extractHostname(input) {
  let urlStr = input.trim();
  if (!urlStr) return null;
  
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(urlStr)) {
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      return null;
    }
  } else if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
    urlStr = 'https://' + urlStr;
  }
  
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname.toLowerCase();
    
    if (!hostname || hostname === 'extensions') {
      return null;
    }
    if (!hostname.includes('.') && hostname !== 'localhost') {
      return null;
    }
    return hostname;
  } catch (e) {
    return null;
  }
}

async function loadState() {
  return chrome.storage.local.get(DEFAULTS);
}

let saveTimeout;
function saveThemeDebounced() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    await chrome.storage.local.set({ theme: draftTheme });
    refreshAllTabs();
  }, 150);
}

async function setEnabled(enabled) {
  await chrome.storage.local.set({ enabled });
  refreshAllTabs();
}

function refreshAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'refresh-dark-mode' }).catch(() => {});
      }
    }
  });
}

async function toggleSite(hostname) {
  const { siteOverrides } = await loadState();
  const next = { ...(siteOverrides || {}) };
  next[hostname] = !next[hostname];
  await chrome.storage.local.set({ siteOverrides: next });
  await renderSites();
  refreshAllTabs();
}

async function removeSite(hostname) {
  const { siteOverrides } = await loadState();
  const next = { ...(siteOverrides || {}) };
  delete next[hostname];
  await chrome.storage.local.set({ siteOverrides: next });
  await renderSites();
  refreshAllTabs();
}

async function addSite(rawInput) {
  const errorEl = el('add-site-error');
  if (errorEl) errorEl.textContent = '';
  
  const hostname = extractHostname(rawInput);
  if (!hostname) {
    if (errorEl) errorEl.textContent = 'Please enter a valid website domain (e.g. example.com)';
    return false;
  }
  
  const { siteOverrides } = await loadState();
  const next = { ...(siteOverrides || {}) };
  next[hostname] = false;
  await chrome.storage.local.set({ siteOverrides: next });
  await renderSites();
  refreshAllTabs();
  return true;
}

async function renderSites() {
  const { siteOverrides } = await loadState();
  const list = el('site-list');
  const entries = Object.entries(siteOverrides || {});
  list.innerHTML = '';

  if (!entries.length) {
    list.textContent = 'No per-site overrides yet.';
    return;
  }

  for (const [host, enabled] of entries) {
    const row = document.createElement('div');
    row.className = 'site-row';

    const label = document.createElement('span');
    label.textContent = `${host} — ${enabled ? 'enabled' : 'disabled'}`;

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';

    const toggle = document.createElement('button');
    toggle.textContent = enabled ? 'Disable' : 'Enable';
    toggle.type = 'button';
    toggle.addEventListener('click', () => toggleSite(host));

    const remove = document.createElement('button');
    remove.textContent = 'Remove';
    remove.type = 'button';
    remove.addEventListener('click', () => removeSite(host));

    actions.append(toggle, remove);
    row.append(label, actions);
    list.appendChild(row);
  }
}

function updateBorderSurfaceTheme(type) {
  const colorInput = el(`${type}-color`);
  const opacityInput = el(`${type}-opacity`);
  const themeKey = type.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
  
  if (colorInput && opacityInput) {
    const hex = colorInput.value;
    const opacity = parseInt(opacityInput.value, 10) / 100;
    const rgb = hexToRgb(hex);
    draftTheme[themeKey] = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
  }
  
  updatePresetSelect();
  applyThemeToPreview(draftTheme);
  saveThemeDebounced();
}

function syncThemeInputs() {
  for (const [id, themeKey, type] of SIMPLE_CONTROLS) {
    const input = el(id);
    if (!input) continue;
    if (type === 'checkbox') {
      input.checked = !!draftTheme[themeKey];
      continue;
    }
    input.value = String(draftTheme[themeKey]);
    if (type === 'range') setRangeValueLabel(id, input.value);
  }

  for (const [idPrefix, themeKey] of RGBA_CONTROLS) {
    const colorInput = el(`${idPrefix}-color`);
    const opacityInput = el(`${idPrefix}-opacity`);
    const opacityValue = el(`${idPrefix}-opacity-value`);
    if (!colorInput || !opacityInput || !opacityValue) continue;
    const parsed = parseRgbaValue(draftTheme[themeKey] || DEFAULTS.theme[themeKey]);
    if (!parsed) continue;
    colorInput.value = rgbToHex(parsed.r, parsed.g, parsed.b);
    const opacity = Math.round(parsed.a * 100);
    opacityInput.value = String(opacity);
    opacityValue.textContent = `${opacity}%`;
  }
}

function detectPreset(theme) {
  for (const [name, preset] of Object.entries(PRESET_THEMES)) {
    if (Object.entries(preset).every(([key, value]) => theme[key] === value)) {
      return name;
    }
  }
  return 'custom';
}

function updatePresetSelect() {
  const presetSelect = el('palette-preset');
  if (presetSelect) presetSelect.value = detectPreset(draftTheme);
}

function wireThemeControls() {
  for (const [id, themeKey, type] of SIMPLE_CONTROLS) {
    const input = el(id);
    if (!input) continue;
    const eventName = type === 'checkbox' ? 'change' : 'input';
    input.addEventListener(eventName, () => {
      draftTheme[themeKey] = type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
      if (type === 'range') setRangeValueLabel(id, input.value);
      updatePresetSelect();
      applyThemeToPreview(draftTheme);
      saveThemeDebounced();
    });
  }
  
  for (const [idPrefix] of RGBA_CONTROLS) {
    const colorInput = el(`${idPrefix}-color`);
    const opacityInput = el(`${idPrefix}-opacity`);
    const opacityValue = el(`${idPrefix}-opacity-value`);

    if (colorInput && opacityInput && opacityValue) {
      
      colorInput.addEventListener('input', () => updateBorderSurfaceTheme(idPrefix));
      opacityInput.addEventListener('input', () => {
        opacityValue.textContent = `${opacityInput.value}%`;
        updateBorderSurfaceTheme(idPrefix);
      });
    }
  }

  const presetSelect = el('palette-preset');
  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      if (presetSelect.value === 'custom') return;
      draftTheme = { ...draftTheme, ...PRESET_THEMES[presetSelect.value] };
      syncThemeInputs();
      applyThemeToPreview(draftTheme);
      saveThemeDebounced();
    });
  }
}

function applyThemeToPreview(themePartial) {
  const previewPane = el('preview-pane');
  if (!previewPane) return;
  
  // Merge defaults to ensure no missing values break the preview
  const theme = { ...DEFAULTS.theme, ...(themePartial || {}) };
  
  previewPane.style.setProperty('--ldr-brightness', `${theme.brightness}%`);
  previewPane.style.setProperty('--ldr-contrast', `${theme.contrast}%`);
  previewPane.style.setProperty('--ldr-sepia', `${theme.sepia}%`);
  previewPane.style.setProperty('--ldr-grayscale', `${theme.grayscale}%`);
  previewPane.style.setProperty('--ldr-hue', `${theme.hue}deg`);
  previewPane.style.setProperty('--ldr-bg', theme.bg);
  previewPane.style.setProperty('--ldr-fg', theme.fg);
  previewPane.style.setProperty('--ldr-link', theme.link);
  previewPane.style.setProperty('--ldr-border', theme.border);
  previewPane.style.setProperty('--ldr-surface', theme.surface);
  previewPane.style.setProperty('--ldr-tag-bg', theme.tagBg);
  previewPane.style.setProperty('--ldr-tag-fg', theme.tagFg);
  previewPane.style.setProperty('--ldr-tag-border', theme.tagBorder);
  
  previewPane.setAttribute('data-free-dark-mode', 'on');
  previewPane.setAttribute('data-free-dark-mode-mode', 'light');
}

document.addEventListener('DOMContentLoaded', async () => {
  const state = await loadState();
  
  // Initialize draft theme with merged state to ensure complete theme data
  draftTheme = { ...DEFAULTS.theme, ...(state.theme || {}) };
  
  const enableToggle = el('global-enable');
  if (enableToggle) {
    enableToggle.checked = state.enabled;
    enableToggle.addEventListener('change', async (e) => {
      await setEnabled(e.target.checked);
    });
  }

  const addSiteBtn = el('add-site-btn');
  const addSiteInput = el('add-site-input');
  if (addSiteBtn && addSiteInput) {
    addSiteBtn.addEventListener('click', async () => {
      const val = addSiteInput.value.trim();
      if (val) {
        const success = await addSite(val);
        if (success) addSiteInput.value = '';
      }
    });
    
    addSiteInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        const val = addSiteInput.value.trim();
        if (val) {
          const success = await addSite(val);
          if (success) addSiteInput.value = '';
        }
      }
    });
  }

  wireThemeControls();
  syncThemeInputs();
  updatePresetSelect();
  applyThemeToPreview(draftTheme);
  await renderSites();
});
