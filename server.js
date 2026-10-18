require('express-async-errors');

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, initDatabase, getSettings, getAllRows, getRow, runQuery, csvEscape, addAuditLog } = require('./db');

const app = express();
const port = process.env.PORT || 3000;
const uploadDirectory = process.env.UPLOAD_DIR || path.join(__dirname, 'public', 'uploads');
const loginAttempts = new Map();
const loginAttemptWindowMs = 15 * 60 * 1000;
const maxLoginAttempts = 5;

let envSessionSecret = process.env.SESSION_SECRET;
if (envSessionSecret && envSessionSecret.length < 32) {
  console.warn('WARNING: SESSION_SECRET is set but shorter than 32 characters — ignoring supplied secret and generating a secure one.');
  envSessionSecret = undefined;
}
const sessionSecret = envSessionSecret || crypto.randomBytes(32).toString('hex');

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

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.json({ limit: '25mb' }));
app.use(session({
  secret: sessionSecret,
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
  res.json({ status: 'ok' });
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
     LIMIT 1`,
    [photoUrl, photoUrl, photoUrl]
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
    formatDate
  });
});

// ... rest of file unchanged (omitted here for brevity)

initDatabase().then(async () => {
  await syncMemberCsv();
  app.listen(port, () => {
    console.log(`PTK platform running on http://localhost:${port}`);
  });
}).catch((error) => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

module.exports = app;
