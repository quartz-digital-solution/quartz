-- Quartz D1 / quartz-db: permanently remove every client and linked private record.
-- IMPORTANT: export/back up quartz-db before executing. This cannot be undone by the website.
-- This intentionally KEEPS enquiries, admin_sessions and login_attempts.
-- It removes ALL share links (including Share All) to prevent old links from showing newly added clients.
-- Run ONLY after the current secured Quartz version has created the v3 client tables.
DELETE FROM share_links;
DELETE FROM client_access;
DELETE FROM client_payments;
DELETE FROM clients;
-- Reset the client sequence: your first new client will be #00181.
DELETE FROM sqlite_sequence WHERE name IN ('clients', 'client_payments', 'client_access', 'share_links');
INSERT INTO sqlite_sequence(name,seq) VALUES('clients',180);
