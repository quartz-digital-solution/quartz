# Quartz 1:1 Icon + Auto SEO build

## Connected-site icon workflow
- Admin accepts PNG, JPG/JPEG, WebP and SVG.
- Browser normalizes the selected artwork to square PNGs without cropping:
  - `site-icon-512.png` — primary business/schema icon
  - `site-icon-192.png` — favicon/PWA companion icon
- The artwork is contained inside the square with transparent padding when necessary.
- The connected site automatically receives favicon links, Apple touch icon and a dynamic `site.webmanifest`.
- The manifest publishes both 192×192 and 512×512 icons.

## Automatic SEO on every save/deploy
Quartz injects/refreshes for every published connected site and HTML subpage:
- SEO title and meta description (manual values win; otherwise automatic fallbacks)
- canonical URL
- robots index/follow directives
- Open Graph and Twitter metadata
- page/content image for social preview, business icon for schema logo
- LocalBusiness/store schema with category-aware automatic type fallback
- business address, phone, email, opening hours and services when supplied
- WebSite, WebPage, BreadcrumbList and ImageObject structured data
- descriptive image alt fallback when missing
- local search phrase generation from business name, category, city, district and services
- removal of obsolete `meta keywords`
- multi-page connected-site canonical/SEO handling
- dynamic sitemap entries and updated `lastmod` timestamps when site data/assets change
- business directory/internal links for published sites

## Google indexing
The technical SEO/discovery workflow is automatic after publishing. Google still decides when/if a URL is indexed and how it ranks.
One-time setup: verify `quartzwebsolutions.com` in Google Search Console and submit:
`https://quartzwebsolutions.com/sitemap.xml`
