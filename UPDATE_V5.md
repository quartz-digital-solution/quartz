# Quartz Client Workspace — v5 update

## Changes
- Client Website Access: an eye SVG toggles an individual saved password in the authenticated admin panel. Passwords stay hidden in the normal account list and are requested only on reveal. An eye-off icon hides the revealed value again.
- Existing passwords can be retained when editing a role or login ID: leave the password field empty to keep the previous saved password. Switching to ID only removes the password.
- Individual PDF: cleaned up financial summary, payment history columns and record information, with a smaller supplied signature and original Quartz seal in a reserved sign-off section.
- Private notes: commas or new lines produce numbered points in the PDF and the individual shared view.
- All-clients directory PDF: aligned numbered rows with clickable website/email/phone and a simple prepared-date heading. No payment history, passwords, or notes.
- PDF browser cache busting via `pdf-export.js?v=5`.

## Deployment
1. Back up your existing GitHub project and preserve its Cloudflare settings.
2. Replace the existing project code with the contents of this ZIP's `quartz-main` folder. Commit and push to your existing production branch.
3. In Cloudflare Workers & Pages, verify the new deployment succeeded. Keep the existing `DB`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, and `CLIENT_CREDENTIALS_SECRET` bindings/secrets unchanged.
4. Reload the admin tab (hard refresh if needed), open a client, and test the eye button. Test one individual PDF and one all-clients PDF.

No D1 schema changes, secret rotation, or client database reset are required. This update does not write to the live Cloudflare account automatically.

## Safety
- The eye/reveal endpoint is admin authenticated and replies with `Cache-Control: no-store`.
- Client access passwords remain AES-GCM encrypted at rest in D1. Never send credential-bearing share links to unauthorized recipients.
- A downloadable PDF containing credentials is a plaintext copy: store and distribute it carefully.
