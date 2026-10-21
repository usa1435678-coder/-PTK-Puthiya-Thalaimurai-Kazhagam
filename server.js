require('express-async-errors');

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Persistent storage bootstrap (must run before ./db is loaded) ---
// Prefer the Render persistent disk (default /var/data) when it is mounted and
// writable; otherwise use ./data for local development. Production startup is
// refused unless the persistent mount and all configured storage paths are valid.
const persistentStorageRoot = path.resolve(process.env.PERSISTENT_STORAGE_ROOT || '/var/data');
function directoryIsWritable(directory) {
  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.accessSync(directory, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
function isPersistentStorageMounted(mountPath) {
  try {
    const mountInfo = fs.readFileSync('/proc/self/mountinfo', 'utf8');
    return mountInfo.split('\n').some(line => {
      const fields = line.split(' - ')[0].split(' ');
      const mountedAt = fields[4] && fields[4].replace(/\\([0-7]{3})/g, (_, code) => String.fromCharCode(parseInt(code, 8)));
      return mountedAt && path.resolve(mountedAt) === mountPath;
    });
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EACCES') return false;
    throw error;
  }
}
const persistentStorageMounted = directoryIsWritable(persistentStorageRoot) &&
  isPersistentStorageMounted(persistentStorageRoot);
const storageRoot = persistentStorageMounted ? persistentStorageRoot : path.join(__dirname, 'data');
if (!process.env.DB_PATH) process.env.DB_PATH = path.join(storageRoot, 'ptk.db');
if (!process.env.BACKUP_DIR) process.env.BACKUP_DIR = path.join(storageRoot, 'backups');
if (!process.env.UPLOAD_DIR) process.env.UPLOAD_DIR = path.join(storageRoot, 'uploads');
if (!process.env.MEMBER_CSV_PATH) process.env.MEMBER_CSV_PATH = path.join(storageRoot, 'ptk-members.csv');

const {
  db,
  initDatabase,
  createDatabaseBackup,
  listDatabaseBackups,
  restoreBackupUploads,
  backupDirectory,
  getSettings,
  getAllRows,
  getRow,
  runQuery,
  csvEscape,
  addAuditLog
} = require('./db');

const app = express();
const port = process.env.PORT || 3000;
const uploadDirectory = path.resolve(process.env.UPLOAD_DIR);
const isInsidePersistentStorage = (targetPath) => {
  const relative = path.relative(storageRoot, path.resolve(targetPath));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};
const persistentStorageConfigured = persistentStorageMounted &&
  isInsidePersistentStorage(process.env.DB_PATH) &&
  isInsidePersistentStorage(process.env.BACKUP_DIR) &&
  isInsidePersistentStorage(process.env.UPLOAD_DIR) &&
  isInsidePersistentStorage(process.env.MEMBER_CSV_PATH);
if (process.env.NODE_ENV === 'production' && !persistentStorageConfigured) {
  throw new Error('Refusing to start in production without a mounted persistent disk configured for the database, backups, uploads, and member CSV.');
}
const loginAttempts = new Map();
const loginAttemptWindowMs = 15 * 60 * 1000;
const maxLoginAttempts = 5;
if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters long.');
}
const imageExtensions = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

fs.mkdirSync(uploadDirectory, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (req, file, callback) => {
      callback(null, `${crypto.randomBytes(16).toString('hex')}${imageExtensions[file.mimetype] || ''}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 7 },
  fileFilter: (req, file, callback) => {
    if (!imageExtensions[file.mimetype]) {
      return callback(new Error('Only JPG, PNG, and WEBP images are allowed.'));
    }
    callback(null, true);
  }
});
const backupUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!file.originalname.toLowerCase().endsWith('.json') || (file.mimetype !== 'application/json' && file.mimetype !== 'text/json' && file.mimetype !== 'text/plain' && file.mimetype !== 'application/octet-stream')) {
      return callback(new Error('Backup upload must be a JSON file.'));
    }
    callback(null, true);
  }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.json({ limit: '25mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; object-src 'none'");
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Persistent, database-backed session store so administrator logins survive
// process restarts and redeploys on Render.
class SQLiteSessionStore extends session.Store {
  constructor() {
    super();
    this.cleanupTimer = setInterval(() => {
      runQuery('DELETE FROM ptk_sessions WHERE expires <= ?', [Date.now()]).catch(error => console.error('Session cleanup failed:', error));
    }, 60 * 60 * 1000);
    if (typeof this.cleanupTimer.unref === 'function') this.cleanupTimer.unref();
  }

  get(sid, callback) {
    getRow('SELECT session_json, expires FROM ptk_sessions WHERE sid = ?', [sid]).then(row => {
      if (!row || row.expires <= Date.now()) {
        if (row) this.destroy(sid, error => callback(error, null));
        else callback(null, null);
        return;
      }
      try {
        callback(null, JSON.parse(row.session_json));
      } catch (error) {
        callback(error);
      }
    }).catch(callback);
  }

  set(sid, sessionData, callback = () => {}) {
    const expires = sessionData.cookie && sessionData.cookie.expires
      ? new Date(sessionData.cookie.expires).getTime()
      : Date.now() + 1000 * 60 * 60 * 8;
    runQuery(
      `INSERT INTO ptk_sessions (sid, session_json, expires) VALUES (?, ?, ?)
       ON CONFLICT(sid) DO UPDATE SET session_json = excluded.session_json, expires = excluded.expires`,
      [sid, JSON.stringify(sessionData), expires]
    ).then(() => callback(null)).catch(callback);
  }

  destroy(sid, callback = () => {}) {
    runQuery('DELETE FROM ptk_sessions WHERE sid = ?', [sid]).then(() => callback(null)).catch(callback);
  }

  touch(sid, sessionData, callback = () => {}) {
    this.set(sid, sessionData, callback);
  }
}

app.use(session({
  name: 'ptk.sid',
  secret: sessionSecret,
  store: new SQLiteSessionStore(),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: 'auto', sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 }
}));
app.use('/uploads', async (req, res, next) => {
  const settings = await loadSiteSettings();
  const publicBrandingAssets = [
    settings.logo_url,
    settings.leader_photo_url,
    settings.flag_url,
    settings.signature_url,
    settings.hero_background_url,
    settings.card_background_url
  ];
  if (publicBrandingAssets.includes(`/uploads${req.path}`)) return next();
  res.set('Cache-Control', 'private, no-store');
  return requireAuth(req, res, next);
});
app.use('/uploads', express.static(uploadDirectory, { fallthrough: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (req.method !== 'POST') return next();
  const origin = req.get('origin');
  const referer = req.get('referer');
  let requestOrigin = origin;
  if (!requestOrigin && referer) {
    try {
      requestOrigin = new URL(referer).origin;
    } catch {
      requestOrigin = '';
    }
  }
  const expectedOrigin = `${req.protocol}://${req.get('host')}`;
  if (requestOrigin !== expectedOrigin) return res.sendStatus(403);
  next();
});

app.use((req, res, next) => {
  res.locals.loggedIn = !!req.session.user;
  res.locals.currentUser = req.session.user || null;
  next();
});

app.get('/healthz', async (req, res) => {
  await getRow('SELECT 1');
  res.json({ status: 'ok', build: 'ptk-2026-10-19-3' });
});

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/admin/login');
  }
  next();
}

function createMemberId() {
  return 'PTK-' + Math.random().toString(36).slice(2, 8).toUpperCase() + '-' + Date.now().toString().slice(-6);
}

function createReference(prefix = 'PTK') {
  return prefix + '-' + Date.now().toString().slice(-8) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
}

function formatDate(dateValue) {
  if (!dateValue) return 'N/A';
  const d = new Date(dateValue);
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toISOString().slice(0, 10);
}

async function loadSiteSettings() {
  const rows = await getAllRows('SELECT setting_key, setting_value FROM settings');
  return Object.fromEntries(rows.map(r => [r.setting_key, r.setting_value]));
}

/**
 * Keep a server-side CSV snapshot of every membership application.
 * The SQLite database is the source of truth; this CSV is a convenience export.
 * Set MEMBER_CSV_PATH to a persistent volume path in production.
 */
async function syncMemberCsv() {
  const rows = await getAllRows(`
    SELECT a.application_ref, COALESCE(m.member_id, '') AS member_id,
           a.full_name, a.tamil_name, a.phone, a.email, a.district,
           a.local_unit, a.address, a.membership_category,
           CASE WHEN m.status = 'inactive' THEN 'inactive' ELSE a.status END AS status,
           a.created_at, a.updated_at
    FROM membership_applications a
    LEFT JOIN members m ON m.phone = a.phone AND m.full_name = a.full_name
    ORDER BY a.created_at DESC
  `);
  const headers = [
    'application_ref', 'member_id', 'full_name', 'tamil_name', 'phone',
    'email', 'district', 'local_unit', 'address', 'membership_category',
    'status', 'created_at', 'updated_at'
  ];
  const csv = '\uFEFF' + [headers.join(',')]
    .concat(rows.map(row => headers.map(key => csvEscape(row[key])).join(',')))
    .join('\r\n') + '\r\n';
  const filePath = process.env.MEMBER_CSV_PATH || path.join(__dirname, 'data', 'ptk-members.csv');
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, csv, 'utf8');
}

