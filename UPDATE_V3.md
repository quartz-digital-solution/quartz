# Quartz Client Workspace — Update v3

## Client directory and PDF exports

- **Share All** and **Download All PDF** are concise numbered lists (1., 2., 3.) ordered by client ID, showing public-facing business name, reference ID, project status, contact name, website, email and phone.
- URLs, email addresses and phone numbers are clickable links in shared directory pages and downloadable PDFs. The Quartz logo/brand and founder name are also clickable in PDFs.
- The all-clients public endpoint excludes payments, balance, private notes, and client website access accounts at the **server level**, not only visually.
- Individual client documents retain their payment records and use the supplied Quartz logo, seal and signature. No typed-signature disclaimer appears in the output.
- Private CSV and JSON full-ledger backups remain available inside a collapsed **Private data backups** section, without website access passwords.

## Client IDs

- New client records use SQLite's autoincrement sequence with the minimum next ID 181, displayed as **#00181**, **#00182**, and so on.
- Existing IDs and all their linked payment records are preserved, not renumbered. If you already created clients with IDs below 181, those existing references stay unchanged.

## Client website access credentials

- Open **Client details → Website access**. Add as many separately named accounts as needed, e.g. Admin, Staff, Manager, with login ID and password. Check **ID only** for accounts that do not use a password.
- Each website access entry (including role and login ID) is encrypted in Cloudflare D1 using **AES-256-GCM** and the secret `CLIENT_CREDENTIALS_SECRET`. Add that as an encrypted Cloudflare Pages secret (at least 32 random characters) **before saving the first access account**. Do not reuse your admin session/login secrets.
- Individual client PDF and read-only link actions show a **No, keep private / Yes, include access** choice, defaulting to No. Opt-in share links containing credentials automatically expire in 24 hours and can be revoked earlier.
- Client website access records are **reference records**, not additional logins for the Quartz admin dashboard. Admin authentication remains controlled by `ADMIN_LOGIN_ID`, `ADMIN_PASSWORD`, Cloudflare Access and `ADMIN_SESSION_SECRET`.
- A read-only link does not prevent someone who can view it from copying or downloading displayed values. Only include passwords for intended authorized recipients. Change client website passwords after handover when appropriate.

## Deploy and update existing databases

1. Back up `quartz-db` first. Do not delete your client records.
2. Replace the project files from `quartz-main` in the connected GitHub repository, then redeploy the existing Cloudflare Pages project.
3. Keep Cloudflare D1 binding `DB` pointing to `quartz-db`; keep your existing admin secrets. Add encrypted secret **`CLIENT_CREDENTIALS_SECRET`** (32+ random characters) for encrypted client website access. Never commit real secrets to GitHub.
4. On the first database-using request, the Worker adds the new encrypted access table, shares columns and the minimum client ID sequence without removing existing records. For an empty database, `d1-schema.sql` can also be executed in the D1 Console.
5. Test: Add a client (expect #00181 when no existing clients), add an ID-only account and a password account, download the compact directory PDF, create/revoke a Share All link, and test an individual share with and without credentials.

See `SECURITY_SETUP.md` for admin authentication, Turnstile and Cloudflare Access instructions.
