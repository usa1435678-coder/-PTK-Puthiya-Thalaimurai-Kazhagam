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

The app always starts, but logs warnings when configuration is incomplete. Set a stable `SESSION_SECRET` (at least 32 characters) so sessions survive restarts, and set `PUBLIC_BASE_URL` to the public HTTPS origin so card QR codes point at the live site. On a new database the administrator account is created with `INITIAL_ADMIN_PASSWORD` when provided (at least 12 characters), otherwise the documented default `PTKadmin@2026` is used. If the persistent disk is missing, the app falls back to a local `./data` directory and warns that data will not survive a redeploy.

## Admin route shows 403 on form submission

Submit the admin/public form from the same site origin and preserve the public host/protocol in the reverse-proxy headers. Configure `TRUST_PROXY` for the number of trusted proxies in front of the Node process.

## Card QR does not open the public site

Set `PUBLIC_BASE_URL` to the public HTTPS origin, such as `https://ptk.example.org`, then issue or re-render the card. The QR code contains a same-site verification URL.

## Do not delete the live database to troubleshoot

Deleting `data/ptk.db` permanently removes member records, admin accounts, content, and application settings. Take a backup and inspect the server error logs first. Test destructive maintenance on a separate copy of the database.