async function removeUnusedMemberPhoto(photoUrl) {
  if (!photoUrl) return;
  const filename = path.basename(photoUrl);
  if (photoUrl !== `/uploads/${filename}`) return;
  const remaining = await getRow(
    `SELECT id FROM members WHERE photo_url = ?
     UNION ALL SELECT id FROM membership_applications WHERE photo_url = ?
     UNION ALL SELECT id FROM volunteers WHERE photo_url = ?
     UNION ALL SELECT setting_key AS id FROM settings WHERE setting_value = ?
     LIMIT 1`,
    [photoUrl, photoUrl, photoUrl, photoUrl]
  );
  if (!remaining) {
    await fs.promises.unlink(path.join(uploadDirectory, filename)).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

function redirectIfLoggedIn(req, res, next) {
  if (req.session.user) return res.redirect('/admin/dashboard');
  next();
}

app.get('/', async (req, res) => {
  const settings = await loadSiteSettings();
  const announcements = await getAllRows('SELECT * FROM announcements WHERE published = 1 ORDER BY created_at DESC LIMIT 5');
  const events = await getAllRows('SELECT * FROM events WHERE published = 1 ORDER BY event_date ASC LIMIT 5');
  const count = async (sql) => {
    const row = await getRow(sql);
    return row ? row.total : 0;
  };
  const heroStats = {
    members: await count('SELECT COUNT(*) AS total FROM members'),
    districts: await count('SELECT COUNT(*) AS total FROM districts'),
    volunteers: await count('SELECT COUNT(*) AS total FROM volunteers')
  };

  res.render('index', {
    settings,
    announcements,
    events,
    heroStats,
    formatDate
  });
});

app.get('/membership', async (req, res) => {
  const settings = await loadSiteSettings();
  res.render('membership', { settings, error: null, success: null, flash: null });
});

app.get('/application-status', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.render('application-status', {
    settings: await loadSiteSettings(),
    application: null,
    error: null,
    reference: '',
    phone: '',
    formatDate
  });
});

app.post('/application-status', async (req, res) => {
  const reference = (req.body.application_ref || '').trim();
  const phone = (req.body.phone || '').trim();
  let application = null;
  if (reference && normalizePhone(phone)) {
    const candidate = await getRow(`
      SELECT a.application_ref, a.full_name, a.phone, a.district, a.local_unit,
             a.membership_category, a.status, a.created_at, a.updated_at,
             m.member_id
      FROM membership_applications a
      LEFT JOIN members m ON m.phone = a.phone AND m.full_name = a.full_name
      WHERE LOWER(a.application_ref) = LOWER(?) OR LOWER(m.member_id) = LOWER(?)
      ORDER BY a.created_at DESC
      LIMIT 1
    `, [reference, reference]);
    if (candidate && normalizePhone(candidate.phone) === normalizePhone(phone)) {
      application = candidate;
    }
  }

  res.set('Cache-Control', 'no-store');
  res.render('application-status', {
    settings: await loadSiteSettings(),
    application,
    reference,
    phone,
    error: application ? null : 'Application not found. Check the reference and phone number and try again.',
    formatDate
  });
});

app.post('/membership', upload.single('member_photo'), async (req, res) => {
  const settings = await loadSiteSettings();
  const form = {
    full_name: (req.body.full_name || '').trim(),
    tamil_name: (req.body.tamil_name || '').trim(),
    phone: (req.body.phone || '').trim(),
    email: (req.body.email || '').trim(),
    district: (req.body.district || '').trim(),
    local_unit: (req.body.local_unit || '').trim(),
    address: (req.body.address || '').trim(),
    membership_category: (req.body.membership_category || '').trim(),
    consent: req.body.consent === 'on' || req.body.consent === 'true'
  };

  if (!form.full_name || !form.phone || !form.district || !form.local_unit || !form.membership_category || !form.consent) {
    return res.render('membership', {
      settings,
      error: 'Please complete all required fields and accept the privacy notice.',
      success: null,
      flash: null
    });
  }

  const duplicate = await getRow(
    'SELECT id FROM membership_applications WHERE LOWER(phone) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1',
    [form.phone, form.email || '']
  );

  if (duplicate) {
    return res.render('membership', {
      settings,
      error: 'A pending or approved application already exists for this contact information.',
      success: null,
      flash: null
    });
  }

  const ref = createReference('APP');
  await runQuery(
    `INSERT INTO membership_applications (
      application_ref, full_name, tamil_name, phone, email, district, local_unit, address, photo_url, membership_category, consent, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`,
    [ref, form.full_name, form.tamil_name, form.phone, form.email || null, form.district, form.local_unit, form.address || null, req.file ? `/uploads/${req.file.filename}` : null, form.membership_category, form.consent ? 1 : 0]
  );

  await addAuditLog('membership_application_submitted', `Application ${ref} submitted by ${form.full_name}`, 'membership_application', ref, 'public');
  await syncMemberCsv();

  res.render('membership', {
    settings,
    error: null,
    success: `Your application has been submitted successfully. Reference: ${ref}`,
    flash: null
  });
});

app.post('/volunteer', async (req, res) => {
  const { full_name, phone, email, district, interest, availability, message } = req.body;
  if (!full_name || !phone || !district || !interest) {
    return res.json({ success: false, message: 'Please fill in the required volunteer fields.' });
  }
  const ref = createReference('VOL');
  await runQuery(
    'INSERT INTO volunteers (ref, full_name, phone, email, district, interest, availability, message, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "new", datetime("now"), datetime("now"))',
    [ref, full_name, phone, email || null, district, interest, availability || null, message || null]
  );
  await addAuditLog('volunteer_application_submitted', `Volunteer ${ref} registered for ${district}`, 'volunteer', ref, 'public');
  return res.json({ success: true, message: 'Volunteer registration saved successfully. Your reference is ' + ref });
});

app.post('/grievance', async (req, res) => {
  const { full_name, phone, district, subject, message } = req.body;
  if (!full_name || !phone || !subject || !message) {
    return res.json({ success: false, message: 'Please complete all grievance fields.' });
  }
  const ref = createReference('GRV');
  await runQuery(
    'INSERT INTO grievances (ref, full_name, phone, district, subject, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, "new", datetime("now"))',
    [ref, full_name, phone, district || null, subject, message]
  );
  await addAuditLog('grievance_submitted', `Grievance ${ref} submitted by ${full_name}`, 'grievance', ref, 'public');
  return res.json({ success: true, message: 'Your grievance has been submitted. Reference: ' + ref });
});

app.post('/contact', async (req, res) => {
  const { full_name, email, phone, subject, message } = req.body;
  if (!full_name || !subject || !message) {
    return res.json({ success: false, message: 'Please complete the contact form.' });
  }
  const ref = createReference('CNT');
  await runQuery(
    'INSERT INTO contact_requests (ref, full_name, email, phone, subject, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, "new", datetime("now"))',
    [ref, full_name, email || null, phone || null, subject, message]
  );
  await addAuditLog('contact_request_submitted', `Contact request ${ref} received from ${full_name}`, 'contact_request', ref, 'public');
  return res.json({ success: true, message: 'Thank you. Your message has been received. Reference: ' + ref });
});

app.get('/verify/:memberId', async (req, res) => {
  const member = await getRow(`
    SELECT m.*, c.status AS card_status, c.issue_date, c.revoked_at, c.member_id as card_member_id
    FROM members m
    LEFT JOIN cards c ON c.member_id = m.id
    WHERE m.member_id = ?
  `, [req.params.memberId]);

  if (!member) {
    return res.status(404).render('verify', { valid: false, member: null, settings: await loadSiteSettings() });
  }

  const isValid = member.status === 'active' && member.card_status === 'active';
  res.render('verify', { valid: isValid, member, settings: await loadSiteSettings() });
});

app.get('/admin/login', redirectIfLoggedIn, async (req, res) => {
  res.render('admin-login', { error: null, username: '', settings: await loadSiteSettings() });
});

app.use('/admin/login', async (req, res, next) => {
  if (req.method !== 'POST') return next();
  const now = Date.now();
  const key = req.ip;
  const current = loginAttempts.get(key);
  if (current && current.expiresAt <= now) loginAttempts.delete(key);
  const active = loginAttempts.get(key);
  if (active && active.count >= maxLoginAttempts) {
    return res.status(429).render('admin-login', {
      error: 'Too many login attempts. Please wait 15 minutes and try again.',
      username: '',
      settings: await loadSiteSettings()
    });
  }
  loginAttempts.set(key, {
    count: active ? active.count + 1 : 1,
    expiresAt: active ? active.expiresAt : now + loginAttemptWindowMs
  });
  next();
});

app.post('/admin/login', async (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = username ? await getRow('SELECT * FROM users WHERE username = ?', [username]) : null;

  if (!user || !password || !bcrypt.compareSync(password, user.password_hash)) {
    return res.render('admin-login', { error: 'Invalid username or password.', username, settings: await loadSiteSettings() });
  }

  loginAttempts.delete(req.ip);
  await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
  req.session.user = { id: user.id, username: user.username, role: user.role };
  await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
  return res.redirect('/admin/dashboard');
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

app.get('/admin/dashboard', requireAuth, async (req, res) => {
  const settings = await loadSiteSettings();
  const count = async (sql) => {
    const row = await getRow(sql);
    return row ? row.total : 0;
  };
  const stats = {
    applications: await count('SELECT COUNT(*) AS total FROM membership_applications'),
    members: await count('SELECT COUNT(*) AS total FROM members'),
    activeCards: await count("SELECT COUNT(*) AS total FROM cards WHERE status = 'active'"),
    volunteers: await count('SELECT COUNT(*) AS total FROM volunteers'),
    grievances: await count('SELECT COUNT(*) AS total FROM grievances'),
    contactRequests: await count('SELECT COUNT(*) AS total FROM contact_requests')
  };

  const applications = await getAllRows('SELECT * FROM membership_applications ORDER BY created_at DESC LIMIT 8');
  const members = await getAllRows('SELECT * FROM members ORDER BY created_at DESC LIMIT 8');
  const cards = await getAllRows('SELECT c.*, m.full_name, m.member_id AS member_code FROM cards c LEFT JOIN members m ON m.id = c.member_id ORDER BY c.created_at DESC LIMIT 8');
  const logs = await getAllRows('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10');

  res.render('admin-dashboard', {
    settings,
    stats,
    applications,
    members,
    cards,
    logs,
    persistentStorageConfigured,
    persistentStorageRoot,
    formatDate
  });
});

app.post('/admin/application/:id/status', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { status, note, return_to: returnTo } = req.body;
  const redirectPath = returnTo === 'members' ? '/admin/members' : '/admin/dashboard';
  const application = await getRow('SELECT * FROM membership_applications WHERE id = ?', [id]);
  if (!application) return res.status(404).send('Application not found');
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).send('Choose approve or reject for a membership application.');
  }
  if (application.status === status) {
    return res.redirect(redirectPath);
  }
  if (application.status === 'approved') {
    return res.status(409).send('This application is already approved. Deactivate the member instead.');
  }
  if (!['pending', 'rejected'].includes(application.status)) {
    return res.status(409).send('This application cannot be reviewed in its current state.');
  }

  if (status === 'approved') {
    let member = await getRow(
      'SELECT * FROM members WHERE phone = ? AND full_name = ?',
      [application.phone, application.full_name]
    );
    if (!member) {
      const memberId = createMemberId();
      await runQuery(`
        INSERT INTO members (
          member_id, full_name, tamil_name, phone, email, district, local_unit, address, photo_url, membership_category, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
      `, [
        memberId,
        application.full_name,
        application.tamil_name,
        application.phone,
        application.email,
        application.district,
        application.local_unit,
        application.address,
        application.photo_url,
        application.membership_category
      ]);
      member = await getRow('SELECT * FROM members WHERE member_id = ?', [memberId]);
      await addAuditLog('membership_approved', `Member ${memberId} approved from application ${application.application_ref}`, 'member', member.id, req.session.user.username);
    }

    const card = await getRow('SELECT id FROM cards WHERE member_id = ?', [member.id]);
    if (!card) {
      await runQuery(`
        INSERT INTO cards (member_id, issue_date, status, generated_by, created_at)
        VALUES (?, date('now'), 'active', ?, datetime('now'))
      `, [member.id, req.session.user.username]);
    }
  }

  await runQuery('UPDATE membership_applications SET status = ?, review_note = ?, updated_at = datetime("now") WHERE id = ?', [status, note || null, id]);
  await addAuditLog('application_status_updated', `Application ${application.application_ref} marked ${status}`, 'membership_application', application.id, req.session.user.username);
  await syncMemberCsv();
  res.redirect(redirectPath);
});

