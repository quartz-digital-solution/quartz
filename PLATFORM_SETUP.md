# Quartz Web Solutions — Production Platform Setup

This build is designed for **Cloudflare Pages + D1 + R2** on `https://quartzwebsolutions.com` with admin at `https://admin.quartzwebsolutions.com`.

## What is automatic after the one-time setup

For every published connected website Quartz automatically:

- publishes it at `https://quartzwebsolutions.com/shop-name/`
- serves uploaded multi-page HTML at stable canonical URLs such as `/shop-name/about.html` (or `/shop-name/services/` for `services/index.html`)
- redirects alternate non-canonical page URLs to the correct canonical URL
- injects/updates SEO title and meta description
- injects `index,follow` robots directives
- injects canonical URL per page
- injects Open Graph + Twitter metadata
- injects specific Schema.org LocalBusiness subtype when selected
- includes address, postal code, phone, email, opening hours, map, geo coordinates, price range and social profiles in structured data when supplied
- injects WebPage + Breadcrumb structured data for every HTML page
- removes `meta keywords` because Google Search does not use it
- inserts the root page and every uploaded HTML page into the live sitemap
- updates connected-page `lastmod` automatically when business/SEO data or the page HTML changes
- removes obsolete uploaded HTML pages from the sitemap when a replacement folder no longer contains them
- applies SEO edits immediately at render time, so changing a business field updates all pages without manually editing each HTML file

The static Quartz pages intentionally do **not** receive a made-up current `lastmod` value. Sitemap `lastmod` is optional, and Quartz only emits it where the platform can calculate it accurately.

## One-time Cloudflare setup

1. Deploy this project with Cloudflare Pages.
2. Add custom domains:
   - `quartzwebsolutions.com`
   - `www.quartzwebsolutions.com`
   - `admin.quartzwebsolutions.com`
3. Keep `www` pointed to the Pages project; the Worker permanently redirects it to the non-www canonical domain.
4. Create a Cloudflare **D1 database** and bind it to the Pages project as exactly:
   - `DB`
5. Create a Cloudflare **R2 bucket** and bind it as exactly:
   - `SITES_BUCKET`
6. In Pages → Settings → Variables and Secrets add:
   - `ADMIN_LOGIN_ID` = `quartex` (Text)
   - `ADMIN_SESSION_SECRET` = a long random value (Secret)
7. Redeploy after bindings/secrets are saved.
8. Open `https://admin.quartzwebsolutions.com/` and log in with `quartex`.

The Worker includes an automatic D1 migration, so an older Quartz D1 table is upgraded with the new LocalBusiness fields on first use.

## One-time Google Search Console setup

Google does not provide a general API that can force ordinary shop pages into the index. The correct automated workflow is sitemap discovery plus crawlable/indexable pages.

Do this once:

1. Open Google Search Console and add the **Domain property** `quartzwebsolutions.com`.
2. Google will give you a DNS TXT verification value. Add it in Cloudflare → DNS → Records.
3. After verification, open Search Console → **Sitemaps** and submit:
   - `https://quartzwebsolutions.com/sitemap.xml`
4. Use URL Inspection to request indexing for the Quartz homepage and a few important static landing pages after this deployment/domain change.

After this one-time submission you do **not** need to resubmit the sitemap for every client. The same live sitemap updates itself whenever a connected website/page is published, edited, uploaded or removed. Google will decide crawl/index timing.

A legacy URL-prefix verification file (`google245e77c7b3a8ba9a.html`) is also included, but a Search Console **Domain property** should be verified by DNS TXT.

## Adding a connected business website

1. Admin → **Add Website**.
2. Enter the real business data. Every field is used where relevant for SEO/schema:
   - name + URL slug
   - category + Schema.org business type
   - products/services
   - city, district, state, address and postal code
   - phone, WhatsApp and email
   - opening hours
   - Google Maps URL
   - latitude/longitude
   - price range
   - Instagram/Facebook/YouTube URLs
   - real business description
   - primary search phrase + supporting search phrases
   - editable SEO title + meta description
3. Load `index.html`, or choose the complete static website folder.
4. Add a logo/social image if available.
5. Click **Deploy Website**.

If you later edit any business/SEO field and save again, Quartz regenerates the metadata and schema on the next request automatically. If you select a replacement website folder, Quartz syncs its stored assets so removed HTML pages also disappear from the live sitemap.

## Multi-page SEO behavior

Examples:

- uploaded `index.html` → `/shop-name/`
- uploaded `about.html` → `/shop-name/about.html`
- uploaded `services/index.html` → `/shop-name/services/`
- uploaded `products/shoes.html` → `/shop-name/products/shoes.html`

Each gets its own canonical, title/description logic, WebPage schema, breadcrumb and sitemap URL. Existing useful page titles/descriptions are preserved as page-specific signals; missing ones are generated from the page H1/path plus the business information.

## Security note

The requested admin interface accepts only the login ID `quartex`. The private server-side `ADMIN_SESSION_SECRET` signs the cookie, but anyone who knows the login ID can still authenticate. For important client data, upgrade later to Cloudflare Access, password/passkey or OTP.
