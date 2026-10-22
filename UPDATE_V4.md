# Quartz Client Workspace v4 — October 22, 2026

## Changes

- Redesigned **individual client PDFs** with compact labels, smaller original signature, the supplied Quartz stamp, aligned Quartz logo/brand header, clickable links, and a non-breaking signature/seal/name block. Standard client records fit on one A4 page. Long notes, many payments, or many website access records paginate if necessary.
- Preserved the compact numbered **Share All / Download All** directory, which excludes passwords, balances and payment history.
- Shortened the website access checkbox text to exactly **ID only**.
- Fixed the public header **Start a Project** button to reliably scroll to, and focus, the enquiry form, including when already at `#contact`. Added a matching mobile-menu action.
- Improved form submission states and clarified successful submissions. **Send Project Enquiry** stays on the page and sends name/email/project/brief to the Worker, which saves them in `quartz-db` → `enquiries` → `status=new`. New entries appear under Admin → **Enquiries → New enquiries**; mark read to move to history.
- Added **RESET_CLIENTS_AFTER_BACKUP.sql** and **RESET_CLIENTS_README.md** for a deliberate, complete client-only reset. It clears clients, their payment/access records, and all share links, retains enquiries and admin metadata, and seeds the next ID to **#00181**.

## Install

1. Back up `quartz-db` and your existing GitHub repository.
2. Replace your existing site's repository files with the contents of `quartz-main`, commit and push. Ensure Cloudflare Pages deploys the repository root with `_worker.js` at the output root.
3. Keep D1 binding `DB` → `quartz-db`, and existing Secrets `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, and `CLIENT_CREDENTIALS_SECRET`. Leave your Turnstile keys configured together if enabled.
4. Confirm the production deployment works (Quartz homepage, admin login, D1). The schema initializes on first database interaction.
5. **Only if you truly want to erase your prior clients**, run `RESET_CLIENTS_AFTER_BACKUP.sql` in Cloudflare → D1 → `quartz-db` → Console. The first newly entered client will be `#00181`.
6. Test **Start a Project** (desktop/mobile), submit one test enquiry, verify it appears in **New enquiries**, then mark it read. Add a client, download their PDF and confirm the signature, seal and name remain together.

The SQL reset is irreversible without a backup. Client share URLs become invalid. Enquiry submissions are preserved. Neither deployment nor reset is performed automatically from this ZIP.
