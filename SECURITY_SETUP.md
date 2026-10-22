# Quartz CRM — security setup & verification

The source code is hardened, but **no website can be promised 100% secure** and the live deployment cannot be made secure by changing ZIP files alone. Complete these settings on your Cloudflare account **before storing real client financial information**.

## 1. Back up D1, then deploy

1. Export/back up `quartz-db` in Cloudflare D1. **Do not delete the D1 database.**
2. Upload the **contents** of `quartz-main/` to the GitHub repository connected to the Quartz Cloudflare Pages project.
3. Verify that `_worker.js` is at the *deployment output root* (Cloudflare Pages **advanced mode**).
4. On the same Pages project, configure `quartzwebsolutions.com`, `www.quartzwebsolutions.com`, and `admin.quartzwebsolutions.com` as custom domains. The code deliberately blocks other preview / `*.pages.dev` hostnames; test on the real custom domains.
5. Under Pages **Bindings**, keep the D1 binding named `DB` pointing to `quartz-db`. The old client-hosting R2 `SITES_BUCKET` binding is no longer needed. Do not delete unrelated R2 data.
6. For a fresh database, run `d1-schema.sql` in the `quartz-db` Console (optional: the Worker initializes the schema on its first use). Existing `client_payments` tables get a non-destructive `voided_at` migration on the first request that initializes the schema. Never delete client/payment tables when upgrading.

## 2. Required secrets (Cloudflare Pages → Settings → Variables and Secrets)

Set as **encrypted secrets**, not hardcoded source or public JavaScript:

- `ADMIN_LOGIN_ID` — your chosen admin ID (the login form currently prefills `quartex`)
- `ADMIN_PASSWORD` — NEW randomly generated password of **at least 12 characters**; use 20–32+ random characters. Do not reuse old passwords.
- `ADMIN_SESSION_SECRET` — a distinct randomly generated secret of **at least 32 characters**, preferably 48–64 characters, for signed cookies and pseudonymous IP hashes.

Re-deploy after changing secrets. Changing `ADMIN_SESSION_SECRET` invalidates every signed session cookie.

**Required authentication characteristics:** ID + password on the admin hostname, `HttpOnly` + `Secure` + `SameSite=Strict` `__Host-` session cookies, four-hour maximum lifetime, server-side session records in D1, and immediate session revocation on logout. Per-IP and global failed-login caps limit guessing; Cloudflare network rate limits are still recommended.

## 3. Add a second security layer to the admin hostname (strongly recommended)

Use **Cloudflare Zero Trust → Access controls → Applications → Create new application → Self-hosted and private → Add public hostname**. Enter only `admin.quartzwebsolutions.com`. Configure an **Allow** policy for your own specific email address(es), not everyone with an email or an entire public domain. Enable an appropriate login method (one-time PIN or an identity provider with MFA). Test in a private window and confirm that unauthorized users cannot even load the admin login page.

Do **not** place the public Quartz site or `/share/...` links behind the admin Access application; customers must be able to view the main site and explicitly shared read-only records.

Reference: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/

## 4. Protect project enquiries with Turnstile (recommended)

1. In Cloudflare, create a **Turnstile managed widget** for hostname `quartzwebsolutions.com`.
2. In the **same Pages project**, set `TURNSTILE_SITE_KEY` to the public site key (environment variable or secret) and `TURNSTILE_SECRET_KEY` to its **secret** (encrypted).
3. Add **both keys together** and redeploy. If you add the secret without the public key, enquiries will fail validation by design.
4. Reload the home page and submit a test enquiry. The website fetches its public site key from `/api/public/config`, loads the widget, and the Worker validates each token with Cloudflare **Siteverify**, including its hostname. Tokens are short-lived and single-use.
5. Configure Cloudflare WAF/rate limits for `POST /api/enquiries` and `POST /api/admin/login` to mitigate distributed and parallel attacks. Tune against normal traffic; in-code limits are only an extra layer.

With neither Turnstile key configured, the enquiry form continues to work with honeypot, same-origin and per-IP rate checks, but it is **less resistant to bots**.

Reference: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

## 5. Private records, read-only links, and payments

- Private admin JSON endpoints require a valid D1-backed session. The browser cannot directly modify D1 without authorization.
- Unsafe admin requests reject cross-origin requests, and JSON request sizes are limited based on **actual bytes received**, not only the Content-Length header.
- All client notes and payment details are still private. **Creating a share-all link will disclose the entire client directory and ledger to anyone who has the link.** The admin now displays an explicit warning before creating one.
- Share tokens are generated from 32 cryptographically random bytes and only hashed values are stored in D1. Revoking a link stops its future API access. A read-only link is not a guarantee that recipients cannot copy/download the data they have seen.
- Payments can now be **voided without deleting the original row**. Voided entries stay visible with `voided_at`, are excluded from totals, and appear marked as voided in HTML/PDF/exports. This is an operational audit trail, not cryptographically tamper-proof accounting.
- Downloads include sensitive personal data; save CSV, JSON, and PDF backups in access-controlled storage. CSV fields beginning with spreadsheet formula syntax are escaped.
- `ADMIN_PASSWORD`, cookies, and `ADMIN_SESSION_SECRET` must never appear in frontend HTML, GitHub source, or screenshots.
- Password-based login and Cloudflare Access protect the dashboard; backend database backups, account MFA, and restricted Cloudflare/GitHub permissions protect your infrastructure.

## 6. Verify the live result

- [ ] From incognito, `https://admin.quartzwebsolutions.com/` is protected by Cloudflare Access (if configured); wrong password rejected.
- [ ] After login, create a test client and record +₹500 and -₹100; net must be ₹400.
- [ ] Void the -₹100 entry; net must return to ₹500 while history still shows a VOIDED payment.
- [ ] Log out, then hit `/api/admin/me` using the **old** cookie: expected `401`.
- [ ] POST a project enquiry; verify it appears in **New enquiries** and moves to Read History after marking read.
- [ ] Create and then revoke a **single** client share link; it should return `404` afterward.
- [ ] Verify exported PDFs and CSV/JSON locally. A typed founder authorization/styled seal is **not** a legal cryptographic signature.
- [ ] Ensure response headers include `Content-Security-Policy`, `X-Content-Type-Options`, and `X-Frame-Options` for site HTML; admin/share records are `Cache-Control: no-store`.
- [ ] Confirm old `connected_sites` hosting has not been accidentally restored, and Quartz's own marketing SEO pages are intact.

**Security scope:** This build was audited and exercised with local simulated Cloudflare D1 tests; no live DNS, SSL, Cloudflare dashboard permissions, WAF policy, D1 secrets, Access policies, or production penetration test was performed. Deploy and configure the infrastructure settings above yourself; never claim the website is invulnerable.
