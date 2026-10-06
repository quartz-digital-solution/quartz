# Quartz Web Solutions — Ready to Deploy

This build is prepared for the existing Cloudflare Pages deployment at `quartzwebsolutions.com` and admin at `admin.quartzwebsolutions.com`.

## Simplified connected-site form
Removed manual fields:
- Google Maps URL
- Price range
- Latitude
- Longitude
- Instagram URL
- Facebook URL
- YouTube URL

Kept SEO-relevant inputs:
- Business name and URL slug
- Category and schema business type
- Products/services
- City, district, state
- Address and postal code
- Phone, WhatsApp, email
- Opening hours
- Business description
- Primary and secondary search phrases
- SEO title and meta description
- Logo
- index.html / full static website folder

## Automatic behavior
Saving or deploying a connected site automatically updates its D1 `updated_at` timestamp. The public renderer regenerates SEO title/description, canonical, Open Graph data, LocalBusiness schema, image metadata and local search phrases at request time from the current business data. The dynamic sitemap uses real site/file update timestamps. Multi-page HTML files remain discoverable in the dynamic sitemap.

Existing D1 databases that still contain the removed legacy columns do not need a manual migration; the new build simply ignores those columns.
