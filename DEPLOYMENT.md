# PTK Digital Platform Deployment Guide

## Local Development Setup

### Prerequisites
- Node.js 14+ 
- npm or yarn
- A local directory for the project

### Installation

1. Clone the repository:
```bash
git clone https://github.com/kpraveenkumar182007-commits/ptk-digital-platform.git
cd ptk-digital-platform
```

2. Install dependencies:
```bash
npm install
```

3. Start the application:
```bash
npm start
```

The app will run on `http://localhost:3000`

### Admin Credentials

On first startup, a high-entropy administrator password is generated and written to `data/admin-credentials.txt`. Keep this file private and persist the `data` directory. You may set `ADMIN_PASSWORD` before first startup to provide your own initial administrator password. `ADMIN_PASSWORD` does not overwrite an existing administrator password on restart. After signing in, an administrator can change the stored password under System settings. Existing databases still using the insecure `admin123` default are upgraded at startup.

### Database
- SQLite database stored in `data/ptk.db` by default; set `DB_PATH` to override it
- Schema is auto-initialized on first run
- SQLite write-ahead logging and full synchronous commits are enabled for safer durable writes
- Full SQLite snapshots and copies of uploaded files are created at startup if needed, every 24 hours, and before administrator restore/delete operations. They are never automatically deleted.
- Downloaded snapshots include administrator password hashes; protect them and store an extra copy outside the web service.
- Database snapshots do not contain uploaded image binaries; persist both the database and upload directories so member and branding images survive redeploys.

## Features Implemented

### Public Website
- Homepage with hero section and statistics
- About, Mission, Vision sections
- Announcements and Events (editable from admin)
- Public membership application
- Volunteer registration form
- Public grievance submission
- Contact form
- Member verification by QR code

### Admin Dashboard
- Membership application review and approval
- Member directory with search and filters
- Membership card generation and display
- Card colour customization (red, yellow, green preserved together)
- Branding settings (party names, leader info, contact details)
- Website content management
- Announcements and events creation
- Volunteer and grievance tracking
- CSV export reports
- Audit logging
- Database backup and restore

### Membership System
- Application form with validation
- Duplicate application prevention
- Admin approval workflow
- Automatic member ID generation (PTK-XXXXXX-YYYYYY)
- Membership card with QR verification
- Card status tracking (active/revoked)
- Card reissuance capability

### Membership Card
- **Three-colour design (mandatory):** Red (top) → Yellow (middle) → Green (bottom)
- Member photo, name, and Tamil name
- Unique member ID and district/unit information
- Issue date and membership status
- QR code linked to secure verification page
- Print and PDF-ready CSS
- Colour customization from admin panel

### Security
- Session-based authentication
- Server-side authorization checks
- SQLite parameterized queries (SQL injection protection)
- Input validation on all forms
- Audit logging for important actions
- Rate limiting ready (can be added)

## Deployment to Production

### Render (persistent SQLite and uploads)

The repository includes a `render.yaml` Blueprint for a Docker web service with a persistent disk. The disk stores the SQLite database, automatic snapshots, uploaded branding/member images, CSV export, and generated admin credentials so they survive redeploys. A paid Render web service and persistent disk are required; free ephemeral storage is not suitable for this application. The already-running Free service is not made durable just by deploying code or by keeping the Blueprint in the repository.

1. Ensure the GitHub repository branch you want to deploy contains `render.yaml` and the application changes.
2. Sign in to Render, choose **New → Blueprint**, connect the GitHub repository, and select that branch.
3. Review the Blueprint. It creates the `ptk-digital-platform` web service and a 1 GB persistent disk at `/var/data`. Confirm the paid plan and disk before applying.
4. Wait for the `/healthz` check and deployment to pass. Render assigns the permanent `onrender.com` URL in the service dashboard.
5. Open the generated service environment variables and use its generated `ADMIN_PASSWORD` with username `admin` to log in. Keep the password private.
6. If using a custom domain, add it in the Render service settings and follow Render's DNS/HTTPS instructions.

For an existing service, first take and verify an external backup, then attach a persistent disk in Render service settings and use a mount path of `/var/data`. Set `PERSISTENT_STORAGE_ROOT=/var/data`, `DB_PATH=/var/data/ptk.db`, `BACKUP_DIR=/var/data/backups`, `UPLOAD_DIR=/var/data/uploads`, and `MEMBER_CSV_PATH=/var/data/ptk-members.csv`, then deploy. Production startup is refused unless each path is configured beneath the persistent root and the root is present as an actual mounted filesystem. Do not delete/recreate a service or detach a disk as a way to apply these settings: disk/service recreation can cause data loss.

