# Quartz Web Solutions — Client Workspace (2026 CRM rebuild)

This version replaces the former hosted-client-website / automated client SEO system with a **private enquiries and clients workspace**.

## 1. Deployment

Keep the existing Cloudflare Pages project and GitHub deployment. Upload/push the contents of this folder unchanged. Cloudflare Pages **advanced mode** uses `_worker.js` from this project.

Required custom domains on **the same Pages project**:

- `quartzwebsolutions.com` — public Quartz website, enquiry form, private read-only share links
- `www.quartzwebsolutions.com` — redirects to canonical `quartzwebsolutions.com`
- `admin.quartzwebsolutions.com` — private dashboard

In Cloudflare Pages -> Settings -> Bindings, configure **D1 database binding with variable name `DB`** (the existing D1 database may be reused).

In Pages -> Settings -> Variables and Secrets, configure the following **server-side secrets**:

| Name | Example / instructions |
| --- | --- |
| `ADMIN_LOGIN_ID` | `quartex` (or your chosen admin ID) |
| `ADMIN_PASSWORD` | **Set a new secret password at least 12 characters**; never put it in your code |
| `ADMIN_SESSION_SECRET` | **Set a random secret at least 32 characters**; signs admin session cookies |

**Important:** Previously the admin accepted an ID without a password. This version deliberately rejects login until you configure `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET`. Do not place these values in GitHub, frontend code, or `.env` committed to Git.

After updating settings/bindings, redeploy. The Worker creates the CRM schema automatically on first use, or you can run `d1-schema.sql` via Cloudflare D1 Console first.

## 2. Site enquiry -> admin

- Public website -> "Send Project Enquiry": sends form JSON to `POST /api/enquiries` on the main domain, shows dots while submitting, then displays success/failure on the same page. **No WhatsApp redirect**.
- Submissions save in D1 `enquiries` with `new` status and server date/time. Basic honeypot, input checks and per-IP rate limit are enabled.
- Admin -> Enquiries -> "New enquiries"; click **Mark as read** (or **Mark all as read**) to move it to **Read history**. Read records remain saved. Click **Add to client directory** to prefill the contact name in a new client form.

## 3. Client directory, ledger and time

- Admin -> Clients -> Add Client: Business, real contact person, website URL, status (Active, Maintenance, On hold, Closed), phone, WhatsApp, email, project details, notes.
- Every client's balance is calculated from all **signed payment entries** (integer paise, not floating-point totals): `5000` adds ₹5000, `-1000` subtracts ₹1000. Entries keep the date recorded, admin-entered date/time flag, and creation timestamp. No false guarantee that entry equals actual bank settlement.
- Omit payment date/time -> current server date/time becomes the payment date, and **!** says **"Date based on added time"**. Supply it manually -> **!** says **"Date entered by admin"**. Interface shows dates in Indian local time (IST).
- Import backfilled ledger entries: `5000, -1000, 2500`, or `5000 | 2026-10-10 14:30 | Advance, -1000 | 2026-10-11 11:45 | Refund`. The browser converts local times to UTC before sending; all entries save atomically in a D1 batch. Use `|` only to separate amount / time / note; commas separate entries.
- Incorrect entries can be deleted with confirmation; balances are always recalculated from the remaining ledger. To preserve a full audit trail, prefer a *negative correcting entry* rather than deleting a genuine payment.

## 4. Downloads and read-only sharing

- Client detail page -> **Download PDF**: full client details, every payment with date/time and timestamp source, net total, Quartz logo, typed founder identification and a **design-only Quartz record seal**.
- Client list -> **All clients PDF**: summary plus all client detail documents. **CSV** and **JSON** provide complete machine-readable backup including histories.
- Each client and the entire client directory can create read-only links at `https://quartzwebsolutions.com/share/<random-token>`. Recipients can see the live record and download a PDF, but the public link does **not** offer or authorize edits.
- Generating a **new** link revokes the prior link for the same client / all-directory share. **Revoke link** disables existing links.
- The token is generated securely and only its SHA-256 hash is saved in D1; copy the displayed link when created, because the original token cannot be recovered from the hash. Whoever holds a link can see the included private details; share intentionally and revoke if necessary.
- The typed name and illustrative seal are **not** legal electronic signatures, a cryptographic signature, or an image of your real handwritten signature. To incorporate your actual signature/stamp later, supply real image assets.
- PDFs use the bundled lightweight Helvetica text writer. It supports common Latin text; for client names/notes with Malayalam or other non-Latin characters, the **read-only web page** preserves Unicode, but unsupported glyphs in the downloaded PDF may appear as `?`. CSV and JSON retain full Unicode.

## 5. Remove the legacy system safely

The original file used **Cloudflare D1**, not Supabase. Old `connected_sites` data is **not copied into the new CRM**, because hosted sites are not necessarily paying Quartz clients.

1. **Back up your D1 database** first (Cloudflare D1 export / backup).
2. Deploy the new code, test form/admin/enquiry/client and a PDF.
3. **After backup**, if you want the old SEO publishing records removed, run `legacy-cleanup-after-backup.sql` in your existing D1 SQL Console. This drops only `connected_sites` and its two old indexes.
4. If you used the old Cloudflare R2 binding `SITES_BUCKET`, back up old asset files before deleting the bucket/binding. This code no longer accesses the R2 bucket.
5. Any other Supabase project/database is **not involved**. Do not delete unrelated Supabase tables.

The former `/api/sites` API, per-client slug publishing logic, injected client SEO engine, client-site directory, R2 uploader, and SEO-editing dashboard are removed. Quartz's own main site and its normal public SEO/marketing pages are preserved.

## 6. Safety, privacy and operations

Use HTTPS, a strong admin password, and store the D1 database in a backed-up Cloudflare account. Do not expose the admin host in shared links. Admin session cookies are HTTP-only, Secure, SameSite=Strict and expire after 4 hours. Public share data and private API responses are marked no-store/noindex. Full-directory sharing exposes all client notes, contact data and ledgers to **anyone who receives the link**; use it only with appropriate consent. Do not interpret the summary as verified bookkeeping without reconciliation against payment records.

If the live site shows a 503 from `/api/admin/login`, configure the two required secrets and D1 binding before trying again.

## Security upgrade (latest)

Follow **SECURITY_SETUP.md** for required secrets, four-hour revocable session cookies, the payment void migration, optional Turnstile, Cloudflare Access, CSP and WAF recommendations. An old login cookie is deliberately invalidated when this version is deployed. Payments formerly deleted cannot be recovered by this upgrade; future removals are retained as voided entries.
