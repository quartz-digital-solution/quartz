# Quartz Web Solutions — SEO & Indexing Verification Guide

## Main canonical identity

- Business: **Quartz Web Solutions**
- Canonical website: **https://quartzwebsolutions.com/**
- Founder: **Sabith Salah K P**
- Founder page: **https://quartzwebsolutions.com/sabith-salah-kp/**
- Business Instagram: **https://www.instagram.com/quartz_web_solution/**

## Production SEO included

- unique Quartz landing-page titles/descriptions
- canonical URLs
- index/follow crawler directives
- www → non-www permanent redirect
- robots.txt with sitemap declaration
- live dynamic sitemap
- Organization/WebSite/WebPage/Person/Service/Breadcrumb structured data on Quartz pages
- automatic connected-site LocalBusiness/WebPage/Breadcrumb schema
- automatic multi-page connected-site canonicals and sitemap entries
- no `meta keywords` injection
- admin and error responses protected from indexing
- connected-page lastmod based on actual D1/R2 update timestamps

## Verify after every major deployment

Open these URLs:

- https://quartzwebsolutions.com/
- https://quartzwebsolutions.com/robots.txt
- https://quartzwebsolutions.com/sitemap.xml
- https://quartzwebsolutions.com/sabith-salah-kp/
- https://quartzwebsolutions.com/services/website-development/

Then verify:

1. `www.quartzwebsolutions.com` redirects to `quartzwebsolutions.com`.
2. `/sitemap.xml` returns XML and contains published connected websites.
3. A published connected multi-page site has canonical URLs such as `/shop/about.html` and its page is listed in the sitemap.
4. View Source on a connected page and confirm canonical/description/JSON-LD reflect the latest admin data.
5. Test important pages with Google Rich Results / Schema Validator.

## Google Search Console — required once

1. Add **Domain property**: `quartzwebsolutions.com`.
2. Verify with the Google-provided DNS TXT record in Cloudflare DNS.
3. Submit `https://quartzwebsolutions.com/sitemap.xml` once.
4. Request indexing for the homepage and key Quartz landing pages once after launch/domain migration.

From then on, new connected websites and HTML pages flow into the same sitemap automatically. Search Console submission is not repeated for each client site. Sitemap inclusion helps discovery but does not guarantee Google will index/rank a URL.

## Keyword targeting

`seo/keyword-targets.json` is for content planning. Google does not use a `meta keywords` tag. Target search phrases should appear naturally only on relevant useful pages. Do not create hundreds of near-identical location/keyword pages or hidden keyword blocks.
