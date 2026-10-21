# Runtime troubleshooting

## Browser reports `ERR_CONNECTION_REFUSED`

The Node.js server is not running or the browser is using the wrong port.

- On Windows, start `START-WINDOWS.bat` and keep the **PTK Website Server** window open.
- The default local address is `http://localhost:3000`; use the port printed by the server if `PORT` was changed.
- Confirm the server says `PTK platform running on http://localhost:<port>`.
- Open `/healthz`; a running app with a ready database responds with `{"status":"ok"}`.
- If startup reports `EADDRINUSE`, another app already uses the port; set `PORT=3001` and restart instead of terminating an unknown process.

## `npm ci` or native SQLite installation fails

Install Node.js 22 or newer and use the matching npm version, then run `npm ci` again from the extracted application folder. On Linux, install the operating-system build tools if the SQLite native binding cannot download a compatible prebuilt binary.

## Database or upload changes disappear after deployment

The SQLite database and uploaded images must live on persistent writable storage. The Docker Compose setup uses named volumes. Do not delete them with `docker compose down -v`. Take regular backups from the admin panel and keep copies off the server.

## Admin sign-in keeps redirecting

Use the same hostname and port consistently (for example, `localhost` rather than switching between `localhost` and `127.0.0.1`). Production cookies require HTTPS. Check that `SESSION_SECRET` remains stable across restarts and the persistent database contains the administrator account.

## Startup warnings in production

Set a stable `SESSION_SECRET` (at least 32 characters) so sessions survive restarts, and set `PUBLIC_BASE_URL` to the public HTTPS origin so card QR codes point at the live site. A new database uses `INITIAL_ADMIN_PASSWORD` when provided; otherwise a random password is generated and saved to `data/admin-credentials.txt`. Existing administrator passwords are preserved. To reset access explicitly, set a new `INITIAL_ADMIN_PASSWORD` (at least 12 characters) and `FORCE_ADMIN_RESET=true` for one startup, then remove the flag. In production, startup is refused unless the database, backups, uploads, and CSV export are beneath the mounted persistent disk; attach/configure the Render disk rather than relying on ephemeral local storage.

## Admin route shows 403 on form submission

Submit the admin/public form from the same site origin and preserve the public host/protocol in the reverse-proxy headers. Configure `TRUST_PROXY` for the number of trusted proxies in front of the Node process.

## Card QR does not open the public site

Set `PUBLIC_BASE_URL` to the public HTTPS origin, such as `https://ptk.example.org`, then issue or re-render the card. The QR code contains a same-site verification URL.

## Do not delete the live database to troubleshoot

Deleting `data/ptk.db` permanently removes member records, admin accounts, content, and application settings. Take a backup and inspect the server error logs first. Test destructive maintenance on a separate copy of the database.