app.post('/admin/application/:id/edit', requireAuth, upload.single('member_photo'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    if (req.file) await removeUnusedMemberPhoto(`/uploads/${req.file.filename}`);
    return res.status(400).send('Invalid application ID.');
  }
  const application = await getRow('SELECT * FROM membership_applications WHERE id = ?', [id]);
  if (!application) {
    if (req.file) await removeUnusedMemberPhoto(`/uploads/${req.file.filename}`);
    return res.status(404).send('Application not found.');
  }
  if (!['pending', 'rejected'].includes(application.status)) {
    if (req.file) await removeUnusedMemberPhoto(`/uploads/${req.file.filename}`);
    return res.status(409).send('Only pending or rejected applications can be edited here.');
  }

  const updated = {
    full_name: (req.body.full_name || '').trim(),
    tamil_name: (req.body.tamil_name || '').trim(),
    phone: (req.body.phone || '').trim(),
    email: (req.body.email || '').trim(),
    district: (req.body.district || '').trim(),
    local_unit: (req.body.local_unit || '').trim(),
    address: (req.body.address || '').trim(),
    membership_category: (req.body.membership_category || '').trim()
  };
  if (!updated.full_name || !updated.phone || !updated.district || !updated.local_unit || !updated.membership_category) {
    if (req.file) await removeUnusedMemberPhoto(`/uploads/${req.file.filename}`);
    return res.status(400).send('Name, phone, district, local unit, and membership category are required.');
  }
  const duplicate = await getRow(
    'SELECT id FROM membership_applications WHERE id != ? AND (LOWER(phone) = LOWER(?) OR (? != \'\' AND LOWER(email) = LOWER(?))) LIMIT 1',
    [id, updated.phone, updated.email, updated.email]
  );
  const duplicateMember = await getRow(
    'SELECT id FROM members WHERE LOWER(phone) = LOWER(?) OR (? != \'\' AND LOWER(email) = LOWER(?)) LIMIT 1',
    [updated.phone, updated.email, updated.email]
  );
  if (duplicate || duplicateMember) {
    if (req.file) await removeUnusedMemberPhoto(`/uploads/${req.file.filename}`);
    return res.status(409).send('Another application already uses this phone number or email.');
  }

  const photoUrl = req.file
    ? `/uploads/${req.file.filename}`
    : req.body.clear_photo === '1' ? null : application.photo_url;
  if (application.photo_url && application.photo_url !== photoUrl) await createDatabaseBackup('before-delete');
  await runQuery('BEGIN IMMEDIATE TRANSACTION');
  try {
    await runQuery(`
      UPDATE membership_applications
      SET full_name = ?, tamil_name = ?, phone = ?, email = ?, district = ?, local_unit = ?,
          address = ?, photo_url = ?, membership_category = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [
      updated.full_name, updated.tamil_name || null, updated.phone, updated.email || null,
      updated.district, updated.local_unit, updated.address || null, photoUrl,
      updated.membership_category, id
    ]);
    await addAuditLog('membership_application_updated', `Application ${application.application_ref} details updated`, 'membership_application', id, req.session.user.username);
    await runQuery('COMMIT');
  } catch (error) {
    await runQuery('ROLLBACK');
    if (req.file) await removeUnusedMemberPhoto(`/uploads/${req.file.filename}`);
    throw error;
  }

  if (application.photo_url !== photoUrl) await removeUnusedMemberPhoto(application.photo_url);
  await syncMemberCsv();
  res.redirect('/admin/members?saved=application-edited');
});

app.post('/admin/application/:id/delete', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).send('Invalid application ID.');
  const application = await getRow('SELECT * FROM membership_applications WHERE id = ?', [id]);
  if (!application) return res.status(404).send('Application not found.');
  if (application.status === 'approved') {
    return res.status(409).send('Approved applications are linked to a member. Delete the member from the member directory instead.');
  }
  await createDatabaseBackup('before-delete');
  await runQuery('BEGIN IMMEDIATE TRANSACTION');
  try {
    await runQuery('DELETE FROM membership_applications WHERE id = ?', [id]);
    await addAuditLog('membership_application_deleted', `Application ${application.application_ref} deleted`, 'membership_application', application.id, req.session.user.username);
    await runQuery('COMMIT');
  } catch (error) {
    await runQuery('ROLLBACK');
    throw error;
  }
  await removeUnusedMemberPhoto(application.photo_url);
  await syncMemberCsv();
  res.redirect('/admin/members?saved=application-deleted');
});

app.get('/admin/members', requireAuth, async (req, res) => {
  const settings = await loadSiteSettings();
  const members = await getAllRows(`
    SELECT m.*, c.status AS card_status, c.issue_date,
           a.application_ref, a.id AS application_id, a.status AS application_status
    FROM members m
    LEFT JOIN cards c ON c.member_id = m.id
    LEFT JOIN membership_applications a ON a.phone = m.phone AND a.full_name = m.full_name
    WHERE (? = 0 OR (m.status = 'active' AND c.status = 'active'))
    ORDER BY m.created_at DESC
  `, [req.query.filter === 'active' ? 1 : 0]);
  const applications = await getAllRows(`
    SELECT * FROM membership_applications
    WHERE status IN ('pending', 'rejected')
    ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC
  `);
  const notices = {
    edited: 'Member details saved.',
    'application-edited': 'Application details saved.',
    'application-deleted': 'Application deleted.',
    activated: 'Member and card activated.',
    deactivated: 'Member and card deactivated.',
    deleted: 'Member and linked application deleted.'
  };
  res.render('admin-members', {
    settings,
    members,
    applications,
    formatDate,
    memberFilter: req.query.filter === 'active' ? 'active' : null,
    notice: notices[req.query.saved] || null
  });
});

app.post('/admin/members/:id/status', requireAuth, async (req, res) => {
  const member = await getRow('SELECT * FROM members WHERE id = ?', [req.params.id]);
  if (!member) return res.status(404).send('Member not found.');
  const status = req.body.status;
  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).send('Member status must be active or inactive.');
  }

  await runQuery('BEGIN IMMEDIATE TRANSACTION');
  try {
    await runQuery('UPDATE members SET status = ?, updated_at = datetime("now") WHERE id = ?', [status, member.id]);
    const card = await getRow('SELECT id FROM cards WHERE member_id = ?', [member.id]);
    if (card) {
      await runQuery(
        'UPDATE cards SET status = ?, revoked_at = ? WHERE member_id = ?',
        [status === 'active' ? 'active' : 'revoked', status === 'active' ? null : new Date().toISOString(), member.id]
      );
    } else if (status === 'active') {
      await runQuery(
        `INSERT INTO cards (member_id, issue_date, status, generated_by, created_at)
         VALUES (?, date('now'), 'active', ?, datetime('now'))`,
        [member.id, req.session.user.username]
      );
    }
    await addAuditLog(
      status === 'active' ? 'member_activated' : 'member_deactivated',
      `Member ${member.member_id} ${status}`,
      'member',
      member.id,
      req.session.user.username
    );
    await runQuery(
      'UPDATE volunteers SET status = ?, updated_at = datetime("now") WHERE member_id = ?',
      [status === 'active' ? 'approved' : 'inactive', member.id]
    );
    await runQuery('COMMIT');
  } catch (error) {
    await runQuery('ROLLBACK');
    throw error;
  }

  await syncMemberCsv();
  res.redirect(`/admin/members?saved=${status === 'active' ? 'activated' : 'deactivated'}`);
});

app.post('/admin/members/:id/edit', requireAuth, upload.single('member_photo'), async (req, res) => {
  const member = await getRow('SELECT * FROM members WHERE id = ?', [req.params.id]);
  if (!member) {
    if (req.file) await removeUnusedMemberPhoto(`/uploads/${req.file.filename}`);
    return res.status(404).send('Member not found.');
  }

  const newPhotoUrl = req.file
    ? `/uploads/${req.file.filename}`
    : req.body.clear_photo === '1' ? null : member.photo_url;
  const discardUploadedPhoto = async () => {
    if (req.file) await removeUnusedMemberPhoto(newPhotoUrl);
  };
  const updated = {
    full_name: (req.body.full_name || '').trim(),
    tamil_name: (req.body.tamil_name || '').trim(),
    phone: (req.body.phone || '').trim(),
    email: (req.body.email || '').trim(),
    district: (req.body.district || '').trim(),
    local_unit: (req.body.local_unit || '').trim(),
    address: (req.body.address || '').trim(),
    membership_category: (req.body.membership_category || '').trim()
  };
  if (!updated.full_name || !updated.phone || !updated.district || !updated.local_unit || !updated.address || !updated.membership_category) {
    await discardUploadedPhoto();
    return res.status(400).send('Name, phone, district, local unit, full address, and membership category are required.');
  }

  const duplicate = await getRow(
    'SELECT id FROM members WHERE id != ? AND (phone = ? OR (? != \'\' AND LOWER(email) = LOWER(?))) LIMIT 1',
    [member.id, updated.phone, updated.email, updated.email]
  );
  if (duplicate) {
    await discardUploadedPhoto();
    return res.status(409).send('Another member already uses this phone number.');
  }

  if (member.photo_url && member.photo_url !== newPhotoUrl) await createDatabaseBackup('before-delete');
  await runQuery('BEGIN IMMEDIATE TRANSACTION');
  try {
    await runQuery(`
      UPDATE members
      SET full_name = ?, tamil_name = ?, phone = ?, email = ?, district = ?, local_unit = ?,
          address = ?, photo_url = ?, membership_category = ?, updated_at = datetime("now")
      WHERE id = ?
    `, [
      updated.full_name,
      updated.tamil_name || null,
      updated.phone,
      updated.email || null,
      updated.district,
      updated.local_unit,
      updated.address,
      newPhotoUrl,
      updated.membership_category,
      member.id
    ]);
    await runQuery(`
      UPDATE membership_applications
      SET full_name = ?, tamil_name = ?, phone = ?, email = ?, district = ?, local_unit = ?,
          address = ?, photo_url = ?, membership_category = ?, updated_at = datetime("now")
      WHERE phone = ? AND full_name = ? AND status = 'approved'
    `, [
      updated.full_name,
      updated.tamil_name || null,
      updated.phone,
      updated.email || null,
      updated.district,
      updated.local_unit,
      updated.address,
      newPhotoUrl,
      updated.membership_category,
      member.phone,
      member.full_name
    ]);
    await runQuery(`
      UPDATE volunteers
      SET full_name = ?, tamil_name = ?, phone = ?, email = ?, district = ?, local_unit = ?,
          address = ?, photo_url = ?, membership_category = ?, updated_at = datetime('now')
      WHERE member_id = ?
    `, [
      updated.full_name,
      updated.tamil_name || null,
      updated.phone,
      updated.email || null,
      updated.district,
      updated.local_unit,
      updated.address,
      newPhotoUrl,
      updated.membership_category,
      member.id
    ]);
    await addAuditLog('member_updated', `Member ${member.member_id} details updated`, 'member', member.id, req.session.user.username);
    await runQuery('COMMIT');
  } catch (error) {
    await runQuery('ROLLBACK');
    await discardUploadedPhoto();
    throw error;
  }

  if (member.photo_url !== newPhotoUrl) {
    await removeUnusedMemberPhoto(member.photo_url);
  }
  await syncMemberCsv();
  res.redirect('/admin/members?saved=edited');
});

app.post('/admin/members/:id/delete', requireAuth, async (req, res) => {
  const member = await getRow('SELECT * FROM members WHERE id = ?', [req.params.id]);
  if (!member) return res.status(404).send('Member not found.');
  const photos = new Set([member.photo_url].filter(Boolean));

  await createDatabaseBackup('before-delete');
  await runQuery('BEGIN IMMEDIATE TRANSACTION');
  try {
    const applications = await getAllRows(
      'SELECT id, photo_url FROM membership_applications WHERE phone = ? AND full_name = ?',
      [member.phone, member.full_name]
    );
    for (const application of applications) {
      if (application.photo_url) photos.add(application.photo_url);
    }
    await runQuery('DELETE FROM cards WHERE member_id = ?', [member.id]);
    await runQuery(
      'DELETE FROM membership_applications WHERE phone = ? AND full_name = ?',
      [member.phone, member.full_name]
    );
    await runQuery(
      'UPDATE volunteers SET member_id = NULL, status = \'new\', updated_at = datetime("now") WHERE member_id = ?',
      [member.id]
    );
    await runQuery('DELETE FROM members WHERE id = ?', [member.id]);
    await addAuditLog('member_deleted', `Member ${member.member_id} and linked application deleted`, 'member', member.member_id, req.session.user.username);
    await runQuery('COMMIT');
  } catch (error) {
    await runQuery('ROLLBACK');
    throw error;
  }

  for (const photoUrl of photos) {
    await removeUnusedMemberPhoto(photoUrl);
  }

  await syncMemberCsv();
  res.redirect('/admin/members?saved=deleted');
});

app.get('/admin/branding', requireAuth, async (req, res) => {
  const settings = await loadSiteSettings();
  const notices = {
    updated: 'Branding settings and image choices saved.',
    default: 'Built-in branding image restored.'
  };
  res.render('admin-branding', {
    settings,
    success: notices[req.query.saved] || null,
    error: null,
    persistentStorageConfigured
  });
});

app.post('/admin/branding/default/:asset', requireAuth, async (req, res) => {
  const builtInAssets = {
    logo: { setting: 'logo_url', url: '/branding/ptk-logo.jpeg' },
    flag: { setting: 'flag_url', url: '/branding/ptk-flag.png' },
    leader: { setting: 'leader_photo_url', url: '/branding/ptk-leader.jpeg' },
    signature: { setting: 'signature_url', url: '/branding/ptk-signature.png' }
  };
  const asset = builtInAssets[req.params.asset];
  if (!asset) return res.status(404).send('Built-in branding asset not found.');

  const previous = await getRow('SELECT setting_value FROM settings WHERE setting_key = ?', [asset.setting]);
  if (previous && previous.setting_value !== asset.url && previous.setting_value.startsWith('/uploads/')) {
    await createDatabaseBackup('before-delete');
  }
  await runQuery(
    'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value',
    [asset.setting, asset.url]
  );
  if (previous && previous.setting_value !== asset.url) await removeUnusedMemberPhoto(previous.setting_value);
  await addAuditLog('branding_default_restored', `Built-in ${req.params.asset} image restored`, 'settings', asset.setting, req.session.user.username);
  res.redirect('/admin/branding?saved=default');
});

app.post('/admin/branding', requireAuth, upload.fields([
  { name: 'logo_file', maxCount: 1 },
  { name: 'leader_photo_file', maxCount: 1 },
  { name: 'flag_file', maxCount: 1 },
  { name: 'signature_file', maxCount: 1 },
  { name: 'hero_background_file', maxCount: 1 },
  { name: 'card_background_file', maxCount: 1 }
]), async (req, res) => {
  const settings = await loadSiteSettings();
  const uploadedUrl = (field, settingKey) => {
    const file = req.files && req.files[field] && req.files[field][0];
    if (file) return `/uploads/${file.filename}`;
    return req.body[`clear_${settingKey}`] === '1' ? '' : (settings[settingKey] || '');
  };
  const textValue = (field, settingKey) => typeof req.body[field] === 'string'
    ? req.body[field].trim()
    : (settings[settingKey] || '');
  const colorValue = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
  const payload = {
    party_name_tamil: textValue('party_name_tamil', 'party_name_tamil'),
    party_name_english: textValue('party_name_english', 'party_name_english'),
    tagline: textValue('tagline', 'tagline'),
    leader_name: textValue('leader_name', 'leader_name'),
    leader_title: textValue('leader_title', 'leader_title'),
    contact_email: textValue('contact_email', 'contact_email'),
    contact_phone: textValue('contact_phone', 'contact_phone'),
    contact_address: textValue('contact_address', 'contact_address'),
    card_red: colorValue(req.body.card_red, settings.card_red || '#A8202B'),
    card_yellow: colorValue(req.body.card_yellow, settings.card_yellow || '#F2C744'),
    card_green: colorValue(req.body.card_green, settings.card_green || '#16734B'),
    logo_url: uploadedUrl('logo_file', 'logo_url'),
    leader_photo_url: uploadedUrl('leader_photo_file', 'leader_photo_url'),
    flag_url: uploadedUrl('flag_file', 'flag_url'),
    signature_url: uploadedUrl('signature_file', 'signature_url'),
    hero_background_url: uploadedUrl('hero_background_file', 'hero_background_url'),
    card_background_url: uploadedUrl('card_background_file', 'card_background_url'),
    about_text: textValue('about_text', 'about_text'),
    mission_text: textValue('mission_text', 'mission_text'),
    vision_text: textValue('vision_text', 'vision_text')
  };
  const oldUploadUrls = ['logo_url', 'leader_photo_url', 'flag_url', 'signature_url', 'hero_background_url', 'card_background_url']
    .map(key => settings[key])
    .filter(url => url && url.startsWith('/uploads/') && !Object.values(payload).includes(url));
  if (oldUploadUrls.length) await createDatabaseBackup('before-delete');
  for (const [key, value] of Object.entries(payload)) {
    await runQuery('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value', [key, value]);
  }
  for (const key of ['logo_url', 'leader_photo_url', 'flag_url', 'signature_url', 'hero_background_url', 'card_background_url']) {
    if (settings[key] && settings[key] !== payload[key]) await removeUnusedMemberPhoto(settings[key]);
  }

  await addAuditLog('branding_updated', 'Branding settings updated', 'settings', 'branding', req.session.user.username);
  res.redirect('/admin/branding?saved=updated');
});

app.get('/admin/content', requireAuth, async (req, res) => {
  const settings = await loadSiteSettings();
  const success = req.query.saved === '1' ? 'Website content saved.' : null;
  res.render('admin-content', { settings, success });
});

app.post('/admin/content', requireAuth, async (req, res) => {
  const payload = {
    about_text: req.body.about_text,
    mission_text: req.body.mission_text,
    vision_text: req.body.vision_text,
    privacy_policy: req.body.privacy_policy,
    terms: req.body.terms,
    contact_address: req.body.contact_address,
    contact_phone: req.body.contact_phone,
    contact_email: req.body.contact_email
  };
  for (const [key, value] of Object.entries(payload)) {
    await runQuery('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value', [key, value]);
  }
  await addAuditLog('website_content_updated', 'Homepage content updated', 'settings', 'website_content', req.session.user.username);
  res.redirect('/admin/content?saved=1');
});

app.get('/admin/reports', requireAuth, async (req, res) => {
  const settings = await loadSiteSettings();
  const members = await getAllRows('SELECT * FROM members ORDER BY created_at DESC');
  res.render('admin-reports', { settings, members, formatDate });
});

app.get('/admin/export/csv/:type', requireAuth, async (req, res) => {
  const type = req.params.type;
  let rows = [];
  if (type === 'members') rows = await getAllRows('SELECT member_id, full_name, tamil_name, phone, email, district, local_unit, membership_category, status FROM members ORDER BY created_at DESC');
  if (type === 'applications') rows = await getAllRows('SELECT application_ref, full_name, phone, district, local_unit, membership_category, status FROM membership_applications ORDER BY created_at DESC');
  if (type === 'volunteers') rows = await getAllRows('SELECT ref, full_name, phone, district, interest, status, member_id, review_note FROM volunteers ORDER BY created_at DESC');
  if (!rows.length) return res.send('No data available');

  const headers = Object.keys(rows[0]);
  const csv = [headers.join(',')].concat(rows.map(row => headers.map(h => csvEscape(String(row[h] ?? ''))).join(','))).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${type}.csv"`);
  res.send(csv);
});

