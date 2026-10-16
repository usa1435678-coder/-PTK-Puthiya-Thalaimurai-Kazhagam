# PTK Digital Platform

Express, EJS, and SQLite application for the PTK public website, membership applications, member cards, and administration.

## Run locally

1. Install dependencies with `npm install`.
2. Start the server with `npm start`.
3. Open `http://localhost:3000`. On first run, the administrator password is generated and saved to `data/admin-credentials.txt`; keep that file private. Existing databases still using the old `admin123` default are upgraded to a generated password at startup.

Set `PORT`, `DB_PATH`, `MEMBER_CSV_PATH`, `SESSION_SECRET`, and optionally `ADMIN_PASSWORD` in the environment to configure the server, database, membership CSV snapshot, session signing secret, and first-run administrator password. Use at least 32 characters for `SESSION_SECRET` and 16 for `ADMIN_PASSWORD`. Set a stable random `SESSION_SECRET` for deployments so sessions remain valid across restarts.

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
- `/admin/settings` — browser-local admin PIN, database backup, and restore controls. The PIN only locks admin pages in the current browser; server-side administrator login is still required.
- `/admin/backup` — download a database backup.

The public site and administration screens include an English/Tamil language switch. Applicants can use the application reference shown after submission and the same phone number to check their review status. Membership cards print at the standard ID-1 smart-card size (85.60 × 53.98 mm); select actual size or 100% scale in the print dialog.

Brand image uploads accept JPG, PNG, and WEBP files up to 5 MB and are public at `/uploads/`; member profile images require an authenticated administrator session.

For deployment configuration, see [DEPLOYMENT.md](DEPLOYMENT.md).
