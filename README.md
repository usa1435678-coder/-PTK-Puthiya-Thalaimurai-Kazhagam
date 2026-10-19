# PTK Digital Platform

Express, EJS, and SQLite application for the PTK public website, membership applications, member cards, and administration.

## Run locally

1. Install dependencies with `npm install`.
2. Start the server with `npm start`.
3. Open `http://localhost:3000`. On first run the administrator account is created with the documented password `PTKadmin@2026` (also written to `data/admin-credentials.txt`); change it after signing in. Set `INITIAL_ADMIN_PASSWORD` to choose your own.

Set `PORT`, `DB_PATH`, `BACKUP_DIR`, `PERSISTENT_STORAGE_ROOT`, `UPLOAD_DIR`, `MEMBER_CSV_PATH`, `SESSION_SECRET`, and optionally `INITIAL_ADMIN_USERNAME` / `INITIAL_ADMIN_PASSWORD` in the environment to configure the database, retained automatic backups, persistent mount, uploads, membership CSV, session signing secret, and initial administrator account. `INITIAL_ADMIN_PASSWORD` sets the administrator password; without it the documented default `PTKadmin@2026` is used so you are never locked out, after which changes made from System settings are preserved. Set `FORCE_ADMIN_RESET=true` once to force the account back to the configured/default password (a legacy `ADMIN_PASSWORD` is only honored with this flag). An authenticated administrator can change the stored password from System settings. Use at least 32 characters for `SESSION_SECRET` and at least 12 for `INITIAL_ADMIN_PASSWORD`. Set a stable random `SESSION_SECRET` for deployments so sessions remain valid across restarts.

## Main routes

- `/` — public home page, announcements, events, contact and volunteer forms.
- `/membership` — membership application form, including optional profile photo.
- `/application-status` — public application lookup using the application reference and phone number.
- `/verify/:memberId` — public membership-card status check.
- `/admin/login` — administrator login.
- `/admin/dashboard` — application review and dashboard.
- `/admin/branding` — party identity, card colours, and image uploads.
- `/admin/content`, `/admin/announcements`, `/admin/events` — public website content.
- `/admin/members`, `/admin/reports` — member directory and exports.
- `/admin/volunteers`, `/admin/contacts`, `/admin/grievances` — review, edit, update status, and delete public submissions; volunteer approval creates the linked member and card.
- `/admin/settings` — database backup and restore controls. The browser-local PIN is only a convenience and does not replace administrator login.
- `/admin/backup` — download a database backup.

The public site and administration screens include an English/Tamil language switch. Applicants can use the application reference shown after submission and the same phone number to check their review status. Administrators can edit or delete pending/rejected applications, members, announcements, events, contacts, grievances, and volunteer registrations. Membership cards print at the standard ID-1 smart-card size (85.60 × 53.98 mm); select actual size or 100% scale in the print dialog.

Brand image uploads accept JPG, PNG, and WEBP files up to 5 MB and are public at `/uploads/`; member profile images require an authenticated administrator session.

The supplied PTK logo, flag, leader portrait, and signature are included in `public/branding/` and are inserted as defaults only when a setting is first created. Existing settings, including intentionally blank settings, are never auto-filled on startup; an administrator can explicitly select a bundled default from Branding. Admin changes are saved in SQLite settings, and replacement image files are written to `UPLOAD_DIR`. In production the app refuses to start unless the database, automatic backups, uploads, and CSV export are configured beneath `PERSISTENT_STORAGE_ROOT`; this prevents quietly accepting data on ephemeral storage. For Render, attach a persistent disk at `/var/data` and use the paths in `render.yaml`.

SQLite uses write-ahead logging and full synchronous commits. A complete SQLite snapshot and copy of uploaded images is created at startup when none exists, at least every 24 hours, and before an administrator restores or deletes records. Snapshots are stored under `BACKUP_DIR`, are downloadable and restorable only by an authenticated administrator, and are never automatically removed. Restoring one replaces the entire database, including the administrator accounts/passwords as they were at snapshot time, and restores uploaded files without deleting newer files. They include administrator password hashes, so protect downloaded database files. Keep a separate offline copy: snapshots on the same disk do not protect against losing or deleting that disk. The separate JSON export does not include administrator credentials or uploaded image binaries.

For deployment configuration, see [DEPLOYMENT.md](DEPLOYMENT.md).

**Data persistence:** SQLite, automatic snapshots, and uploaded images must all be stored on a persistent mounted disk in production. Render Free services use ephemeral storage and can lose database records and uploads on restart or redeploy. The production server will not start unless the configured paths are under the declared persistent mount. Configure a paid persistent disk and download regular backups to separate storage; no application can guarantee permanence if the hosting provider's disk is deleted or the account/service is removed.
