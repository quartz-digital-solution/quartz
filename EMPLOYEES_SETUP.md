# Quartz Employees & Identity Assets — Deployment Guide

## Deployment

Push all extracted contents of the ZIP into your existing Quartz GitHub repository and deploy the same Cloudflare Pages project. Use the existing production D1 binding `DB`, private R2 binding `CV_BUCKET`, and existing admin secrets. **No new R2 bucket or manual SQL is required** if those bindings already work. The Worker automatically adds the new optional `phone` column to the pre-existing enquiries table and creates the `employees`, `employee_payments` and `employee_share_links` tables and indexes. Employee IDs begin with **00181** (older records are never renumbered).

## Admin workflow

1. Visit `https://admin.quartzwebsolutions.com/` → **Employees** → **Add employee**. Enter a name and a professional role; other contact details and a profile photo are optional.
2. Open an employee to edit title, department, contact, work status, employment type, joining date, location, private notes or photo. A profile image (JPG, PNG, WebP; up to 3 MB) is stored privately under `employees/photos/` in the existing R2 `CV_BUCKET` binding.
3. Record a payment: **positive** amounts are payouts; **negative** amounts are adjustments. Voided entries stay visible in the private audit history, but no longer contribute to the net sum. This is manual bookkeeping, not payroll processing or money transfer.
4. Download **Verification PDF** (A4), **Print ID card** (two-sided, CR80 portrait, 54 × 85.6 mm; print at 100% scale) and **Profile badge PNG** (1080 × 1080 for square avatars). The documents are generated in the browser with the saved photo and Quartz brand.
5. To share identity, choose **Create / copy verification link**. A new link to `/verify/?token=…` revokes any earlier link for the employee. It displays only their **name, ID, role, department, joining date, status and optional photo**. The public recipient can download the corresponding identity PDF, ID card and square badge PNG. **Revoke all links** disables all links immediately.
6. The **Delete forever** button appears only in an employee detail page, requires entering `DELETE FOREVER`, and removes that employee's active row, payment history, R2 photo and all verification links. Previously downloaded files, security logs and backups are outside this deletion.

## Enquiry and clients changes

The **Send Project Enquiry** form now requires a **phone number** instead of email. Existing enquiry emails remain in D1 for backward compatibility; newly received enquiries set email to an empty value. The admin shows click-to-call phone numbers. **Add to client directory** prefills the client's phone. Client directory row deletion has been removed; the only client Delete forever action remains on the full client details page.

## Privacy and security

A link is **public to anyone who receives its token**. Obtain the employee's permission before sharing their public identity profile. No employee contact details, private notes or payments are exposed by public verification endpoints. `/verify/` is marked noindex. The PDF/card represent company-supplied team records, **not government-issued identification, a digitally signed certificate, a contract or statutory proof of employment**. Do not enable public R2 storage, and keep Cloudflare admin session secrets, MFA, backups and a sensible data-retention policy.

## Post-deployment tests

- Submit a sample enquiry with a phone number; confirm Admin Enquiries displays it and Add to Client carries it over.
- Create a sample employee, upload a profile photo, make a test payment, and confirm the balance/history.
- Download each PDF/PNG with the employee photo; print the ID card at **Actual Size / 100%**.
- Create a public verification link, open it in a private browser, download its files, then revoke the link and confirm it returns an error.
- Confirm the client directory lacks a Delete action and existing Clients, Applications and Enquiries data remain unchanged. Only test permanent deletion on disposable records.
