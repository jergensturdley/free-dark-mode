# Free Dark Mode

A privacy-first Chrome extension that darkens pages locally with no telemetry or external services.

## Load it in Chrome

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this folder: `~/dark-reader-local`

## What it does

- Runs entirely in your browser
- Stores settings locally with `chrome.storage.local`
- Lets you toggle dark mode globally or per site
- Provides adjustable tuning: brightness, contrast, sepia, grayscale, hue, colors
- Detects already-dark pages and avoids aggressive inversion there
- Leaves images and video alone instead of flipping everything
- Does not send page contents anywhere

## Files

- `manifest.json` — extension manifest
- `background.js` — local settings and message handling
- `content.js` — applies dark-mode styling to pages
- `popup.html` / `popup.js` / `popup.css` — toolbar UI
- `options.html` / `options.js` / `options.css` — per-site and tuning settings

## Notes

This is an MVP that should behave much better than pure inversion. The per-site list is editable locally, and the page detector tries to avoid darkening pages that are already dark.
