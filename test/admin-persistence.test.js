const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { test } = require('node:test');

const repositoryDirectory = path.resolve(__dirname, '..');
const adminPassword = 'Temporary-Admin-Password-9284';

async function getAvailablePort() {
  const server = http.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

function createEnvironment(dataDirectory, port) {
  return {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(port),
    DB_PATH: path.join(dataDirectory, 'ptk.db'),
    BACKUP_DIR: path.join(dataDirectory, 'backups'),
    UPLOAD_DIR: path.join(dataDirectory, 'uploads'),
    MEMBER_CSV_PATH: path.join(dataDirectory, 'ptk-members.csv'),
    INITIAL_ADMIN_USERNAME: 'admin',
    INITIAL_ADMIN_PASSWORD: adminPassword,
    SESSION_SECRET: 'temporary-integration-test-session-secret-0123456789'
  };
}

async function startServer(environment, port) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: repositoryDirectory,
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });

  const healthUrl = `http://127.0.0.1:${port}/healthz`;
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(`Server exited before becoming healthy:\n${output}`);
      try {
        const response = await fetch(healthUrl);
        if (response.ok) return child;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Server did not become healthy:\n${output}`);
  } catch (error) {
    await stopServer(child);
    throw error;
  }
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  const exited = once(child, 'exit');
  child.kill();
  await exited;
}

async function login(baseUrl) {
  const response = await fetch(`${baseUrl}/admin/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: baseUrl
    },
    body: new URLSearchParams({ username: 'admin', password: adminPassword }),
    redirect: 'manual'
  });
  assert.equal(response.status, 302, 'administrator credentials should authenticate');
  return response.headers.get('set-cookie').split(';')[0];
}

function runDatabaseQuery(databasePath, sql, parameters = []) {
  const sqlite3 = require('sqlite3').verbose();
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(databasePath, error => {
      if (error) return reject(error);
      database.run(sql, parameters, function (queryError) {
        if (queryError) {
          return database.close(() => reject(queryError));
        }
        const result = { changes: this.changes };
        database.close(closeError => closeError ? reject(closeError) : resolve(result));
      });
    });
  });
}

function getDatabaseRow(databasePath, sql, parameters = []) {
  const sqlite3 = require('sqlite3').verbose();
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(databasePath, error => {
      if (error) return reject(error);
      database.get(sql, parameters, (queryError, row) => {
        if (queryError) {
          return database.close(() => reject(queryError));
        }
        database.close(closeError => closeError ? reject(closeError) : resolve(row));
      });
    });
  });
}

test('admin branding persists in SQLite across restart and production requires mounted storage', async () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ptk-admin-persistence-'));
  const dataDirectory = path.join(temporaryDirectory, 'data');
  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const environment = createEnvironment(dataDirectory, port);
  let child;

  try {
    child = await startServer(environment, port);
    const cookie = await login(baseUrl);

    const brandingPage = await fetch(`${baseUrl}/admin/branding`, { headers: { cookie } });
    assert.equal(brandingPage.status, 200, 'branding settings require an authenticated administrator');
    const brandingHtml = await brandingPage.text();
    assert.equal((brandingHtml.match(/<form\b/g) || []).length, 1, 'branding controls must be inside one valid form');
    assert.match(brandingHtml, /formaction="\/admin\/branding\/default\/logo"/);
    assert.match(brandingHtml, /formaction="\/admin\/branding\/default\/leader"/);
    assert.match(brandingHtml, /formaction="\/admin\/branding\/default\/flag"/);
    assert.match(brandingHtml, /formaction="\/admin\/branding\/default\/signature"/);

    const clearLogoResponse = await fetch(`${baseUrl}/admin/branding`, {
      method: 'POST',
      headers: {
        cookie,
        origin: baseUrl,
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ clear_logo_url: '1' }),
      redirect: 'manual'
    });
    assert.equal(clearLogoResponse.status, 302, 'branding checkbox changes should save');

    const defaultResponse = await fetch(`${baseUrl}/admin/branding/default/logo`, {
      method: 'POST',
      headers: { cookie, origin: baseUrl },
      redirect: 'manual'
    });
    assert.equal(defaultResponse.status, 302, 'built-in logo restore action should submit successfully');
    const restoredBranding = await fetch(`${baseUrl}/admin/branding`, { headers: { cookie } });
    assert.match(await restoredBranding.text(), /src="\/branding\/ptk-logo\.jpeg"/, 'restore action should select the built-in logo');

    const saveResponse = await fetch(`${baseUrl}/admin/branding`, {
      method: 'POST',
      headers: {
        cookie,
        origin: baseUrl,
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        party_name_english: 'Persistent Integration Test PTK',
        tagline: 'Database round trip',
        card_red: '#112233'
      }),
      redirect: 'manual'
    });
    assert.equal(saveResponse.status, 302, 'branding settings should save');

    await runDatabaseQuery(environment.DB_PATH, `
      CREATE TRIGGER fail_branding_audit
      BEFORE INSERT ON audit_logs
      WHEN NEW.action = 'branding_updated'
      BEGIN
        SELECT RAISE(ABORT, 'intentional integration test failure');
      END
    `);
    const failedSave = new FormData();
    failedSave.append('party_name_english', 'Must Roll Back');
    failedSave.append('logo_file', new Blob(['temporary failed upload'], { type: 'image/png' }), 'logo.png');
    const failedSaveResponse = await fetch(`${baseUrl}/admin/branding`, {
      method: 'POST',
      headers: { cookie, origin: baseUrl },
      body: failedSave,
      redirect: 'manual'
    });
    assert.equal(failedSaveResponse.status, 500, 'a failed audit write should fail the branding save');
    await runDatabaseQuery(environment.DB_PATH, 'DROP TRIGGER fail_branding_audit');
    const persistedName = await getDatabaseRow(
      environment.DB_PATH,
      "SELECT setting_value FROM settings WHERE setting_key = 'party_name_english'"
    );
    assert.equal(persistedName.setting_value, 'Persistent Integration Test PTK', 'failed settings writes should roll back');
    assert.deepEqual(fs.readdirSync(environment.UPLOAD_DIR), [], 'uploaded files from failed saves should be removed');

    const publicPage = await fetch(baseUrl);
    assert.match(await publicPage.text(), /Persistent Integration Test PTK/, 'public homepage should show saved branding');
    await stopServer(child);
    child = null;

    child = await startServer(environment, port);
    const restartedBranding = await fetch(`${baseUrl}/admin/branding`, { headers: { cookie } });
    assert.equal(restartedBranding.status, 200, 'database-backed admin session should remain valid after restart');
    assert.match(await restartedBranding.text(), /Persistent Integration Test PTK/, 'branding settings should persist after restart');
    const health = await fetch(`${baseUrl}/healthz`);
    assert.equal(health.status, 200);

    const productionEnvironment = {
      ...environment,
      NODE_ENV: 'production',
      PERSISTENT_STORAGE_ROOT: path.join(temporaryDirectory, 'unmounted-disk')
    };
    const productionStart = spawnSync(process.execPath, ['server.js'], {
      cwd: repositoryDirectory,
      env: productionEnvironment,
      encoding: 'utf8',
      timeout: 10000
    });
    assert.notEqual(productionStart.status, 0, 'production must refuse to start without an actual mounted disk');
    assert.match(
      productionStart.stderr,
      /Refusing to start in production without a mounted persistent disk/,
      'production failure should explain the storage requirement'
    );
  } finally {
    await stopServer(child);
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
