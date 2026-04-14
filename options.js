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
    surface: 'rgba(255, 255, 255, 0.06)'
  }
};

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
  
  if (colorInput && opacityInput) {
    const hex = colorInput.value;
    const opacity = parseInt(opacityInput.value, 10) / 100;
    const rgb = hexToRgb(hex);
    draftTheme[type] = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
  }
  
  applyThemeToPreview(draftTheme);
  saveThemeDebounced();
}

function wireThemeControls() {
  const standardKeys = ['brightness', 'contrast', 'sepia', 'grayscale', 'hue', 'bg', 'fg', 'link'];
  for (const key of standardKeys) {
    const input = el(key);
    if (!input) continue;
    input.value = String(draftTheme[key] !== undefined ? draftTheme[key] : DEFAULTS.theme[key]);
    input.addEventListener('input', () => {
      draftTheme[key] = input.type === 'range' ? Number(input.value) : input.value;
      applyThemeToPreview(draftTheme);
      saveThemeDebounced();
    });
  }
  
  for (const type of ['border', 'surface']) {
    const colorInput = el(`${type}-color`);
    const opacityInput = el(`${type}-opacity`);
    const opacityValue = el(`${type}-opacity-value`);
    
    if (colorInput && opacityInput && opacityValue) {
      const themeVal = draftTheme[type] || DEFAULTS.theme[type];
      const match = themeVal.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
      if (match) {
        colorInput.value = rgbToHex(parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10));
        const opacity = Math.round(parseFloat(match[4]) * 100);
        opacityInput.value = String(opacity);
        opacityValue.textContent = `${opacity}%`;
      }
      
      colorInput.addEventListener('input', () => updateBorderSurfaceTheme(type));
      opacityInput.addEventListener('input', () => {
        opacityValue.textContent = `${opacityInput.value}%`;
        updateBorderSurfaceTheme(type);
      });
    }
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
  applyThemeToPreview(draftTheme);
  await renderSites();
});
