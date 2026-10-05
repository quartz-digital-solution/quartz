# Quartz SEO Automation — Final Status

## Automatic now

- Main Quartz static pages are crawlable, canonical and present in the sitemap.
- Fake/static "today" lastmod values were removed. Static URLs omit lastmod unless Quartz can know it accurately.
- Connected-site root pages get real lastmod from D1 `updated_at`.
- Connected-site extra HTML pages get real lastmod from R2 upload time, combined with the latest business/SEO edit time.
- Every published HTML page gets page-specific canonical/title/description/Open Graph/WebPage/Breadcrumb JSON-LD.
- Connected business schema supports a specific LocalBusiness subtype plus address, postal code, phone, email, opening hours, Maps URL, services and social profiles.
- `meta keywords` is removed and never injected.
- Updating any business/SEO field regenerates metadata/schema automatically at request time after Save/Deploy.
- Uploading/replacing HTML pages updates sitemap automatically.
- Replacing a website folder removes stale assets/pages that are no longer in the selected folder.
- Draft sites are not exposed as published connected sites.
- Admin is noindex/nofollow.
- `www` redirects permanently to the non-www canonical domain.

## Google Search Console — one manual setup remains by design

Google does not allow ordinary business pages to be force-indexed through a general indexing API. Do this once:

1. Add Domain property `quartzwebsolutions.com` in Google Search Console.
2. Add Google's verification TXT value in Cloudflare DNS.
3. Verify the property.
4. Submit `https://quartzwebsolutions.com/sitemap.xml` once.
5. Request indexing for the Quartz homepage and a few important Quartz landing pages after this release.

After that, future connected websites/pages automatically enter the same sitemap. No per-shop Search Console submission is required.
## Connected-site app behaviour
- Admin-uploaded logo is normalized by the admin UI to a square 512×512 WebP plus a 192×192 WebP app icon.
- Quartz injects the connected site's logo as favicon and Apple touch icon.
- Quartz generates a per-site web app manifest and scoped service worker automatically, so published connected sites can be installed as PWAs on supported browsers.
- Deleting a connected website removes its D1 record and all objects stored under that site's R2 prefix.

