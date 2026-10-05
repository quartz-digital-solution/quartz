# Quartz Web Solutions — Platform Setup

This build is designed for **Cloudflare Pages + D1 + R2** on `https://quartzwebsolutions.com`.

## What is automatic after setup

- New connected website URL: `https://quartzwebsolutions.com/shop-name/`
- Admin-created draft/published status
- `index.html` editing in Quartz Admin
- Folder asset upload (CSS, JS, images, fonts, extra HTML files)
- Technical SEO injection for every published connected site:
  - title and meta description
  - canonical URL
  - `index,follow` robots directive
  - Open Graph / Twitter metadata
  - LocalBusiness JSON-LD
  - WebPage JSON-LD
  - Breadcrumb JSON-LD
  - optional compatibility `meta keywords` (not relied on for Google ranking)
- Dynamic `sitemap.xml` including every published connected site
- Site search and full site details in Admin
- Deployment date and live-site redirect link
- Keyword, metadata and `index.html` editing

## One-time manual Cloudflare setup

1. Create or use a Cloudflare Pages project for this repository/build.
2. Add the custom domain `quartzwebsolutions.com` and make sure HTTPS is active.
3. Add a second custom domain **`admin.quartzwebsolutions.com`** to the same Pages project. The Worker serves the private admin UI there and keeps uploaded shop JavaScript away from the admin session cookie.
4. Create a Cloudflare **D1 database**. Bind it to the Pages project with binding name exactly:
   - `DB`
   The Worker creates the required table automatically on first admin/API use.
5. Create an **R2 bucket** for uploaded connected-site assets. Bind it with name exactly:
   - `SITES_BUCKET`
6. In Pages → Settings → Variables and Secrets add:
   - `ADMIN_LOGIN_ID` = `quartex`
   - `ADMIN_SESSION_SECRET` = a long random secret (example format: 40+ random characters). Do **not** use `quartex` as this secret.
7. Deploy the project again after the bindings/secrets are saved.
8. Open `https://admin.quartzwebsolutions.com/` and log in with ID: `quartex`. Visiting `/admin/` on the main domain redirects there.

## One-time Google setup

1. Add/verify the **Domain property** `quartzwebsolutions.com` in Google Search Console.
2. Submit this sitemap once:
   - `https://quartzwebsolutions.com/sitemap.xml`
3. Inspect the homepage and a few important SEO pages and request indexing once after the domain move.
4. Keep the old Netlify URL redirected to the equivalent new Quartz URL if you still control it. Avoid leaving duplicate copies live without redirects/canonicals.

After the sitemap is submitted, future published connected sites are automatically inserted into the same sitemap. You do **not** have to manually edit the sitemap when adding a new shop. Google still decides when it crawls/indexes/ranks each URL.

## Admin login warning

You requested a login-ID-only admin. This build keeps that interface: the only entered value is `quartex`. A hidden server-side `ADMIN_SESSION_SECRET` signs the session cookie, but **any person who knows the login ID can still log in**. If the admin contains valuable client sites, upgrade later to a password, passkey, OTP, Cloudflare Access or another real authentication method.

## How to add a shop/site later

1. Admin → **Add Website**.
2. Enter business name and URL slug.
3. Enter category, city/location, real business description, primary keyword and relevant secondary keywords.
4. Upload/load `index.html`, or select the whole static website folder.
5. Optionally add logo/social image.
6. Check the SEO score.
7. Click **Deploy Website**.
8. The site becomes live at `/slug/` and is added to the dynamic sitemap automatically.

## SEO note

The included `seo/keyword-targets.json` contains 100+ Quartz target phrases for content planning and rank tracking. Google Search does not use the `meta keywords` tag for ranking. Do not paste all keyword variants into visible text. Use relevant phrases naturally on the page that actually answers that search intent.
