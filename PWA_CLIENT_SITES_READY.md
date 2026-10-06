# Client Website PWA + 3-Dot Loading Update

This build adds:

- Simple 3-dot loading screen on the Quartz main website instead of the old Q loader.
- Simple 3-dot global loader in Quartz Admin during login, refresh, opening a site, save/deploy and delete operations.
- Client icon upload normalized without cropping into 512x512, 192x192 and 180x180 PNG files.
- Publishing requires a client icon so a connected site is not deployed without its installable-app icon.
- Dynamic `site.webmanifest` per published client website.
- Dynamic scoped `sw.js` per published client website, registered automatically in every rendered HTML page.
- PWA start URL and scope are limited to the client path (for example `/lora-kondotty/`).
- The same uploaded client artwork is used for favicon, Apple icon, PWA icons and structured-data logo.
- Existing automatic SEO, schema, sitemap and `lastmod` behavior remains active.

After deployment, open a client site in Chrome/Android and reload once. Its manifest and service worker should register automatically. Install availability is ultimately controlled by the browser/OS.