app.get('/admin/backup', requireAuth, async (req, res) => {
  const tables = [
    'settings', 'districts', 'announcements', 'events', 'membership_applications', 'members', 'cards', 'volunteers', 'grievances', 'contact_requests', 'finance_records', 'audit_logs'
  ];
  const data = {};
  await runQuery('BEGIN DEFERRED TRANSACTION');
  try {
    for (const table of tables) {
      data[table] = await getAllRows(`SELECT * FROM ${table}`);
    }
    await runQuery('COMMIT');
  } catch (error) {
    await runQuery('ROLLBACK');
    throw error;
  }
  const payload = {
    version: 1,
    exported_at: new Date().toISOString(),
    data
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="ptk-backup.json"');
  res.send(JSON.stringify(payload, null, 2));
});

app.get('/admin/automatic-backups/:filename', requireAuth, async (req, res, next) => {
  const backups = await listDatabaseBackups();
  const backup = backups.find(item => item.filename === req.params.filename);
  if (!backup) return res.status(404).send('Database backup not found.');
  res.download(path.join(backupDirectory, backup.filename), backup.filename, error => {
    if (error) next(error);
  });
});

app.post('/admin/automatic-backups/create', requireAuth, async (req, res) => {
  await createDatabaseBackup('manual');
  res.redirect('/admin/settings?saved=full-backup-created');
});

app.post('/admin/automatic-backups/:filename/restore', requireAuth, async (req, res) => {
  const backups = await listDatabaseBackups();
  const backup = backups.find(item => item.filename === req.params.filename);
  if (!backup) return res.status(404).send('Database backup not found.');

  const snapshotPath = path.join(backupDirectory, backup.filename);
  const snapshotDb = await new Promise((resolve, reject) => {
    const snapshot = new sqlite3.Database(snapshotPath, sqlite3.OPEN_READONLY, error => {
      if (error) return reject(error);
      resolve(snapshot);
    });
  });

  try {
    const integrity = await new Promise((resolve, reject) => {
      snapshotDb.get('PRAGMA integrity_check', (error, row) => error ? reject(error) : resolve(row && row.integrity_check));
    });
    if (integrity !== 'ok') return res.status(400).send('This database snapshot failed its integrity check.');
    const tables = await new Promise((resolve, reject) => {
      snapshotDb.all("SELECT name FROM sqlite_master WHERE type = 'table'", (error, rows) => error ? reject(error) : resolve(rows.map(row => row.name)));
    });
    const requiredTables = [
      'settings', 'users', 'districts', 'membership_applications', 'members', 'cards', 'announcements',
      'events', 'volunteers', 'grievances', 'contact_requests', 'finance_records', 'audit_logs'
    ];
    if (requiredTables.some(table => !tables.includes(table))) {
      return res.status(400).send('This database snapshot does not contain the complete PTK database schema.');
    }

    await createDatabaseBackup('before-restore');
    await new Promise((resolve, reject) => {
      const restore = db.backup(snapshotPath, 'main', 'main', false, error => {
        if (error) return reject(error);
        restore.step(-1, stepError => stepError ? reject(stepError) : resolve());
      });
    });
  } finally {
    await new Promise((resolve, reject) => snapshotDb.close(error => error ? reject(error) : resolve()));
  }

  await restoreBackupUploads(backup.filename);
  await syncMemberCsv();
  await addAuditLog(
    'database_snapshot_restored',
    `Full database snapshot ${backup.filename} restored; the administrator account and password were restored to the snapshot state.`,
    'system',
    backup.filename,
    req.session.user.username
  );
  res.redirect('/admin/settings?saved=database-restored');
});

app.post('/admin/settings/password', requireAuth, async (req, res) => {
  const currentPassword = typeof req.body.current_password === 'string' ? req.body.current_password : '';
  const newPassword = typeof req.body.new_password === 'string' ? req.body.new_password : '';
  const confirmPassword = typeof req.body.confirm_password === 'string' ? req.body.confirm_password : '';
  const user = await getRow('SELECT id, password_hash FROM users WHERE id = ?', [req.session.user.id]);
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(400).send('The current administrator password is incorrect.');
  }
  if (newPassword.length < 16) {
    return res.status(400).send('The new administrator password must be at least 16 characters long.');
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).send('The new administrator passwords do not match.');
  }

  const credentialsPath = path.join(path.dirname(process.env.DB_PATH), 'admin-credentials.txt');
  try {
    await fs.promises.unlink(credentialsPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const passwordHash = bcrypt.hashSync(newPassword, 12);
  await runQuery('BEGIN IMMEDIATE TRANSACTION');
  try {
    await runQuery('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id]);
    await addAuditLog('administrator_password_changed', 'Administrator password changed by the authenticated administrator', 'user', user.id, req.session.user.username);
    await runQuery('COMMIT');
  } catch (error) {
    await runQuery('ROLLBACK');
    throw error;
  }
  res.redirect('/admin/settings?saved=password');
});

app.get('/admin/settings', requireAuth, async (req, res) => {
  const backups = await listDatabaseBackups();
  res.render('admin-backup', {
    settings: await loadSiteSettings(),
    persistentStorageConfigured,
    persistentStorageRoot,
    automaticBackups: backups.slice(0, 20),
    automaticBackupCount: backups.length,
    success: req.query.saved === 'password' ? 'Administrator password changed.'
      : req.query.saved === 'database-restored' ? 'Full database snapshot restored. Use the administrator password stored in that snapshot if it has changed.'
        : req.query.saved === 'full-backup-created' ? 'Full database and uploaded-file snapshot created.' : null
  });
});

app.post('/admin/restore', requireAuth, backupUpload.single('backup_file'), async (req, res) => {
  const backupText = req.file ? req.file.buffer.toString('utf8') : req.body.backup_json || '';
  if (!backupText) return res.status(400).send('No backup data provided');
  let backup;
  try {
    backup = JSON.parse(backupText);
  } catch (error) {
    return res.status(400).send('Invalid JSON backup file.');
  }

  if (backup.version !== 1 || !backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data)) {
    return res.status(400).send('Backup file missing required structure.');
  }

  const restoreOrder = [
    'settings', 'districts', 'announcements', 'events', 'membership_applications', 'members',
    'cards', 'volunteers', 'grievances', 'contact_requests', 'finance_records', 'audit_logs'
  ];
  const allowedTables = new Set([...restoreOrder, 'users']);
  const tables = Object.keys(backup.data);
  if (tables.some(table => !allowedTables.has(table))) {
    return res.status(400).send('Backup contains an unsupported table.');
  }

  const restoredRows = new Map();
  for (const table of restoreOrder) {
    if (!Object.prototype.hasOwnProperty.call(backup.data, table)) continue;
    const rows = backup.data[table];
    if (!Array.isArray(rows)) return res.status(400).send(`Backup data for ${table} must be an array.`);
    const columns = new Set((await getAllRows(`PRAGMA table_info(${table})`)).map(column => column.name));
    const normalizedRows = [];
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        return res.status(400).send(`Backup data for ${table} contains an invalid row.`);
      }
      const keys = Object.keys(row);
      if (!keys.length || keys.some(key => !columns.has(key))) {
        return res.status(400).send(`Backup data for ${table} contains an unsupported column.`);
      }
      const values = keys.map(key => row[key]);
      if (values.some(value => value !== null && !['string', 'number', 'boolean'].includes(typeof value))) {
        return res.status(400).send(`Backup data for ${table} contains an invalid value.`);
      }
      normalizedRows.push({ keys, values });
    }
    restoredRows.set(table, normalizedRows);
  }

  await createDatabaseBackup('before-restore');
  try {
    await runQuery('BEGIN IMMEDIATE TRANSACTION');
    for (const table of [...restoreOrder].reverse()) {
      if (restoredRows.has(table)) await runQuery(`DELETE FROM ${table}`);
    }
    for (const table of restoreOrder) {
      for (const row of restoredRows.get(table) || []) {
        const columns = row.keys.map(key => `"${key}"`).join(', ');
        const placeholders = row.keys.map(() => '?').join(', ');
        await runQuery(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`, row.values);
      }
    }
    await runQuery('COMMIT');
  } catch (error) {
    try {
      await runQuery('ROLLBACK');
    } catch (rollbackError) {
      console.error('Database restore rollback failed:', rollbackError);
    }
    throw error;
  }

  await addAuditLog('backup_restored', 'Database restore completed', 'system', 'restore', req.session.user.username);
  res.redirect('/admin/dashboard');
});

app.get('/admin/announcements', requireAuth, async (req, res) => {
  const settings = await loadSiteSettings();
  const announcements = await getAllRows('SELECT * FROM announcements ORDER BY created_at DESC');
  const success = req.query.saved === 'updated' ? 'Announcement updated.'
    : req.query.saved === 'deleted' ? 'Announcement deleted.' : null;
  res.render('admin-announcements', { settings, announcements, formatDate, success });
});

app.post('/admin/announcements', requireAuth, async (req, res) => {
  const title = (req.body.title || '').trim();
  const content = (req.body.content || '').trim();
  const published = req.body.published;
  if (!title || !content) return res.status(400).send('Announcement title and content are required.');
  await runQuery('INSERT INTO announcements (title, content, published, created_at, updated_at) VALUES (?, ?, ?, datetime("now"), datetime("now"))', [title, content, published ? 1 : 0]);
  await addAuditLog('announcement_created', `Announcement created: ${title}`, 'announcement', title, req.session.user.username);
  res.redirect('/admin/announcements');
});

app.post('/admin/announcements/:id/edit', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).send('Invalid announcement ID.');
  if (!title || !content) return res.status(400).send('Announcement title and content are required.');
  const existing = await getRow('SELECT id FROM announcements WHERE id = ?', [id]);
  if (!existing) return res.status(404).send('Announcement not found.');
  await runQuery(
    'UPDATE announcements SET title = ?, content = ?, published = ?, updated_at = datetime("now") WHERE id = ?',
    [title, content, req.body.published ? 1 : 0, id]
  );
  await addAuditLog('announcement_updated', `Announcement updated: ${title}`, 'announcement', id, req.session.user.username);
  res.redirect('/admin/announcements?saved=updated');
});

app.post('/admin/announcements/:id/delete', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).send('Invalid announcement ID.');
  const announcement = await getRow('SELECT title FROM announcements WHERE id = ?', [id]);
  if (!announcement) return res.status(404).send('Announcement not found.');
  await createDatabaseBackup('before-delete');
  await runQuery('DELETE FROM announcements WHERE id = ?', [id]);
  await addAuditLog('announcement_deleted', `Announcement deleted: ${announcement.title}`, 'announcement', id, req.session.user.username);
  res.redirect('/admin/announcements?saved=deleted');
});

app.get('/admin/events', requireAuth, async (req, res) => {
  const settings = await loadSiteSettings();
  const events = await getAllRows('SELECT * FROM events ORDER BY event_date DESC');
  const success = req.query.saved === 'updated' ? 'Event updated.'
    : req.query.saved === 'deleted' ? 'Event deleted.' : null;
  res.render('admin-events', { settings, events, formatDate, success });
});

app.post('/admin/events', requireAuth, async (req, res) => {
  const title = (req.body.title || '').trim();
  const description = (req.body.description || '').trim();
  const location = (req.body.location || '').trim();
  const eventDate = req.body.event_date || '';
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(eventDate) ? new Date(`${eventDate}T00:00:00Z`) : null;
  if (!title || !description || !parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== eventDate) {
    return res.status(400).send('Event title, description, and a valid date are required.');
  }
  const published = req.body.published;
  await runQuery('INSERT INTO events (title, description, location, event_date, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime("now"), datetime("now"))', [title, description, location || null, eventDate, published ? 1 : 0]);
  await addAuditLog('event_created', `Event created: ${title}`, 'event', title, req.session.user.username);
  res.redirect('/admin/events');
});

app.post('/admin/events/:id/edit', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
  const location = typeof req.body.location === 'string' ? req.body.location.trim() : '';
  const eventDate = typeof req.body.event_date === 'string' ? req.body.event_date : '';
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(eventDate) ? new Date(`${eventDate}T00:00:00Z`) : null;
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).send('Invalid event ID.');
  if (!title || !description || !parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== eventDate) {
    return res.status(400).send('Event title, description, and a valid date are required.');
  }
  const existing = await getRow('SELECT id FROM events WHERE id = ?', [id]);
  if (!existing) return res.status(404).send('Event not found.');
  await runQuery(
    'UPDATE events SET title = ?, description = ?, location = ?, event_date = ?, published = ?, updated_at = datetime("now") WHERE id = ?',
    [title, description, location || null, eventDate, req.body.published ? 1 : 0, id]
  );
  await addAuditLog('event_updated', `Event updated: ${title}`, 'event', id, req.session.user.username);
  res.redirect('/admin/events?saved=updated');
});

app.post('/admin/events/:id/delete', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).send('Invalid event ID.');
  const event = await getRow('SELECT title FROM events WHERE id = ?', [id]);
  if (!event) return res.status(404).send('Event not found.');
  await createDatabaseBackup('before-delete');
  await runQuery('DELETE FROM events WHERE id = ?', [id]);
  await addAuditLog('event_deleted', `Event deleted: ${event.title}`, 'event', id, req.session.user.username);
  res.redirect('/admin/events?saved=deleted');
});

app.get('/admin/volunteers', requireAuth, async (req, res) => {
  const volunteers = await getAllRows(`
    SELECT v.*, m.member_id AS member_code, m.status AS member_status, c.status AS card_status
    FROM volunteers v
    LEFT JOIN members m ON m.id = v.member_id
    LEFT JOIN cards c ON c.member_id = m.id
    ORDER BY v.created_at DESC
  `);
  const settings = await loadSiteSettings();
  const notices = {
    approved: 'Volunteer approved. An active member and card were created.',
    rejected: 'Volunteer registration rejected.',
    deactivated: 'Volunteer member and card deactivated.',
    activated: 'Volunteer member and card reactivated.',
    edited: 'Volunteer member profile saved.',
    deleted: 'Volunteer registration deleted. Any issued membership remains in the member directory.'
  };
  const notice = notices[req.query.saved] || '';
  res.render('admin-volunteers', { settings, volunteers, formatDate, notice });
});

app.post('/admin/volunteers/:id/profile', requireAuth, upload.single('member_photo'), async (req, res) => {
  const volunteer = await getRow('SELECT * FROM volunteers WHERE id = ?', [req.params.id]);
  if (!volunteer) {
    if (req.file) await removeUnusedMemberPhoto(`/uploads/${req.file.filename}`);
    return res.status(404).send('Volunteer registration not found.');
  }

  const updated = {
    full_name: (req.body.full_name || '').trim(),
    tamil_name: (req.body.tamil_name || '').trim(),
    phone: (req.body.phone || '').trim(),
    email: (req.body.email || '').trim(),
    district: (req.body.district || '').trim(),
    local_unit: (req.body.local_unit || '').trim(),
    membership_category: (req.body.membership_category || '').trim(),
    address: (req.body.address || '').trim(),
    review_note: typeof req.body.review_note === 'string' ? req.body.review_note.trim() : ''
  };
  if (updated.review_note.length > 1000) {
    if (req.file) await removeUnusedMemberPhoto(`/uploads/${req.file.filename}`);
    return res.status(400).send('Volunteer notes must be 1000 characters or fewer.');
  }
  if (!updated.full_name || !updated.phone || !updated.district || !updated.local_unit || !updated.address || !updated.membership_category) {
    if (req.file) await removeUnusedMemberPhoto(`/uploads/${req.file.filename}`);
    return res.status(400).send('Name, phone, district, local unit, category, and full address are required.');
  }

  const duplicate = await getRow(
    'SELECT id FROM members WHERE id != COALESCE(?, -1) AND (phone = ? OR (? != \'\' AND LOWER(email) = LOWER(?))) LIMIT 1',
    [volunteer.member_id, updated.phone, updated.email, updated.email]
  );
  if (duplicate) {
    if (req.file) await removeUnusedMemberPhoto(`/uploads/${req.file.filename}`);
    return res.status(409).send('Another member already uses this phone number.');
  }

  const newPhotoUrl = req.file
    ? `/uploads/${req.file.filename}`
    : req.body.clear_photo === '1' ? null : volunteer.photo_url;
  if (volunteer.photo_url && volunteer.photo_url !== newPhotoUrl) await createDatabaseBackup('before-delete');
  await runQuery('BEGIN IMMEDIATE TRANSACTION');
  try {
    await runQuery(`
      UPDATE volunteers
      SET full_name = ?, tamil_name = ?, phone = ?, email = ?, district = ?, local_unit = ?,
          membership_category = ?, address = ?, photo_url = ?, review_note = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [
      updated.full_name, updated.tamil_name || null, updated.phone, updated.email || null,
      updated.district, updated.local_unit, updated.membership_category, updated.address,
      newPhotoUrl, updated.review_note || null, volunteer.id
    ]);
    if (volunteer.member_id) {
      await runQuery(`
        UPDATE members
        SET full_name = ?, tamil_name = ?, phone = ?, email = ?, district = ?, local_unit = ?,
            membership_category = ?, address = ?, photo_url = ?, updated_at = datetime('now')
        WHERE id = ?
      `, [
        updated.full_name, updated.tamil_name || null, updated.phone, updated.email || null,
        updated.district, updated.local_unit, updated.membership_category, updated.address,
        newPhotoUrl, volunteer.member_id
      ]);
      await addAuditLog('volunteer_member_profile_updated', `Member profile updated from volunteer registration ${volunteer.ref}`, 'member', volunteer.member_id, req.session.user.username);
    }
    await addAuditLog('volunteer_profile_updated', `Volunteer profile ${volunteer.ref} updated`, 'volunteer', volunteer.ref, req.session.user.username);
    await runQuery('COMMIT');
  } catch (error) {
    await runQuery('ROLLBACK');
    if (req.file) await removeUnusedMemberPhoto(newPhotoUrl);
    throw error;
  }

  if (volunteer.photo_url !== newPhotoUrl) {
    await removeUnusedMemberPhoto(volunteer.photo_url);
  }
  if (volunteer.member_id) await syncMemberCsv();
  res.redirect('/admin/volunteers?saved=edited');
});

app.post('/admin/volunteers/:id/approve', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).send('Invalid volunteer registration ID.');
  if (note.length > 1000) return res.status(400).send('Volunteer notes must be 1000 characters or fewer.');

  await runQuery('BEGIN IMMEDIATE TRANSACTION');
  try {
    const volunteer = await getRow('SELECT * FROM volunteers WHERE id = ?', [id]);
    if (!volunteer) {
      await runQuery('ROLLBACK');
      return res.status(404).send('Volunteer registration not found.');
    }
    if (volunteer.member_id || volunteer.status === 'approved') {
      await runQuery('ROLLBACK');
      return res.status(409).send('This volunteer already has a member profile. Use Reactivate if it is inactive.');
    }
    if (!volunteer.full_name || !volunteer.phone || !volunteer.district || !volunteer.local_unit ||
        !volunteer.membership_category || !volunteer.address) {
      await runQuery('ROLLBACK');
      return res.status(400).send('Complete and save the volunteer member profile before approval.');
    }

    const duplicate = await getRow('SELECT id FROM members WHERE phone = ?', [volunteer.phone]);
    if (duplicate) {
      await runQuery('ROLLBACK');
      return res.status(409).send('This phone number already belongs to a member. Edit the volunteer profile to use the correct number.');
    }

    const memberId = createMemberId();
    const memberInsert = await runQuery(`
      INSERT INTO members (
        member_id, full_name, tamil_name, phone, email, district, local_unit, address,
        photo_url, membership_category, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
    `, [
      memberId, volunteer.full_name, volunteer.tamil_name, volunteer.phone, volunteer.email,
      volunteer.district, volunteer.local_unit, volunteer.address, volunteer.photo_url,
      volunteer.membership_category
    ]);
    await runQuery(
      `INSERT INTO cards (member_id, issue_date, status, generated_by, created_at)
       VALUES (?, date('now'), 'active', ?, datetime('now'))`,
      [memberInsert.id, req.session.user.username]
    );
    await runQuery(
      `UPDATE volunteers SET member_id = ?, status = 'approved', review_note = ?, updated_at = datetime('now') WHERE id = ?`,
      [memberInsert.id, note || volunteer.review_note || null, id]
    );
    await addAuditLog('volunteer_approved', `Volunteer ${volunteer.ref} approved as member ${memberId}${note ? `; note: ${note}` : ''}`, 'volunteer', volunteer.ref, req.session.user.username);
    await addAuditLog('membership_issued_from_volunteer', `Member ${memberId} and card issued from volunteer registration ${volunteer.ref}`, 'member', memberInsert.id, req.session.user.username);
    await runQuery('COMMIT');
  } catch (error) {
    await runQuery('ROLLBACK');
    throw error;
  }

  await syncMemberCsv();
  res.redirect('/admin/volunteers?saved=approved');
});

