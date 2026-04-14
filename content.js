(() => {
  const STYLE_ID = 'free-dark-mode-style';
  const ROOT_ATTR = 'data-free-dark-mode';
  const MODE_ATTR = 'data-free-dark-mode-mode';

  const DEFAULT_THEME = {
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
    if (/\b(dark|dark-theme|theme-dark|night-mode|dim|darkmode)\b/i.test(classTokens)) return true;

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

  function pageLooksDark() {
    // Fast path: explicit signals are authoritative
    if (hasExplicitDarkHint()) return true;

    // Slow path: sample multiple viewport-filling containers
    const candidates = [
      document.documentElement,
      document.body,
      document.querySelector('main'),
      document.querySelector('[role="main"]'),
      document.querySelector('#app'),
      document.querySelector('#root'),
      document.querySelector('#__next'),
    ].filter(Boolean);

    let darkVotes = 0;
    for (const el of candidates) {
      // Skip tiny elements that don't represent the page background
      const rect = el.getBoundingClientRect();
      if (rect.width * rect.height < window.innerWidth * window.innerHeight * 0.2) continue;

      const bg = effectiveBackground(el);
      const fgRaw = parseRgba(getComputedStyle(el).color);
      if (!bg || !fgRaw) continue;

      if (luminance(bg) < 0.22 && luminance(fgRaw) > 0.6) {
        darkVotes++;
      }
    }

    // Require at least 2 dark-looking containers to avoid false positives
    return darkVotes >= 2;
  }

  // ---------------------------------------------------------------------------
  // CSS injection — minimal, non-destructive
  // ---------------------------------------------------------------------------
  //
  // Design principles (informed by Dark Reader analysis):
  //
  //  • NO universal `*` background/color/border/shadow resets — these kill
  //    colored badges, pills, syntax highlighting, glassmorphism, and GitHub's
  //    own dark theme. Dark Reader's own defaultFallbackFactory only targets
  //    html/body, not a wildcard.
  //
  //  • NO ::before/::after background overrides — pseudo-elements render colored
  //    orbs (alternativeto.net), notification dots, decorative icons.
  //
  //  • NO broad descendant `filter` rules — they compound with site filters,
  //    break stacking contexts, and override existing filter effects.
  //
  //  • NO inline-position-based surface rules — too blunt; breaks tooltips and
  //    native dark navbars.
  //
  //  • NO box-shadow removal — focus rings, elevation, glassmorphism all use it.
  //
  //  • Buttons left alone — they carry semantic color (green merge, red delete).
  //    Only neutral form fields (input/textarea/select) are themed.
  //
  //  • In dark mode (MODE_ATTR="dark"): do almost nothing. Let the site render
  //    naturally. Only apply a root-level filter for very subtle tuning and
  //    set color-scheme so native controls match.
  //
  //  • In light mode (MODE_ATTR="light"): apply a root-level filter to darken
  //    the whole page, then restore natural rendering on media/canvas/iframe.
  //    Then apply targeted overrides on structural containers and neutral
  //    form fields — never on elements that carry semantic color.

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* ── Root ──────────────────────────────────────────────────────────── */
      html[${ROOT_ATTR}="on"] {
        color-scheme: dark !important;
      }

      /* ── Light-page mode: root-level filter darkens everything ─────────── */
      /* Applied to <html> so the filter stacks once at the top, not per-    */
      /* element. This avoids the double-filtering problem of body+body *.   */
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] {
        filter: brightness(var(--ldr-brightness, 92%))
                contrast(var(--ldr-contrast, 108%))
                sepia(var(--ldr-sepia, 4%))
                grayscale(var(--ldr-grayscale, 0%))
                hue-rotate(var(--ldr-hue, 0deg)) !important;
        background: var(--ldr-bg, #111827) !important;
        color: var(--ldr-fg, #e5e7eb) !important;
      }

      /* Restore media/canvas/iframe to natural rendering.                   */
      /* filter:none undoes the inherited html-level filter via stacking.    */
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] img,
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] video,
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] canvas,
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] picture,
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] embed,
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] object,
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="light"] iframe {
        filter: brightness(calc(100% / var(--ldr-brightness, 92%)))
                contrast(calc(100% / var(--ldr-contrast, 108%)))
                sepia(0%)
                grayscale(0%)
                hue-rotate(calc(-1 * var(--ldr-hue, 0deg))) !important;
      }

      /* ── Dark-page mode: minimal non-destructive overlay ───────────────── */
      /* The site is already dark. We only set color-scheme (done on html    */
      /* above) so native controls (inputs, scrollbars) match the dark page. */
      /* No filters, no color overrides. Let the site render itself.         */
      html[${ROOT_ATTR}="on"][${MODE_ATTR}="dark"] {
        /* intentionally empty — site handles its own dark styling */
      }

      /* ── Structural containers (light mode only) ────────────────────────  */
      /* These are layout wrappers that should be transparent so the html    */
      /* background shows through. We avoid touching anything that carries   */
      /* semantic color (badges, buttons, alerts, chips, etc.).              */
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

      /* ── Neutral form fields only (light mode) ───────────────────────── */
      /* Explicitly excludes buttons — they carry semantic brand/action color */
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

      /* ── Selection ──────────────────────────────────────────────────────  */
      html[${ROOT_ATTR}="on"] ::selection {
        background: rgba(147, 197, 253, 0.35) !important;
        color: #fff !important;
      }

      /* ── Scrollbar (Webkit, light mode only) ────────────────────────────  */
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
    const dark = pageLooksDark();
    document.documentElement.setAttribute(MODE_ATTR, dark ? 'dark' : 'light');
  }

  function setEnabled(enabled) {
    injectStyles();
    document.documentElement.setAttribute(ROOT_ATTR, enabled ? 'on' : 'off');
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
