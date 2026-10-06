# Quartz SEO + Google indexing guide

## What the platform now does automatically

- Every published connected site gets a clean canonical URL under `https://quartzwebsolutions.com/<site-slug>/`.
- Root pages and uploaded multi-page HTML files receive unique page titles/descriptions, `index,follow`, Open Graph/Twitter metadata, LocalBusiness + WebSite + WebPage + breadcrumb structured data, and image metadata.
- Quartz removes `meta keywords` because Google does not use that tag.
- Business name, category, city, district, state, services, address, postal code, phone, WhatsApp, email, opening hours, business description, primary keyword, secondary keywords, HTML and logo all feed the SEO renderer.
- Editing any of those fields and clicking Deploy updates SEO immediately and updates that site's sitemap `lastmod`. Uploading/replacing assets also updates the modification time.
- Uploaded HTML subpages are discovered and added to the dynamic sitemap.
- Published sites are linked from `/businesses/` and city directory pages, improving crawl discovery.
- Connected-site titles/snippets do not inject the Quartz brand. The public URL will still contain `quartzwebsolutions.com`; Google controls exactly how the host/site name appears in results. A separate custom domain is required if a client wants no Quartz domain visible at all.

## One-time Google Search Console setup (manual)

1. Open Google Search Console and add a **Domain property** for `quartzwebsolutions.com`.
2. Google gives a TXT verification value. In Cloudflare: **DNS → Records → Add record → TXT**, use the name/value Google provides.
3. Return to Search Console and verify.
4. Open **Sitemaps** and submit: `https://quartzwebsolutions.com/sitemap.xml`. Do this once. The sitemap itself updates automatically later.
5. Use **URL Inspection** for `https://quartzwebsolutions.com/` and request indexing once after launch or a major redesign.

## For each new connected business

Normally you do **not** have to manually submit every business. Publish it, and Quartz automatically adds its URL and HTML subpages to the sitemap and business directory. Google then decides when to crawl/index it.

For an important new client that you want discovered as quickly as possible, you can optionally use Search Console → URL Inspection → paste the exact new URL → **Request indexing** once. This is optional and does not guarantee ranking or immediate indexing.

### Example: Elora Fancy, Kondotty

Admin fields should contain real data such as:
- Name: `Elora Fancy`
- URL: `elora-fancy-kondotty`
- Category: `Fancy Store`
- City: `Kondotty`
- District: `Malappuram`
- Services/products: real products sold by the shop
- Business description: unique, factual description
- Primary keyword: e.g. `fancy store in Kondotty`
- Secondary phrases: e.g. `Elora Fancy`, `Elora Fancy Kondotty`, `fancy store Kondotty`

Quartz also derives natural variants such as `Elora Fancy Kondotty`, `Elora Fancy Fancy Store`, `Fancy Store in Kondotty`, `Fancy Kondotty` and `Kondotty Fancy` from the structured fields. The root title defaults to a business-first form such as `Elora Fancy | Fancy Store in Kondotty`, without adding Quartz to the title.

## Requirements for strong ranking

Technical SEO and sitemap discovery can be automated; rankings cannot be guaranteed. Each business still needs real, unique content, accurate local information, useful images, and preferably genuine links/mentions. Do not create many near-identical city/keyword pages.

## Image SEO

- Quartz's own icons use descriptive files and correct favicon/PWA metadata.
- Connected sites use their uploaded logo as the social/schema image when supplied. If no logo exists, Quartz uses the page's own image instead of showing a Quartz image.
- Images that have no `alt` attribute receive a contextual fallback using the business name/category/location. Existing intentional alt text is preserved.
- Use descriptive filenames when possible, e.g. `elora-fancy-kondotty-storefront.webp`, and upload compressed WebP/AVIF images for page speed.
