(() => {
  const STYLE_ID = 'free-dark-mode-style';
  const ROOT_ATTR = 'data-free-dark-mode';
  const MODE_ATTR = 'data-free-dark-mode-mode';
  const MIXED_SURFACE_ATTR = 'data-free-dark-mode-mixed-surface';

  const SITE_FIXES = {
    'alternativeto.net': {
      forceLightMode: true,
      useDirectDarkening: true,
    },
  };

  function applyDirectDarkening() {
    const host = getHost(location.href);
    const siteFix = SITE_FIXES[host];
    if (!siteFix?.useDirectDarkening) return;

    const elements = document.querySelectorAll('div, article, section, li');
    elements.forEach(el => {
      const style = window.getComputedStyle(el);
      const bg = style.backgroundColor;
      
      if (bg && bg.includes('rgb(')) {
        const rgb = bg.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
          const [r, g, b] = rgb.map(Number);
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          
          if (luminance > 0.5) {
            el.style.setProperty('background-color', '#1a1f2e', 'important');
          }
        }
      }
    });
  }

  const DEFAULT_THEME = {
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
  };

  function getHost(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return location.hostname;
    }
  }

  // ---------------------------------------------------------------------------
  // Color utilities
  // ---------------------------------------------------------------------------

  function parseRgba(color) {
    if (!color || color === 'transparent') return null;
    const m = String(color).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
    if (!m) return null;
    return {
      r: Number(m[1]),
      g: Number(m[2]),
      b: Number(m[3]),
      a: m[4] == null ? 1 : Number(m[4])
    };
  }

  function luminance({ r, g, b }) {
    const lin = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  // Walk up the DOM to find the first element with an opaque background.
  function effectiveBackground(el) {
    let node = el;
    while (node && node.nodeType === 1) {
      const bg = parseRgba(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0.85) return bg;
      node = node.parentElement;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Dark-page detection — layered heuristics (strongest signal first)
  // ---------------------------------------------------------------------------

  function hasExplicitDarkHint() {
    const html = document.documentElement;
    const body = document.body;

    // 1. Explicit data attributes used by GitHub, VS Code web, etc.
    const dataColorMode = html.getAttribute('data-color-mode');
    if (dataColorMode === 'dark' || dataColorMode === 'auto') {
      // 'auto' means "follow OS"; if OS is dark, the page is dark too
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (dataColorMode === 'dark' || (dataColorMode === 'auto' && prefersDark)) return true;
    }

    // 2. Common theme data attributes
    const themeAttrs = [
      html.getAttribute('data-theme'),
      body ? body.getAttribute('data-theme') : null,
      html.getAttribute('data-bs-theme'),
      html.getAttribute('data-mantine-color-scheme'),
    ].filter(Boolean).join(' ');
    if (/\b(dark|night|dim)\b/i.test(themeAttrs)) return true;

    // 3. Common dark-mode CSS classes on <html> or <body>
    const classTokens = [
      html.className,
      body ? body.className : '',
    ].join(' ');
    if (/\b(dark|dark-theme|theme-dark|theme--dark|night-mode|dim|darkmode)\b/i.test(classTokens)) return true;

    if (document.querySelector('meta[name="darkreader-lock"]')) return true;

    // 4. <meta name="color-scheme" content="dark"> or "dark light"
    const metaCS = document.querySelector(
      'meta[name="color-scheme"], meta[name="supported-color-schemes"]'
    );
    if (metaCS && /\bdark\b/i.test(metaCS.getAttribute('content') || '')) return true;

    // 5. Computed color-scheme on :root
    const computedCS = getComputedStyle(html).colorScheme || '';
    if (/\bdark\b/i.test(computedCS)) return true;

    return false;
  }

  function isAppOrCanvasPage() {
    if (location.hostname === 'excalidraw.com') return true;
    if (document.querySelector('.excalidraw, [data-excalidraw], [role="application"]')) return true;

    const viewportArea = window.innerWidth * window.innerHeight;
    if (!viewportArea) return false;

    const surfaces = Array.from(document.querySelectorAll('canvas, svg'));
    return surfaces.some((el) => {
      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      return rect.width >= window.innerWidth * 0.5
        && rect.height >= window.innerHeight * 0.4
        && area >= viewportArea * 0.35;
    });
  }

  // Returns 'dark' | 'light' | 'mixed'.
  // 'mixed' = dark shell with significant light content islands (e.g. alternativeto.net).
  // 'dark'  = already-dark page — do nothing.
  // 'light' = light/neutral page — apply darkening filter.
  function detectPageMode() {
    const host = getHost(location.href);
    const siteFix = SITE_FIXES[host];
    if (siteFix?.forceLightMode) {
      console.log('[Free Dark Mode] Forcing light mode for', host);
      return 'light';
    }

    if (hasExplicitDarkHint()) return 'dark';
    if (isAppOrCanvasPage()) return 'dark';

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const viewportArea = vw * vh;

    const alwaysCheck = [document.documentElement, document.body].filter(Boolean);
    const sizedCandidates = [
      document.querySelector('main'),
      document.querySelector('[role="main"]'),
      document.querySelector('#app'),
      document.querySelector('#root'),
      document.querySelector('#__next'),
    ].filter((el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width * r.height >= viewportArea * 0.1;
    });

    const shellCandidates = [...new Set([...alwaysCheck, ...sizedCandidates])];

    let darkShellVotes = 0;
    let shellTotal = 0;

    for (const el of shellCandidates) {
      const bg = effectiveBackground(el);
      if (!bg) continue;
      shellTotal++;
      if (luminance(bg) < 0.22) darkShellVotes++;
    }

    const shellIsDark = shellTotal > 0 && darkShellVotes / shellTotal >= 0.6;
    if (!shellIsDark) return 'light';

    // Shell is dark. Now check if there are significant light-background content
    // islands. Sample a grid of points across the viewport and count light hits.
    const SAMPLES = 12;
    let lightHits = 0;
    let validHits = 0;

    for (let row = 0; row < SAMPLES; row++) {
      for (let col = 0; col < SAMPLES; col++) {
        const x = (col + 0.5) * (vw / SAMPLES);
        const y = (row + 0.5) * (vh / SAMPLES);
        const el = document.elementFromPoint(x, y);
        if (!el || el === document.documentElement || el === document.body) continue;
        const bg = parseRgba(getComputedStyle(el).backgroundColor);
        if (!bg || bg.a < 0.85) continue;
        validHits++;
        if (luminance(bg) > 0.5) lightHits++;
      }
    }

    // If more than 20% of sampled content points are light, treat as mixed.
    // Lowered threshold to catch more mixed pages.
    if (validHits > 0 && lightHits / validHits > 0.2) return 'mixed';

    return 'dark';
  }

  function clearMixedSurfaces() {
    document.querySelectorAll(`[${MIXED_SURFACE_ATTR}="on"]`).forEach((el) => {
      el.removeAttribute(MIXED_SURFACE_ATTR);
    });
  }

  function markMixedSurfaces() {
    clearMixedSurfaces();

    if (document.documentElement.getAttribute(MODE_ATTR) !== 'mixed') return;

    const host = getHost(location.href);
    const siteFix = SITE_FIXES[host];
    if (siteFix?.mixedSurfaceSelectors?.length) {
      document.querySelectorAll(siteFix.mixedSurfaceSelectors.join(', ')).forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        if (el.querySelector('img, video, canvas, picture, iframe')) return;
        el.setAttribute(MIXED_SURFACE_ATTR, 'on');
        const block = el.closest('article, section, li, div');
        if (block instanceof HTMLElement) {
          block.setAttribute(MIXED_SURFACE_ATTR, 'on');
        }
      });
    }

    const viewportArea = window.innerWidth * window.innerHeight;
    if (!viewportArea) return;

    const candidates = Array.from(document.querySelectorAll('main, article, section, div, li'));
    for (const el of candidates) {
      if (!(el instanceof HTMLElement)) continue;
      if (el === document.body || el === document.documentElement) continue;

      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (rect.width < window.innerWidth * 0.28) continue;
      if (rect.height < 120) continue;
      if (area < viewportArea * 0.025) continue;

      const style = getComputedStyle(el);
      const bg = parseRgba(style.backgroundColor);
      if (!bg || bg.a < 0.6) continue;
      if (luminance(bg) < 0.58) continue;

      const textLength = (el.innerText || '').trim().length;
      if (textLength < 20 && el.children.length < 2) continue;

      el.setAttribute(MIXED_SURFACE_ATTR, 'on');
    }
  }

  // ---------------------------------------------------------------------------
  // CSS injection — minimal, non-destructive, 3-mode
  // ---------------------------------------------------------------------------
  //
  //  'light'  — clearly light page. Single filter on <html> darkens the whole
  //             page. Media elements get the inverse filter to stay natural.
  //             Structural containers and neutral form fields get explicit
  //             dark overrides. Buttons untouched (semantic color).
  //
  //  'dark'   — already-dark page (GitHub, VS Code web, etc.). TRUE NO-OP.
  //             No filters, no color overrides, no color-scheme forcing.
  //             The site renders entirely on its own.
  //
  //  'mixed'  — dark shell with light content islands (alternativeto.net).
  //             invert(1) hue-rotate(180deg) on <html> is the only CSS-only
  //             technique that flips dark→light and light→dark simultaneously.
  //             Media elements re-inverted back. Tradeoff: brand colors shift.

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* ── Anti-FOUC: Hide page until mode is determined ─────────────────── */
      html[${ROOT_ATTR}="initializing"] {
        opacity: 0 !important;
        transition: opacity 0.1s ease-out !important;
      }
      
      html[${ROOT_ATTR}="on"] {
        opacity: 1 !important;
        transition: filter 0.3s ease-out, opacity 0.3s ease-out !important;
      }
      
      /* ── Root ──────────────────────────────────────────────────────────── */
      /* color-scheme only set in transformed modes so we don't interfere    */
      /* with dark sites that manage their own native widget styling.        */
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] {
        color-scheme: dark !important;
      }

      html[${ROOT_ATTR}="on"][${MODE_ATTR}="mixed"] {
        color-scheme: dark !important;
      }

      /* ── Dark-page mode: true no-op ─────────────────────────────────────── */
      /* Site is already dark. Touch nothing — no filters, no color overrides, */
      /* no color-scheme forcing. Let the site render entirely on its own.     */
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="dark"] {}

      /* ── Light-page mode: root-level filter darkens everything ─────────── */
      /* Single filter on <html> (not body/*) avoids double-filtering and     */
      /* preserves position:fixed per spec since <html> is the root.          */
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] {
        filter: brightness(var(--ldr-brightness, 92%))
                contrast(var(--ldr-contrast, 108%))
                sepia(var(--ldr-sepia, 4%))
                grayscale(var(--ldr-grayscale, 0%))
                hue-rotate(var(--ldr-hue, 0deg)) !important;
        background: var(--ldr-bg, #111827) !important;
        color: var(--ldr-fg, #e5e7eb) !important;
      }

      /* Counteract the html filter on media so images/video stay natural.   */
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] img,
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] video,
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] canvas,
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] picture,
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] embed,
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] object,
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] iframe {
        filter: brightness(calc(100% / var(--ldr-brightness, 92%)))
                contrast(calc(100% / var(--ldr-contrast, 108%)))
                sepia(0%) grayscale(0%)
                hue-rotate(calc(-1 * var(--ldr-hue, 0deg))) !important;
      }

      /* ── Mixed-page mode: whole-page inversion ──────────────────────────── */
      /* For pages with a dark shell but light content islands (alternativeto, */
      /* some dashboards). invert+hue-rotate flips dark→light and light→dark  */
      /* simultaneously — the only CSS-only way to darken both regions.       */
      /* Tradeoff: brand colors shift; acceptable given no JS rewriting.       */
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="mixed"] {}

      html[${ROOT_ATTR}="on"][${MODE_ATTR}="mixed"] [${MIXED_SURFACE_ATTR}="on"] {
        background-color: var(--ldr-bg, #111827) !important;
        color: var(--ldr-fg, #e5e7eb) !important;
        border-color: var(--ldr-border, rgba(255, 255, 255, 0.14)) !important;
      }

      html[${ROOT_ATTR}="on"][${MODE_ATTR}="mixed"] [${MIXED_SURFACE_ATTR}="on"] :is(div, article, section, header, footer, aside, ul, ol, li, dl, form) {
        color: inherit !important;
        border-color: inherit !important;
      }

      html[${ROOT_ATTR}="on"][${MODE_ATTR}="mixed"] [${MIXED_SURFACE_ATTR}="on"] :is(div, article, section, header, footer, aside, ul, ol, li, dl, form):not(img):not(video):not(canvas):not(svg):not(picture):not(iframe) {
        background-color: transparent !important;
      }

      html[${ROOT_ATTR}="on"][${MODE_ATTR}="mixed"] [${MIXED_SURFACE_ATTR}="on"] :is(h1, h2, h3, h4, h5, h6, p, span, strong, em, li, dt, dd, small, label, button) {
        color: inherit !important;
      }

      html[${ROOT_ATTR}="on"][${MODE_ATTR}="mixed"] [${MIXED_SURFACE_ATTR}="on"] :is(pre, code, blockquote, table, thead, tbody, tfoot, tr, th, td) {
        background-color: transparent !important;
        color: inherit !important;
        border-color: var(--ldr-border, rgba(255, 255, 255, 0.14)) !important;
      }

      html[${ROOT_ATTR}="on"][${MODE_ATTR}="mixed"] [${MIXED_SURFACE_ATTR}="on"] a,
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="mixed"] [${MIXED_SURFACE_ATTR}="on"] a:visited {
        color: var(--ldr-link, #93c5fd) !important;
      }

      html[${ROOT_ATTR}="on"][${MODE_ATTR}="mixed"] [${MIXED_SURFACE_ATTR}="on"] :is(input:not([type="color"]):not([type="range"]):not([type="checkbox"]):not([type="radio"]), textarea, select) {
        background-color: var(--ldr-surface, rgba(255, 255, 255, 0.06)) !important;
        color: var(--ldr-fg, #e5e7eb) !important;
        border-color: var(--ldr-border, rgba(255, 255, 255, 0.14)) !important;
        color-scheme: dark !important;
      }

      /* Re-invert media so photos/video look natural after the page invert.  */
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] :is(dialog, [role="dialog"], [role="menu"], [role="listbox"], [aria-modal="true"], [popover]) {
        background-color: var(--ldr-bg, #111827) !important;
        color: var(--ldr-fg, #e5e7eb) !important;
        border-color: var(--ldr-border, rgba(255, 255, 255, 0.14)) !important;
      }

      /* ── Structural containers (light mode only) ─────────────────────────  */
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] body {
        background-color: var(--ldr-bg, #111827) !important;
        color: var(--ldr-fg, #e5e7eb) !important;
      }

      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] :is(main, article, section, nav, header, footer, aside) {
        background-color: transparent !important;
        color: inherit !important;
      }

      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] :is(pre, code, blockquote, table, thead, tbody, tfoot, tr, th, td) {
        background-color: transparent !important;
        color: inherit !important;
        border-color: var(--ldr-border, rgba(255, 255, 255, 0.14)) !important;
      }

      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] :is(h1, h2, h3, h4, h5, h6) {
        color: var(--ldr-fg, #e5e7eb) !important;
      }

      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] a,
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] a:visited {
        color: var(--ldr-link, #93c5fd) !important;
      }

      /* ── Neutral form fields (light mode only) ───────────────────────────  */
      /* Buttons excluded — they carry semantic brand/action color.           */
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] input:not([type="color"]):not([type="range"]):not([type="checkbox"]):not([type="radio"]),
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] textarea,
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] select {
        background-color: var(--ldr-surface, rgba(255, 255, 255, 0.06)) !important;
        color: var(--ldr-fg, #e5e7eb) !important;
        border-color: var(--ldr-border, rgba(255, 255, 255, 0.14)) !important;
        color-scheme: dark !important;
      }

      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] input::placeholder,
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] textarea::placeholder {
        color: rgba(229, 231, 235, 0.55) !important;
      }

      /* ── Selection ───────────────────────────────────────────────────────  */
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] ::selection {
        background: rgba(147, 197, 253, 0.35) !important;
        color: #fff !important;
      }

      /* ── Scrollbar (Webkit, light + mixed mode) ──────────────────────────  */
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"]::-webkit-scrollbar {
        background: #1a1f2e;
      }
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"]::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.18);
        border-radius: 4px;
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
    const mode = detectPageMode();
    console.log('[Free Dark Mode] Detected mode:', mode, 'for', location.hostname);
    document.documentElement.setAttribute(MODE_ATTR, mode);
    markMixedSurfaces();
    applyDirectDarkening();
    console.log('[Free Dark Mode] Marked', document.querySelectorAll(`[${MIXED_SURFACE_ATTR}="on"]`).length, 'mixed surfaces');
  }

  // Defer mode detection until styles are computed. At document_start the DOM
  // has no CSS applied yet — luminance sampling would always return 'light'.
  // We set the attribute early (prevents FOUC) but run the actual detection
  // after DOMContentLoaded + one rAF so computed backgrounds are available.
  // A second pass fires 800ms later for SPAs / lazy-painted pages.
  function scheduleSetMode() {
    const run = () => setMode();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        run();
        setTimeout(() => setMode(), 800);
        setTimeout(() => setMode(), 2000);
      }, { once: true });
    } else {
      run();
      setTimeout(() => setMode(), 800);
      setTimeout(() => setMode(), 2000);
    }
  }

  function observePageChanges() {
    const observer = new MutationObserver(() => {
      const mode = document.documentElement.getAttribute(MODE_ATTR);
      if (mode === 'mixed') {
        markMixedSurfaces();
      }
    });

    const target = document.body || document.documentElement;
    observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
  }

  function setEnabled(enabled) {
    injectStyles();
    const root = document.documentElement;
    if (!enabled) {
      root.setAttribute(ROOT_ATTR, 'off');
      return;
    }
    root.setAttribute(ROOT_ATTR, 'initializing');
    const mode = detectPageMode();
    root.setAttribute(MODE_ATTR, mode);
    requestAnimationFrame(() => {
      root.setAttribute(ROOT_ATTR, 'on');
    });
  }

  async function sync() {
    const { enabled, siteOverrides, theme } = await chrome.runtime.sendMessage({ type: 'get-state' });
    const host = getHost(location.href);
    const siteEnabled = Object.prototype.hasOwnProperty.call(siteOverrides || {}, host)
      ? siteOverrides[host]
      : enabled;
    setTheme(theme);
    if (siteEnabled) {
      setEnabled(true);
      scheduleSetMode();
      observePageChanges();
    } else {
      document.documentElement.setAttribute(ROOT_ATTR, 'off');
    }
  }

  sync();

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'refresh-dark-mode') {
      sync();
    }
  });
})();
