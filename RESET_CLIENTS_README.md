# Reset old clients and re-enter them manually

**Danger — irreversible in the live database unless you have a backup.**

1. In Cloudflare, open Storage & Databases → D1 → **quartz-db** → Console.
2. Confirm you are connected to the correct Quartz database and **back it up** (export/Time Travel bookmark). A CSV/JSON export from the Admin panel also preserves ledger data (not saved website passwords).
3. Inspect counts with this read-only SQL before deleting anything:

```sql
SELECT 'clients' AS resource, COUNT(*) AS total FROM clients
UNION ALL SELECT 'payments', COUNT(*) FROM client_payments
UNION ALL SELECT 'website_access', COUNT(*) FROM client_access
UNION ALL SELECT 'share_links', COUNT(*) FROM share_links
UNION ALL SELECT 'enquiries (preserved)', COUNT(*) FROM enquiries;
```

4. Once you are certain, paste and execute **RESET_CLIENTS_AFTER_BACKUP.sql** in D1 Console. It removes every client, all client payment/access details, and **all sharing links**, but retains submitted project enquiries and your login/session settings.
5. Confirm `SELECT COUNT(*) FROM clients;` returns `0`, and `SELECT seq FROM sqlite_sequence WHERE name='clients';` returns `180`.
6. Go to Admin → Clients → Add client and enter your projects from the beginning. The first created client ID should be **#00181**, then #00182, etc.

Do **not** delete the entire `quartz-db` database or the `enquiries` table. Previously shared URLs will no longer work after this reset. Existing backups and any old PDF files you downloaded remain unchanged.

## Updated public project form

- The public **Start a Project** button scrolls to the enquiry form; mobile navigation has a matching button.
- **Send Project Enquiry** posts name, email, project type, and project brief to the same-origin `/api/enquiries` API. The Worker inserts the entire submission into D1 `enquiries`, with status `new`.
- The admin **Enquiries → New enquiries** view reads those records; marking read moves them to **Read history**.
- Cloudflare Pages must deploy `_worker.js` and preserve the `DB` binding to `quartz-db`. Set Turnstile site/secret keys together, or leave both unset until configured.

## PDF layout

- The Quartz logo is vertically centered beside the brand name.
- The original signature is smaller; seal and founder's name are kept together as a block.
- Individual client PDFs use compact fields and payment rows, normally fitting a short client record on a single A4 page. Multi-page output is used only when lengthy notes, payments or website access entries require it.
