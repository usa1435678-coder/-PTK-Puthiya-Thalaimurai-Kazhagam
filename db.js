// PTK Digital Platform SQLite database module
// Creates the database and required tables on first run.
// Database location can be overridden with the DB_PATH environment variable.

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const defaultDataDir = path.join(__dirname, 'data');
const databasePath = process.env.DB_PATH || path.join(defaultDataDir, 'ptk.db');
const backupDirectory = process.env.BACKUP_DIR || path.join(path.dirname(databasePath), 'backups');
const uploadDirectory = process.env.UPLOAD_DIR || path.join(__dirname, 'public', 'uploads');

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new sqlite3.Database(databasePath);

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) return reject(error);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function getRow(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) return reject(error);
      resolve(row || null);
    });
  });
}

function getAllRows(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) return reject(error);
      resolve(rows || []);
    });
  });
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

async function copyDirectoryContents(sourceDirectory, destinationDirectory, skipExisting = false) {
  await fs.promises.mkdir(destinationDirectory, { recursive: true, mode: 0o700 });
  let entries;
  try {
    entries = await fs.promises.readdir(sourceDirectory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  for (const entry of entries) {
    const source = path.join(sourceDirectory, entry.name);
    const destination = path.join(destinationDirectory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Refusing to back up symbolic link ${source}`);
    if (entry.isDirectory()) {
      await copyDirectoryContents(source, destination, skipExisting);
    } else if (entry.isFile()) {
      try {
        await fs.promises.copyFile(source, destination, skipExisting ? fs.constants.COPYFILE_EXCL : 0);
      } catch (error) {
        if (!skipExisting || error.code !== 'EEXIST') throw error;
      }
    } else {
      throw new Error(`Refusing to back up unsupported file type ${source}`);
    }
  }
}

async function restoreBackupUploads(filename) {
  if (!/^ptk-(startup|daily|before-restore|before-delete|manual)-.+\.sqlite$/.test(filename)) {
    throw new Error('Invalid database backup filename.');
  }
  const sourceDirectory = path.join(backupDirectory, `${filename}.uploads`);
  await copyDirectoryContents(sourceDirectory, uploadDirectory, true);
}

let activeBackupPromise = null;

async function createDatabaseBackup(reason = 'manual') {
  if (!['startup', 'daily', 'before-restore', 'before-delete', 'manual'].includes(reason)) {
    throw new Error('Unsupported database backup reason.');
  }
  if (activeBackupPromise) return activeBackupPromise;

  activeBackupPromise = (async () => {
    await fs.promises.mkdir(backupDirectory, { recursive: true, mode: 0o700 });
    await fs.promises.chmod(backupDirectory, 0o700);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ptk-${reason}-${timestamp}-${crypto.randomBytes(6).toString('hex')}.sqlite`;
    const destination = path.join(backupDirectory, filename);
    const temporaryDestination = `${destination}.tmp`;
    const uploadSnapshot = path.join(backupDirectory, `${filename}.uploads`);
    const temporaryUploadSnapshot = `${uploadSnapshot}.tmp`;

    try {
      await new Promise((resolve, reject) => {
        const backup = db.backup(temporaryDestination, error => {
          if (error) return reject(error);
          backup.step(-1, stepError => stepError ? reject(stepError) : resolve());
        });
      });
      await copyDirectoryContents(uploadDirectory, temporaryUploadSnapshot);
      await fs.promises.chmod(temporaryDestination, 0o600);
      await fs.promises.rename(temporaryUploadSnapshot, uploadSnapshot);
      await fs.promises.rename(temporaryDestination, destination);
      return { filename, path: destination };
    } catch (error) {
      for (const incompletePath of [temporaryDestination, temporaryUploadSnapshot, uploadSnapshot]) {
        try {
          await fs.promises.rm(incompletePath, { recursive: true, force: true });
        } catch (cleanupError) {
          if (cleanupError.code !== 'ENOENT') {
            console.error('Failed to remove incomplete database backup:', cleanupError);
          }
        }
      }
      throw error;
    }
  })();

  try {
    return await activeBackupPromise;
  } finally {
    activeBackupPromise = null;
  }
}

async function listDatabaseBackups() {
  await fs.promises.mkdir(backupDirectory, { recursive: true, mode: 0o700 });
  await fs.promises.chmod(backupDirectory, 0o700);
  const filenames = await fs.promises.readdir(backupDirectory);
  const backupFiles = filenames.filter(filename => /^ptk-(startup|daily|before-restore|before-delete|manual)-.+\.sqlite$/.test(filename));
  const backups = await Promise.all(backupFiles.map(async filename => {
    const stats = await fs.promises.stat(path.join(backupDirectory, filename));
    return stats.isFile() ? { filename, size: stats.size, createdAt: stats.mtime } : null;
  }));
  return backups.filter(Boolean).sort((left, right) => right.createdAt - left.createdAt);
}

async function addAuditLog(action, details, recordType = 'system', recordId = '', actor = 'system') {
  return runQuery(
    `INSERT INTO audit_logs (actor, action, record_type, record_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [String(actor || 'system'), String(action || ''), String(recordType || ''), String(recordId ?? ''), String(details || '')]
  );
}

async function getSettings() {
  const rows = await getAllRows('SELECT setting_key, setting_value FROM settings');
  return Object.fromEntries(rows.map(row => [row.setting_key, row.setting_value]));
}

async function initDatabase() {
  await runQuery('PRAGMA foreign_keys = ON');
  await runQuery('PRAGMA busy_timeout = 10000');
  await runQuery('PRAGMA synchronous = FULL');
  const journalMode = await getRow('PRAGMA journal_mode = WAL');
  if (!journalMode || String(journalMode.journal_mode).toLowerCase() !== 'wal') {
    throw new Error('SQLite could not enable write-ahead logging for durable database writes.');
  }
  await fs.promises.chmod(databasePath, 0o600);

  const schema = [
    `CREATE TABLE IF NOT EXISTS settings (
      setting_key TEXT PRIMARY KEY, setting_value TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS districts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS membership_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_ref TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      tamil_name TEXT,
      phone TEXT NOT NULL,
      email TEXT,
      district TEXT NOT NULL,
      local_unit TEXT NOT NULL,
      address TEXT,
      photo_url TEXT,
      membership_category TEXT NOT NULL,
      consent INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      review_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      tamil_name TEXT,
      phone TEXT NOT NULL,
      email TEXT,
      district TEXT NOT NULL,
      local_unit TEXT NOT NULL,
      address TEXT,
      photo_url TEXT,
      membership_category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      issue_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      revoked_at TEXT,
      generated_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(member_id) REFERENCES members(id)
    )`,
    `CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      event_date TEXT,
      published INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS volunteers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      district TEXT NOT NULL,
      interest TEXT NOT NULL,
      availability TEXT,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS grievances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      district TEXT,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS contact_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS finance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_type TEXT,
      amount REAL NOT NULL DEFAULT 0,
      description TEXT,
      reference TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT NOT NULL DEFAULT 'system',
      action TEXT NOT NULL,
      record_type TEXT,
      record_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS ptk_sessions (
      sid TEXT PRIMARY KEY,
      session_json TEXT NOT NULL,
      expires INTEGER NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS idx_ptk_sessions_expires ON ptk_sessions (expires)'
  ];

  for (const sql of schema) await runQuery(sql);

  for (const table of ['membership_applications', 'members']) {
    const columns = await getAllRows(`PRAGMA table_info(${table})`);
    if (!columns.some(column => column.name === 'photo_url')) {
      await runQuery(`ALTER TABLE ${table} ADD COLUMN photo_url TEXT`);
    }
  }

  const volunteerColumns = await getAllRows('PRAGMA table_info(volunteers)');
  const volunteerMigrations = [
    ['tamil_name', 'TEXT'],
    ['local_unit', 'TEXT'],
    ['membership_category', 'TEXT'],
    ['address', 'TEXT'],
    ['photo_url', 'TEXT'],
    ['member_id', 'INTEGER'],
    ['review_note', 'TEXT'],
    ['updated_at', 'TEXT']
  ];
  for (const [name, type] of volunteerMigrations) {
    if (!volunteerColumns.some(column => column.name === name)) {
      await runQuery(`ALTER TABLE volunteers ADD COLUMN ${name} ${type}`);
    }
  }

  const defaults = {
    party_name_tamil: 'புதியா தலைமுறை கழகம்',
    party_name_english: 'PTK - Puthiya Thalaimurai Kazhagam',
    tagline: 'மக்களுக்காக, மக்களுடன்',
    leader_name: '',
    leader_title: 'தலைவர்',
    contact_email: '',
    contact_phone: '',
    contact_address: '',
    card_red: '#A8202B',
    card_yellow: '#F2C744',
    card_green: '#16734B',
    logo_url: '/branding/ptk-logo.jpeg',
    leader_photo_url: '/branding/ptk-leader.jpeg',
    flag_url: '/branding/ptk-flag.png',
    signature_url: '/branding/ptk-signature.png',
    hero_background_url: '',
    card_background_url: '',
    about_text: '',
    mission_text: '',
    vision_text: '',
    privacy_policy: '',
    terms: ''
  };

  for (const [key, value] of Object.entries(defaults)) {
    await runQuery(
      'INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)',
      [key, value]
    );
  }

  const districtNames = [
    'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore',
    'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kancheepuram',
    'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam',
    'Kanniyakumari', 'Namakkal', 'Perambalur', 'Pudukkottai', 'Ramanathapuram',
    'Ranipet', 'Salem', 'Sivaganga', 'Tenkasi', 'Thanjavur', 'Theni',
    'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli', 'Tirupathur',
    'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore',
    'Viluppuram', 'Virudhunagar', 'The Nilgiris', 'Tirupattur'
  ];
  for (const name of districtNames) {
    await runQuery('INSERT OR IGNORE INTO districts (name) VALUES (?)', [name]);
  }

  const adminUsername = (process.env.INITIAL_ADMIN_USERNAME || 'admin').trim() || 'admin';
  const existingAdmin = await getRow('SELECT id, password_hash FROM users WHERE username = ?', [adminUsername])
    || await getRow('SELECT id, password_hash FROM users WHERE username = ?', ['admin']);
  const configuredAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  // Documented first-run password. It is only applied when no password is supplied
  // through the environment and the administrator account does not exist yet (or still
  // uses the legacy "admin123" default). Change it from the dashboard after first login.
  const DEFAULT_ADMIN_PASSWORD = 'PTKadmin@2026';
  if (configuredAdminPassword && configuredAdminPassword.length < 12) {
    throw new Error('The initial administrator password (INITIAL_ADMIN_PASSWORD / ADMIN_PASSWORD) must be at least 12 characters long.');
  }
  const forceReset = String(process.env.FORCE_ADMIN_RESET || '').toLowerCase() === 'true';
  const legacyDefault = existingAdmin ? bcrypt.compareSync('admin123', existingAdmin.password_hash) : false;
  // One-time migration marker (v2). The first time this bootstrap runs against a database
  // it resets the administrator password to the documented default so the operator is never
  // locked out by an unknown password left behind by an earlier build. Once the marker
  // exists, later password changes made from the dashboard are preserved.
  const bootstrapMarkerKey = 'admin_password_bootstrap_v2';
  const existingMarker = await getRow('SELECT setting_value FROM settings WHERE setting_key = ?', [bootstrapMarkerKey]);
  const firstBootstrapRun = !existingMarker;
  const shouldApplyPassword = !existingAdmin || forceReset || legacyDefault || firstBootstrapRun;
  if (shouldApplyPassword) {
    // A configured password is honored when creating a brand-new account, when upgrading an
    // account that still uses the legacy default, or on an explicit reset. When migrating an
    // existing account that has an unknown password, the documented default is used instead
    // so the operator can always sign in.
    const useConfigured = !existingAdmin || forceReset || legacyDefault;
    const password = useConfigured ? (configuredAdminPassword || DEFAULT_ADMIN_PASSWORD) : DEFAULT_ADMIN_PASSWORD;
    const passwordHash = bcrypt.hashSync(password, 12);
    if (existingAdmin) {
      await runQuery('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, existingAdmin.id]);
    } else {
      await runQuery(
        'INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, datetime("now"))',
        [adminUsername, passwordHash, 'admin']
      );
    }
    const credentialsPath = path.join(path.dirname(databasePath), 'admin-credentials.txt');
    await fs.promises.writeFile(
      credentialsPath,
      `Username: ${adminUsername}\nPassword: ${password}\nSource: ${useConfigured && configuredAdminPassword ? 'INITIAL_ADMIN_PASSWORD / ADMIN_PASSWORD environment variable' : 'documented first-run default (change it after logging in)'}\n`,
      { mode: 0o600 }
    );
  }
  if (firstBootstrapRun) {
    await runQuery(
      'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value',
      [bootstrapMarkerKey, 'done']
    );
  }

  console.log(`PTK database ready: ${databasePath}`);
}

module.exports = {
  db,
  databasePath,
  backupDirectory,
  uploadDirectory,
  initDatabase,
  createDatabaseBackup,
  listDatabaseBackups,
  restoreBackupUploads,
  getSettings,
  getAllRows,
  getRow,
  runQuery,
  csvEscape,
  addAuditLog
};
