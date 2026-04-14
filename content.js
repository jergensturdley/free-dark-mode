(() => {
  const STYLE_ID = 'free-dark-mode-style';
  const ROOT_ATTR = 'data-free-dark-mode';
  const MODE_ATTR = 'data-free-dark-mode-mode';

  const DEFAULT_THEME = {
    brightness: 92,
    contrast: 115,
    sepia: 4,
    grayscale: 0,
    hue: 0,
    bg: '#111827',
    fg: '#e5e7eb',
    link: '#93c5fd',
    border: 'rgba(255, 255, 255, 0.16)',
    surface: 'rgba(255, 255, 255, 0.04)'
  };

  function getHost(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return location.hostname;
    }
  }

  function parseRgb(color) {
    if (!color) return null;
    const m = String(color).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return null;
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  }

  function luminance(rgb) {
    if (!rgb) return 1;
    const [r, g, b] = rgb.map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function pageLooksDark() {
    const elements = [document.documentElement, document.body].filter(Boolean);
    for (const el of elements) {
      const cs = getComputedStyle(el);
      const bg = parseRgb(cs.backgroundColor);
      const fg = parseRgb(cs.color);
      if (bg && fg && luminance(bg) < 0.18 && luminance(fg) > 0.65) return true;
    }
    return false;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html[${ROOT_ATTR}="on"] {
        color-scheme: dark !important;
        background: var(--ldr-bg, #111827) !important;
        color: var(--ldr-fg, #e5e7eb) !important;
      }

      /* Apply filters to page content but exclude media/canvas/svg and known drawing surfaces (Excalidraw) */
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] body,
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] body *:not(img):not(video):not(canvas):not(svg):not(picture):not(embed):not(object):not(iframe):not(.excalidraw):not([data-excalidraw]):not([class*="excalidraw"]) {
        filter: brightness(var(--ldr-brightness, 92%)) contrast(var(--ldr-contrast, 115%)) sepia(var(--ldr-sepia, 4%)) grayscale(var(--ldr-grayscale, 0%)) hue-rotate(var(--ldr-hue, 0deg)) !important;
      }

      /* Dark mode filter (kept lightweight) also excludes canvases and Excalidraw */
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="dark"] body,
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="dark"] body *:not(img):not(video):not(canvas):not(svg):not(picture):not(embed):not(object):not(iframe):not(.excalidraw):not([data-excalidraw]):not([class*="excalidraw"]) {
        filter: brightness(100%) contrast(102%) saturate(100%) !important;
      }

      html[${ROOT_ATTR}="on"] body,
      html[${ROOT_ATTR}="on"] :is(main, article, section, nav, header, footer, aside, pre, code, blockquote, form, table, thead, tbody, tr) {
        background-color: transparent !important;
        color: inherit !important;
        border-color: var(--ldr-border, rgba(255, 255, 255, 0.14)) !important;
      }

      /* Improve coverage for modals, overlays, and fixed UI elements */
      html[${ROOT_ATTR}="on"] *:not(img):not(svg):not(canvas):not(video):not(picture):not(embed):not(object) {
        background-color: transparent !important;
        color: var(--ldr-fg, #e5e7eb) !important;
        border-color: var(--ldr-border, rgba(255, 255, 255, 0.14)) !important;
        box-shadow: none !important;
      }

      html[${ROOT_ATTR}="on"] *::before,
      html[${ROOT_ATTR}="on"] *::after {
        background-color: transparent !important;
        color: var(--ldr-fg, #e5e7eb) !important;
      }

      html[${ROOT_ATTR}="on"] :is(dialog, [role="dialog"], [class*="modal"], [id*="modal"], [class*="overlay"], .modal, .overlay, .popup, .popover, .modal-root, .ReactModal__Overlay, .Modal__overlay) {
        background-color: var(--ldr-surface, rgba(255, 255, 255, 0.06)) !important;
        color: var(--ldr-fg, #e5e7eb) !important;
        border-color: var(--ldr-border, rgba(255, 255, 255, 0.14)) !important;
      }

      /* Specific modal library overrides */
      /* Bootstrap */
      html[${ROOT_ATTR}="on"] .modal-backdrop,
      html[${ROOT_ATTR}="on"] .modal-backdrop.show {
        background-color: rgba(0,0,0,0.6) !important;
      }
      html[${ROOT_ATTR}="on"] .modal-content {
        background-color: var(--ldr-surface, rgba(255,255,255,0.06)) !important;
        color: var(--ldr-fg, #e5e7eb) !important;
        border-color: var(--ldr-border, rgba(255,255,255,0.14)) !important;
        box-shadow: none !important;
      }

      /* Ant Design */
      html[${ROOT_ATTR}="on"] .ant-modal-mask {
        background-color: rgba(0,0,0,0.6) !important;
      }
      html[${ROOT_ATTR}="on"] .ant-modal-content {
        background-color: var(--ldr-surface, rgba(255,255,255,0.06)) !important;
        color: var(--ldr-fg, #e5e7eb) !important;
      }

      /* Material UI */
      html[${ROOT_ATTR}="on"] .MuiBackdrop-root {
        background-color: rgba(0,0,0,0.6) !important;
      }
      html[${ROOT_ATTR}="on"] .MuiPaper-root,
      html[${ROOT_ATTR}="on"] .MuiDialog-paper {
        background-color: var(--ldr-surface, rgba(255,255,255,0.06)) !important;
        color: var(--ldr-fg, #e5e7eb) !important;
      }

      /* SweetAlert2 */
      html[${ROOT_ATTR}="on"] .swal2-container,
      html[${ROOT_ATTR}="on"] .swal2-popup {
        background-color: var(--ldr-surface, rgba(255,255,255,0.06)) !important;
        color: var(--ldr-fg, #e5e7eb) !important;
      }

      /* React Modal / Micromodal / Headless UI / Radix / common portals */
      html[${ROOT_ATTR}="on"] .ReactModal__Overlay,
      html[${ROOT_ATTR}="on"] .micromodal-overlay,
      html[${ROOT_ATTR}="on"] [data-headlessui-dialog-overlay],
      html[${ROOT_ATTR}="on"] [data-radix-dialog-overlay],
      html[${ROOT_ATTR}="on"] [data-radix-portal] {
        background-color: rgba(0,0,0,0.6) !important;
      }

      /* Tippy / Popper / Popover */
      html[${ROOT_ATTR}="on"] .tippy-box,
      html[${ROOT_ATTR}="on"] .tippy-content,
      html[${ROOT_ATTR}="on"] .popover,
      html[${ROOT_ATTR}="on"] .popover-body,
      html[${ROOT_ATTR}="on"] .popper,
      html[${ROOT_ATTR}="on"] .popper__content {
        background-color: var(--ldr-surface, rgba(255,255,255,0.06)) !important;
        color: var(--ldr-fg, #e5e7eb) !important;
      }

      /* Tailwind/Headless common overlay helpers */
      html[${ROOT_ATTR}="on"] .fixed.inset-0,
      html[${ROOT_ATTR}="on"] .fixed.inset-0.z-50,
      html[${ROOT_ATTR}="on"] [data-overlay] {
        background-color: rgba(0,0,0,0.55) !important;
      }

      html[${ROOT_ATTR}="on"] ::backdrop {
        background-color: rgba(0,0,0,0.6) !important;
      }

      /* Ensure fixed/absolute/sticky UI (to catch toolbars and overlays) uses surface color */
      html[${ROOT_ATTR}="on"] :is(*[style*="position:fixed"], *[style*="position: fixed"], *[style*="position:absolute"], *[style*="position: absolute"], *[style*="position:sticky"], *[style*="position: sticky"]) {
        background-color: var(--ldr-surface, rgba(255, 255, 255, 0.06)) !important;
        color: var(--ldr-fg, #e5e7eb) !important;
      }

      html[${ROOT_ATTR}="on"] :is(h1, h2, h3, h4, h5, h6) {
        color: var(--ldr-fg, #e5e7eb) !important;
      }

      html[${ROOT_ATTR}="on"] a,
      html[${ROOT_ATTR}="on"] a:visited {
        color: var(--ldr-link, #93c5fd) !important;
      }

      html[${ROOT_ATTR}="on"] :is(button, input, textarea, select) {
        background-color: var(--ldr-surface, rgba(255, 255, 255, 0.06)) !important;
        color: inherit !important;
        border-color: var(--ldr-border, rgba(255, 255, 255, 0.14)) !important;
        color-scheme: dark !important;
      }

      html[${ROOT_ATTR}="on"] :is(input::placeholder, textarea::placeholder) {
        color: rgba(229, 231, 235, 0.72) !important;
      }

      html[${ROOT_ATTR}="on"] :is(img, video, canvas, iframe, embed, object, picture, svg) {
        filter: none !important;
        mix-blend-mode: normal !important;
      }

      html[${ROOT_ATTR}="on"] ::selection {
        background: rgba(147, 197, 253, 0.35) !important;
        color: #fff !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function setTheme(theme) {
    const t = { ...DEFAULT_THEME, ...(theme || {}) };
    const root = document.documentElement;
    root.style.setProperty('--ldr-brightness', `${t.brightness}%`);
    root.style.setProperty('--ldr-contrast', `${t.contrast}%`);
    root.style.setProperty('--ldr-sepia', `${t.sepia}%`);
    root.style.setProperty('--ldr-grayscale', `${t.grayscale}%`);
    root.style.setProperty('--ldr-hue', `${t.hue}deg`);
    root.style.setProperty('--ldr-bg', t.bg);
    root.style.setProperty('--ldr-fg', t.fg);
    root.style.setProperty('--ldr-link', t.link);
    root.style.setProperty('--ldr-border', t.border);
    root.style.setProperty('--ldr-surface', t.surface);
  }

  function setMode() {
    const dark = pageLooksDark();
    document.documentElement.setAttribute(MODE_ATTR, dark ? 'dark' : 'light');
  }

  function setEnabled(enabled) {
    injectStyles();
    document.documentElement.setAttribute(ROOT_ATTR, enabled ? 'on' : 'off');
    if (enabled) startSanitizer(); else stopSanitizer();
  }

  // Remove inline styles that force light backgrounds/colors so our CSS can take effect
  let __ldr_observer = null;

  function sanitizeElement(el) {
    try {
      if (!el || el.nodeType !== 1) return;
      // Don't sanitize media/drawing surfaces or Excalidraw roots — they rely on inline styles
      const skipSelector = 'canvas, svg, img, video, picture, embed, object, .excalidraw, [data-excalidraw], [class*="excalidraw"]';
      if ((el.matches && el.matches(skipSelector)) || (el.closest && el.closest('.excalidraw, [data-excalidraw], [class*="excalidraw"]'))) return;
      const props = ['background', 'background-color', 'color', 'border-color', 'box-shadow', 'outline-color'];
      for (const p of props) {
        if (el.style && el.style.getPropertyValue(p)) {
          el.style.removeProperty(p);
        }
      }
      // recurse into shadow DOM if present
      if (el.shadowRoot) sanitizeInlineStyles(el.shadowRoot);
    } catch (e) {
      // ignore
    }
  }

  function sanitizeInlineStyles(root = document.documentElement) {
    try {
      const walker = (root.querySelectorAll ? Array.from(root.querySelectorAll('*')) : []);
      for (const el of walker) sanitizeElement(el);
    } catch (e) {
      // ignore
    }
  }

  function startSanitizer() {
    if (__ldr_observer) return;
    sanitizeInlineStyles();
    __ldr_observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) {
              sanitizeElement(node);
              if (node.querySelectorAll) node.querySelectorAll('*').forEach(sanitizeElement);
            }
          }
        } else if (m.type === 'attributes' && m.attributeName === 'style') {
          sanitizeElement(m.target);
        }
      }
    });
    __ldr_observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  }

  function stopSanitizer() {
    if (!__ldr_observer) return;
    __ldr_observer.disconnect();
    __ldr_observer = null;
  }

  async function sync() {
    const { enabled, siteOverrides, theme } = await chrome.runtime.sendMessage({ type: 'get-state' });
    const host = getHost(location.href);
    const siteEnabled = Object.prototype.hasOwnProperty.call(siteOverrides || {}, host)
      ? siteOverrides[host]
      : enabled;
    setTheme(theme);
    setMode();
    setEnabled(!!siteEnabled);
  }

  sync();

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'refresh-dark-mode') {
      sync();
    }
  });
})();
