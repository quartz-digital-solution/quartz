# Manual steps after deploying this build

1. Push/replace the files in your GitHub `quartz` repository and let Cloudflare Pages redeploy.
2. Confirm these URLs open:
   - https://quartzwebsolutions.com/
   - https://www.quartzwebsolutions.com/ (should redirect to the non-www URL)
   - https://admin.quartzwebsolutions.com/
   - https://quartzwebsolutions.com/robots.txt
   - https://quartzwebsolutions.com/sitemap.xml
   - https://quartzwebsolutions.com/businesses/
3. In Google Search Console, use a **Domain property** for `quartzwebsolutions.com` and verify it with the TXT record Google provides in Cloudflare DNS.
4. Submit `https://quartzwebsolutions.com/sitemap.xml` once in Search Console.
5. Request indexing for the homepage once after this major release.
6. For future connected businesses, publishing automatically updates the sitemap and directory. Manual URL Inspection is optional for an important new client when you want Google to discover it sooner.
7. Google controls crawl timing, indexing and rankings. No code can guarantee immediate indexing or a #1 position.

## Connected-site SEO example

If you add:
- Name: Elora Fancy
- Category: Fancy Store
- City: Kondotty
- District: Malappuram
- Slug: elora-fancy-kondotty

Quartz automatically builds a business-first title such as `Elora Fancy | Fancy Store in Kondotty`, local structured data, search phrases such as `Elora Fancy Kondotty`, `Fancy Store Kondotty`, `Fancy Kondotty` and `Kondotty Fancy`, and adds the page to the live sitemap and business directory.

The result URL is still under `quartzwebsolutions.com`, so Google may display that host/domain in the search result. If a client wants absolutely no Quartz domain visible, give that client a separate custom domain or subdomain.
