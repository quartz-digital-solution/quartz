# Quartz Client Workspace

Modern client & payment management for Quartz Web Solutions.

**Deploy:** Push this folder to the same GitHub repository deployed by Cloudflare Pages. **Then configure the D1 `DB` binding, `ADMIN_PASSWORD` (12+ chars), `ADMIN_SESSION_SECRET` (32+ chars), and `ADMIN_LOGIN_ID` before logging in. Also set `CLIENT_CREDENTIALS_SECRET` (32+ characters, encrypted secret) before saving website access credentials**.

Main website: quartzwebsolutions.com (same-page project enquiries). Dashboard: admin.quartzwebsolutions.com. Read-only documents: quartzwebsolutions.com/share/<token>.

See [PLATFORM_SETUP.md](PLATFORM_SETUP.md) for full steps, backups, cleanup of the old Cloudflare D1 `connected_sites` table and R2 assets, and PDF/document setup.


**Security hardening:** Read [SECURITY_SETUP.md](SECURITY_SETUP.md) before deployment. It covers revocable 4-hour admin sessions, audit-safe payment voiding, CSP, optional Turnstile, and strongly recommended Cloudflare Access MFA. The source alone cannot secure Cloudflare account settings.

## Careers and job applications

Career site: `/careers/` with dedicated job pages, custom styled application form and private D1/R2 storage. The admin workspace now has **Applications**, PDF and CV download, and confirmed permanent deletion for applicants, enquiries and clients. **Before publishing**: create a private R2 bucket and bind it to Cloudflare Pages as `CV_BUCKET`. See [CAREERS_SETUP.md](CAREERS_SETUP.md) for full setup and SEO indexing steps.