The admin System settings page supports JSON export/restore and lists the newest automatic full snapshots. A snapshot is made at startup if none exists, at least every 24 hours, and before administrator restore/delete operations; no snapshot is automatically pruned. Each full snapshot contains all database tables, including administrator password hashes, plus a copy of uploaded files. Admins can restore one of these snapshots in the same page; restoration also restores the admin accounts and password from that time, restores missing uploaded files without deleting newer files, and creates a safety snapshot first. The separate JSON export excludes credentials and uploaded binaries. Download full snapshots only over the authenticated admin interface, protect the files, and keep copies in separate durable storage. A backup on the same disk is not protection against losing that disk. Monitor disk capacity because retained snapshots are not automatically deleted.

The supplied PTK logo, flag, leader portrait, and signature are versioned in `public/branding/` and inserted only when the corresponding setting does not yet exist. Startup never fills or overwrites an existing branding setting, including intentionally blank settings. An administrator can explicitly select a bundled image from Branding. An admin replacement updates the database setting and stores the image in `UPLOAD_DIR`; both the settings database and uploads directory therefore need the attached persistent disk for those replacements to survive a deploy.

The `SESSION_SECRET` and `ADMIN_PASSWORD` are generated by Render and stored as service environment variables. The application database, snapshots, and uploads use the persistent disk; keep that disk attached when changing or recreating the service.

### Option 1: Heroku (Recommended for rapid deployment)

1. Create a Heroku account and install Heroku CLI
2. Create a new Heroku app:
```bash
heroku create ptk-digital-platform
```

3. Set environment variables:
```bash
heroku config:set SESSION_SECRET="your-secret-key-here"
```

4. Deploy:
```bash
git push heroku main
```

5. Open the app:
```bash
heroku open
```

### Option 2: Railway.app

1. Sign up at railway.app
2. Connect your GitHub repository
3. Set `PORT` to 3000
4. Deploy

### Option 3: DigitalOcean / AWS / VPS

1. Set up a Linux server (Ubuntu 20.04+)
2. Install Node.js:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. Clone the repository and install:
```bash
git clone https://github.com/kpraveenkumar182007-commits/ptk-digital-platform.git
cd ptk-digital-platform
npm install --production
```

4. Use PM2 for process management:
```bash
sudo npm install -g pm2
pm2 start server.js --name "ptk-platform"
pm2 startup
pm2 save
```

5. Set up Nginx as reverse proxy:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

6. Enable HTTPS with Let's Encrypt:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## Configuration

### Environment Variables
```bash
PORT=3000                           # Server port
SESSION_SECRET="use-at-least-32-random-characters-here" # Stable session signing key
ADMIN_PASSWORD="set-before-first-start"   # Optional first-run admin password
NODE_ENV=production                 # production or development
```

Admin login is rate-limited, uses secure same-site session cookies, and rejects cross-origin admin form submissions. Member profile images are only served to authenticated administrators; configured public branding images remain available to the public site.
Use at least 32 characters for `SESSION_SECRET` and 16 for `ADMIN_PASSWORD`.

### Database Backup
- Automated backups can be exported from `/admin/backup`
- JSON backup includes all tables and can be restored
- Keep backups in a secure location

## Testing Checklist

- [ ] Homepage loads and displays current year/stats
- [ ] Tamil text renders correctly
- [ ] Membership application validates and saves
- [ ] Duplicate applications are rejected
- [ ] Admin login works
- [ ] Anonymous users cannot access admin endpoints
- [ ] Membership approval creates member record
- [ ] Member IDs are unique
- [ ] Membership cards display red-yellow-green design
- [ ] QR code links to verification page
- [ ] Card colours can be customized independently
- [ ] Website content updates reflect in homepage
- [ ] Announcements and events publish correctly
- [ ] Volunteer and grievance submissions are private
- [ ] CSV exports contain real data
- [ ] Backup file can be downloaded
- [ ] Audit logs record administrative changes
- [ ] Mobile layout is responsive
- [ ] No console errors

## Troubleshooting

### Database locked error
- Ensure only one instance of the app is running
- Restart the server if this persists

### Admin login fails
- Verify credentials are correct
- Check that `/data/ptk.db` exists and is readable

### Cards not showing colours
- Verify CSS variables are set correctly in `/admin/branding`
- Clear browser cache and reload

### CSV export encoding issues
- All CSV files use UTF-8 encoding
- Open with spreadsheet software that supports UTF-8

## Support

For issues or questions, please create an issue on GitHub:
https://github.com/kpraveenkumar182007-commits/ptk-digital-platform/issues

## License

MIT