app.post('/admin/volunteers/:id/reject', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).send('Invalid volunteer registration ID.');
  if (note.length > 1000) return res.status(400).send('Volunteer notes must be 1000 characters or fewer.');

  await runQuery('BEGIN IMMEDIATE TRANSACTION');
  try {
    const volunteer = await getRow('SELECT id, ref, status, member_id FROM volunteers WHERE id = ?', [id]);
    if (!volunteer) {
      await runQuery('ROLLBACK');
      return res.status(404).send('Volunteer registration not found.');
    }
    if (volunteer.member_id) {
      await runQuery('ROLLBACK');
      return res.status(409).send('This volunteer has an issued member card. Deactivate the member instead of rejecting the registration.');
    }
    if (volunteer.status !== 'rejected') {
      await runQuery(
        `UPDATE volunteers
         SET status = 'rejected', review_note = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [note || null, id]
      );
      await addAuditLog(
        'volunteer_rejected',
        `Volunteer ${volunteer.ref} rejected${note ? `; note: ${note}` : ''}`,
        'volunteer',
        volunteer.ref,
        req.session.user.username
      );
    } else if (note && note !== volunteer.review_note) {
      await runQuery(
        `UPDATE volunteers SET review_note = ?, updated_at = datetime('now') WHERE id = ?`,
        [note, id]
      );
      await addAuditLog(
        'volunteer_rejection_note_updated',
        `Rejection note updated for volunteer ${volunteer.ref}`,
        'volunteer',
        volunteer.ref,
        req.session.user.username
      );
    }
    await runQuery('COMMIT');
  } catch (error) {
    await runQuery('ROLLBACK');
    throw error;
  }

  res.redirect('/admin/volunteers?saved=rejected');
});

app.post('/admin/volunteers/:id/status', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const status = req.body.status;
  const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).send('Invalid volunteer registration ID.');
  if (!['active', 'inactive'].includes(status)) return res.status(400).send('Volunteer member status must be active or inactive.');
  if (note.length > 1000) return res.status(400).send('Volunteer notes must be 1000 characters or fewer.');

  await runQuery('BEGIN IMMEDIATE TRANSACTION');
  try {
    const volunteer = await getRow('SELECT * FROM volunteers WHERE id = ?', [id]);
    if (!volunteer) {
      await runQuery('ROLLBACK');
      return res.status(404).send('Volunteer registration not found.');
    }
    if (!volunteer.member_id) {
      await runQuery('ROLLBACK');
      return res.status(409).send('Approve this volunteer before changing member activation status.');
    }
    const member = await getRow('SELECT * FROM members WHERE id = ?', [volunteer.member_id]);
    if (!member) {
      await runQuery('ROLLBACK');
      return res.status(409).send('The member linked to this volunteer registration no longer exists.');
    }

    await runQuery('UPDATE members SET status = ?, updated_at = datetime("now") WHERE id = ?', [status, member.id]);
    const card = await getRow('SELECT id FROM cards WHERE member_id = ?', [member.id]);
    if (card) {
      await runQuery(
        'UPDATE cards SET status = ?, revoked_at = ? WHERE member_id = ?',
        [status === 'active' ? 'active' : 'revoked', status === 'active' ? null : new Date().toISOString(), member.id]
      );
    } else if (status === 'active') {
      await runQuery(
        `INSERT INTO cards (member_id, issue_date, status, generated_by, created_at)
         VALUES (?, date('now'), 'active', ?, datetime('now'))`,
        [member.id, req.session.user.username]
      );
    }
    await runQuery(
      'UPDATE volunteers SET status = ?, updated_at = datetime("now") WHERE id = ?',
      [status === 'active' ? 'approved' : 'inactive', id]
    );
    await addAuditLog(
      status === 'active' ? 'volunteer_member_activated' : 'volunteer_member_deactivated',
      `Volunteer ${volunteer.ref}; member ${member.member_id} ${status}${note ? `; note: ${note}` : ''}`,
      'volunteer',
      volunteer.ref,
      req.session.user.username
    );
    if (note) {
      await runQuery('UPDATE volunteers SET review_note = ? WHERE id = ?', [note, id]);
    }
    await runQuery('COMMIT');
  } catch (error) {
    await runQuery('ROLLBACK');
    throw error;
  }

  await syncMemberCsv();
  res.redirect(`/admin/volunteers?saved=${status === 'active' ? 'activated' : 'deactivated'}`);
});

app.get('/admin/grievances', requireAuth, async (req, res) => {
  const grievances = await getAllRows('SELECT * FROM grievances ORDER BY created_at DESC');
  const settings = await loadSiteSettings();
  const notice = req.query.saved === 'deleted'
    ? 'Grievance deleted.'
    : req.query.saved === 'updated' ? 'Grievance status updated.'
      : req.query.saved === 'edited' ? 'Grievance details saved.' : '';
  res.render('admin-grievances', { settings, grievances, formatDate, notice });
});

app.get('/admin/contacts', requireAuth, async (req, res) => {
  const contacts = await getAllRows('SELECT * FROM contact_requests ORDER BY created_at DESC');
  const settings = await loadSiteSettings();
  const notice = req.query.saved === 'deleted'
    ? 'Contact request deleted.'
    : req.query.saved === 'updated' ? 'Contact request status updated.'
      : req.query.saved === 'edited' ? 'Contact request details saved.' : '';
  res.render('admin-contacts', { settings, contacts, formatDate, notice });
});

async function updatePublicSubmissionStatus(req, res, table, recordType) {
  const id = Number(req.params.id);
  const status = req.body.status;
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).send('Invalid submission ID.');
  if (!['new', 'in_progress', 'resolved'].includes(status)) {
    return res.status(400).send('Status must be new, in progress, or resolved.');
  }

  const submission = await getRow(`SELECT id, ref, status FROM ${table} WHERE id = ?`, [id]);
  if (!submission) return res.status(404).send('Submission not found.');
  if (submission.status !== status) {
    await runQuery(`UPDATE ${table} SET status = ? WHERE id = ?`, [status, id]);
    await addAuditLog(
      `${recordType}_status_updated`,
      `${recordType === 'contact_request' ? 'Contact request' : 'Grievance'} ${submission.ref} status changed from ${submission.status} to ${status}`,
      recordType,
      submission.ref,
      req.session.user.username
    );
  }

  res.redirect(`${recordType === 'contact_request' ? '/admin/contacts' : '/admin/grievances'}?saved=updated`);
}

async function editPublicSubmission(req, res, table, recordType, route) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).send('Invalid submission ID.');
  const submission = await getRow(`SELECT id, ref FROM ${table} WHERE id = ?`, [id]);
  if (!submission) return res.status(404).send('Submission not found.');
  const fullName = typeof req.body.full_name === 'string' ? req.body.full_name.trim() : '';
  const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
  const district = typeof req.body.district === 'string' ? req.body.district.trim() : '';
  const subject = typeof req.body.subject === 'string' ? req.body.subject.trim() : '';
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  if (!fullName || !subject || !message || (recordType === 'grievance' && !phone)) {
    return res.status(400).send('Name, subject, message, and grievance phone are required.');
  }

  if (recordType === 'grievance') {
    await runQuery(
      'UPDATE grievances SET full_name = ?, phone = ?, district = ?, subject = ?, message = ? WHERE id = ?',
      [fullName, phone, district || null, subject, message, id]
    );
  } else {
    await runQuery(
      'UPDATE contact_requests SET full_name = ?, email = ?, phone = ?, subject = ?, message = ? WHERE id = ?',
      [fullName, email || null, phone || null, subject, message, id]
    );
  }
  await addAuditLog(`${recordType}_updated`, `${recordType === 'contact_request' ? 'Contact request' : 'Grievance'} ${submission.ref} details updated`, recordType, submission.ref, req.session.user.username);
  res.redirect(`${route}?saved=edited`);
}

app.post('/admin/grievances/:id/status', requireAuth, async (req, res) => {
  await updatePublicSubmissionStatus(req, res, 'grievances', 'grievance');
});

app.post('/admin/grievances/:id/edit', requireAuth, async (req, res) => {
  await editPublicSubmission(req, res, 'grievances', 'grievance', '/admin/grievances');
});

app.post('/admin/contacts/:id/status', requireAuth, async (req, res) => {
  await updatePublicSubmissionStatus(req, res, 'contact_requests', 'contact_request');
});

app.post('/admin/contacts/:id/edit', requireAuth, async (req, res) => {
  await editPublicSubmission(req, res, 'contact_requests', 'contact_request', '/admin/contacts');
});

async function deletePublicSubmission(req, res, table, recordType, displayName, route) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).send('Invalid submission ID.');

  let submission;
  await createDatabaseBackup('before-delete');
  await runQuery('BEGIN IMMEDIATE TRANSACTION');
  try {
    const fields = recordType === 'volunteer' ? 'id, ref, photo_url' : 'id, ref';
    submission = await getRow(`SELECT ${fields} FROM ${table} WHERE id = ?`, [id]);
    if (!submission) {
      await runQuery('ROLLBACK');
      return res.status(404).send('Submission not found.');
    }

    await runQuery(`DELETE FROM ${table} WHERE id = ?`, [id]);
    await addAuditLog(
      `${recordType}_deleted`,
      `${displayName} ${submission.ref} deleted`,
      recordType,
      submission.ref,
      req.session.user.username
    );
    await runQuery('COMMIT');
  } catch (error) {
    await runQuery('ROLLBACK');
    throw error;
  }

  if (recordType === 'volunteer') await removeUnusedMemberPhoto(submission.photo_url);
  res.redirect(`${route}?saved=deleted`);
}

app.post('/admin/grievances/:id/delete', requireAuth, async (req, res) => {
  await deletePublicSubmission(req, res, 'grievances', 'grievance', 'Grievance', '/admin/grievances');
});

app.post('/admin/contacts/:id/delete', requireAuth, async (req, res) => {
  await deletePublicSubmission(req, res, 'contact_requests', 'contact_request', 'Contact request', '/admin/contacts');
});

app.post('/admin/volunteers/:id/delete', requireAuth, async (req, res) => {
  await deletePublicSubmission(req, res, 'volunteers', 'volunteer', 'Volunteer registration', '/admin/volunteers');
});

app.get('/admin/card/:memberId', requireAuth, async (req, res) => {
  const member = await getRow('SELECT * FROM members WHERE member_id = ?', [req.params.memberId]);
  if (!member) return res.status(404).send('Member not found');

  const settings = await loadSiteSettings();
  const card = await getRow('SELECT * FROM cards WHERE member_id = ?', [member.id]);
  const verifyUrl = `${req.protocol}://${req.get('host')}/verify/${encodeURIComponent(member.member_id)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(verifyUrl)}`;

  res.render('member-card', {
    member,
    card,
    settings,
    qrUrl,
    formatDate
  });
});

app.get('*', async (req, res) => {
  const settings = await loadSiteSettings();
  res.status(404).render('404', { settings });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  console.error('Request failed:', error);
  const isUploadError = error instanceof multer.MulterError || error.message === 'Only JPG, PNG, and WEBP images are allowed.';
  const isBackupUploadError = error.message === 'Backup upload must be a JSON file.';
  const status = isUploadError || isBackupUploadError ? 400 : 500;
  const message = isUploadError || isBackupUploadError ? error.message : 'An unexpected server error occurred.';
  res.status(status).type('text/plain').send(message);
});

async function createScheduledBackupIfDue() {
  const backups = await listDatabaseBackups();
  const mostRecentScheduled = backups.find(backup => backup.filename.startsWith('ptk-daily-') || backup.filename.startsWith('ptk-startup-'));
  if (mostRecentScheduled && Date.now() - mostRecentScheduled.createdAt.getTime() < 24 * 60 * 60 * 1000) return;
  const backup = await createDatabaseBackup(mostRecentScheduled ? 'daily' : 'startup');
  console.log(`Automatic database backup created: ${backup.filename}`);
}

const startup = initDatabase();

startup.then(async () => {
  await syncMemberCsv();
  if (!persistentStorageConfigured) {
    console.warn('Persistent storage is not configured. Production database, backups, uploads, and CSV export may be lost on restart or redeploy; configure DB_PATH=/var/data/ptk.db, BACKUP_DIR=/var/data/backups, UPLOAD_DIR=/var/data/uploads, and MEMBER_CSV_PATH=/var/data/ptk-members.csv on a mounted Render disk.');
  }
  await createScheduledBackupIfDue();
  const backupTimer = setInterval(() => {
    createScheduledBackupIfDue().catch(error => console.error('Automatic database backup failed:', error));
  }, 6 * 60 * 60 * 1000);
  backupTimer.unref();
  app.listen(port, () => {
    console.log(`PTK platform running on http://localhost:${port}`);
  });
}).catch((error) => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

module.exports = app;
