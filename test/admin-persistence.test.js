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

async function postForm(baseUrl, route, cookie, values) {
  return fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: {
      cookie,
      origin: baseUrl,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(values),
    redirect: 'manual'
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

    const successfulUpload = new FormData();
    successfulUpload.append('party_name_english', 'Persistent Integration Test PTK');
    successfulUpload.append('logo_file', new Blob(['persistent branding image'], { type: 'image/png' }), 'logo.png');
    const uploadResponse = await fetch(`${baseUrl}/admin/branding`, {
      method: 'POST',
      headers: { cookie, origin: baseUrl },
      body: successfulUpload,
      redirect: 'manual'
    });
    assert.equal(uploadResponse.status, 302, 'branding image upload should save');
    const savedLogo = await getDatabaseRow(
      environment.DB_PATH,
      "SELECT setting_value FROM settings WHERE setting_key = 'logo_url'"
    );
    assert.match(savedLogo.setting_value, /^\/uploads\/[a-f0-9]+\.png$/);
    const imageResponse = await fetch(`${baseUrl}${savedLogo.setting_value}`);
    assert.equal(imageResponse.status, 200, 'saved branding upload should be served publicly');
    assert.equal(await imageResponse.text(), 'persistent branding image');

    const contentResponse = await fetch(`${baseUrl}/admin/content`, {
      method: 'POST',
      headers: {
        cookie,
        origin: baseUrl,
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        about_text: 'Persistent public about content',
        mission_text: 'Persistent mission',
        vision_text: 'Persistent vision',
        privacy_policy: 'Published privacy policy from admin',
        terms: 'Published terms from admin',
        contact_address: 'Persistent contact address',
        contact_phone: '5551234',
        contact_email: 'admin@example.test',
        hero_welcome_text: 'Admin-controlled welcome',
        about_heading: 'A future shaped by members',
        principle_people_text: 'Every public principle is now admin-editable.',
        join_volunteer_text: 'Volunteer copy saved from the dashboard.'
      }),
      redirect: 'manual'
    });
    assert.equal(contentResponse.status, 302, 'admin-managed public content should save');
    const publicPrivacy = await fetch(`${baseUrl}/privacy`);
    assert.match(await publicPrivacy.text(), /Published privacy policy from admin/, 'saved policy should appear publicly');

    const membershipCreate = await fetch(`${baseUrl}/membership`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        full_name: 'Integration Applicant',
        tamil_name: 'Test Applicant',
        phone: '55590004',
        email: 'applicant-integration@example.test',
        district: 'Chennai',
        local_unit: 'South',
        address: '2 Applicant Road, Chennai',
        membership_category: 'General Member',
        consent: 'on'
      })
    });
    assert.equal(membershipCreate.status, 200);
    const application = await getDatabaseRow(
      environment.DB_PATH,
      'SELECT id, application_ref FROM membership_applications WHERE phone = ?',
      ['55590004']
    );
    assert(application, 'public membership application should be stored');
    assert.equal(
      (await postForm(baseUrl, `/admin/application/${application.id}/edit`, cookie, {
        full_name: 'Edited Integration Applicant',
        tamil_name: 'Edited Applicant',
        phone: '55590004',
        email: 'applicant-integration@example.test',
        district: 'Chennai',
        local_unit: 'North',
        address: 'Updated Applicant Road, Chennai',
        membership_category: 'Youth Member'
      })).status,
      302,
      'administrator should be able to edit a pending application'
    );
    assert.equal(
      (await postForm(baseUrl, `/admin/application/${application.id}/status`, cookie, {
        status: 'approved',
        note: 'Approved by integration test',
        return_to: 'members'
      })).status,
      302,
      'administrator should be able to approve an application'
    );
    const applicationStatus = await getDatabaseRow(
      environment.DB_PATH,
      'SELECT status FROM membership_applications WHERE id = ?',
      [application.id]
    );
    assert.equal(applicationStatus.status, 'approved');
    const applicantMember = await getDatabaseRow(
      environment.DB_PATH,
      'SELECT id, member_id, full_name, local_unit, membership_category FROM members WHERE phone = ?',
      ['55590004']
    );
    assert.equal(applicantMember.full_name, 'Edited Integration Applicant');
    assert.equal(applicantMember.local_unit, 'North');
    assert.equal(applicantMember.membership_category, 'Youth Member');
    assert(
      await getDatabaseRow(environment.DB_PATH, 'SELECT id FROM cards WHERE member_id = ?', [applicantMember.id]),
      'approving an application should issue a member card'
    );
    assert.equal(
      (await postForm(baseUrl, `/admin/members/${applicantMember.id}/edit`, cookie, {
        full_name: 'Admin Edited Member',
        tamil_name: 'Admin Edited Tamil Name',
        phone: '55590004',
        email: 'applicant-integration@example.test',
        district: 'Chennai',
        local_unit: 'West',
        address: 'Admin Edited Member Road, Chennai',
        membership_category: 'General Member'
      })).status,
      302,
      'administrator should be able to edit issued member details'
    );

    const announcementCreate = await postForm(baseUrl, '/admin/announcements', cookie, {
      title: 'Persistent public announcement',
      content: 'Announcement content survives restart.',
      published: '1'
    });
    assert.equal(announcementCreate.status, 302);
    const announcement = await getDatabaseRow(
      environment.DB_PATH,
      'SELECT id FROM announcements WHERE title = ?',
      ['Persistent public announcement']
    );
    assert(announcement, 'admin announcement should be written to SQLite');
    const announcementEdit = await postForm(baseUrl, `/admin/announcements/${announcement.id}/edit`, cookie, {
      title: 'Edited public announcement',
      content: 'Edited announcement content survives restart.',
      published: '1'
    });
    assert.equal(announcementEdit.status, 302);
    const announcementDeleteFixture = await postForm(baseUrl, '/admin/announcements', cookie, {
      title: 'Delete announcement fixture',
      content: 'This fixture should be deleted.'
    });
    assert.equal(announcementDeleteFixture.status, 302);
    const announcementToDelete = await getDatabaseRow(
      environment.DB_PATH,
      'SELECT id FROM announcements WHERE title = ?',
      ['Delete announcement fixture']
    );
    const announcementDelete = await postForm(
      baseUrl,
      `/admin/announcements/${announcementToDelete.id}/delete`,
      cookie,
      {}
    );
    assert.equal(announcementDelete.status, 302);
    assert.equal(
      await getDatabaseRow(environment.DB_PATH, 'SELECT id FROM announcements WHERE id = ?', [announcementToDelete.id]),
      undefined,
      'admin announcement delete should persist'
    );

    const eventCreate = await postForm(baseUrl, '/admin/events', cookie, {
      title: 'Persistent public event',
      description: 'Event description survives restart.',
      location: 'Test hall',
      event_date: '2098-05-12',
      published: '1'
    });
    assert.equal(eventCreate.status, 302);
    const event = await getDatabaseRow(
      environment.DB_PATH,
      'SELECT id FROM events WHERE title = ?',
      ['Persistent public event']
    );
    assert(event, 'admin event should be written to SQLite');
    const eventEdit = await postForm(baseUrl, `/admin/events/${event.id}/edit`, cookie, {
      title: 'Edited public event',
      description: 'Edited event description survives restart.',
      location: 'Updated test hall',
      event_date: '2098-06-14',
      published: '1'
    });
    assert.equal(eventEdit.status, 302);
    const eventDeleteFixture = await postForm(baseUrl, '/admin/events', cookie, {
      title: 'Delete event fixture',
      description: 'This fixture should be deleted.',
      event_date: '2098-07-01'
    });
    assert.equal(eventDeleteFixture.status, 302);
    const eventToDelete = await getDatabaseRow(
      environment.DB_PATH,
      'SELECT id FROM events WHERE title = ?',
      ['Delete event fixture']
    );
    const eventDelete = await postForm(baseUrl, `/admin/events/${eventToDelete.id}/delete`, cookie, {});
    assert.equal(eventDelete.status, 302);
    assert.equal(
      await getDatabaseRow(environment.DB_PATH, 'SELECT id FROM events WHERE id = ?', [eventToDelete.id]),
      undefined,
      'admin event delete should persist'
    );

    const grievanceCreate = await fetch(`${baseUrl}/grievance`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        full_name: 'Integration Grievance User',
        phone: '55590001',
        district: 'Chennai',
        subject: 'Original grievance subject',
        message: 'Original grievance message'
      })
    });
    assert.equal(grievanceCreate.status, 200);
    const grievance = await getDatabaseRow(
      environment.DB_PATH,
      'SELECT id FROM grievances WHERE phone = ?',
      ['55590001']
    );
    assert(grievance, 'public grievance submission should be stored');
    assert.equal(
      (await postForm(baseUrl, `/admin/grievances/${grievance.id}/status`, cookie, { status: 'in_progress' })).status,
      302
    );
    assert.equal(
      (await postForm(baseUrl, `/admin/grievances/${grievance.id}/edit`, cookie, {
        full_name: 'Edited Grievance User',
        phone: '55590001',
        district: 'Chennai',
        subject: 'Edited grievance subject',
        message: 'Edited grievance message'
      })).status,
      302
    );

    const contactCreate = await fetch(`${baseUrl}/contact`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        full_name: 'Integration Contact User',
        email: 'contact-integration@example.test',
        phone: '55590002',
        subject: 'Original contact subject',
        message: 'Original contact message'
      })
    });
    assert.equal(contactCreate.status, 200);
    const contact = await getDatabaseRow(
      environment.DB_PATH,
      'SELECT id FROM contact_requests WHERE email = ?',
      ['contact-integration@example.test']
    );
    assert(contact, 'public contact submission should be stored');
    assert.equal(
      (await postForm(baseUrl, `/admin/contacts/${contact.id}/status`, cookie, { status: 'resolved' })).status,
      302
    );
    assert.equal(
      (await postForm(baseUrl, `/admin/contacts/${contact.id}/edit`, cookie, {
        full_name: 'Edited Contact User',
        email: 'contact-integration@example.test',
        phone: '55590002',
        subject: 'Edited contact subject',
        message: 'Edited contact message'
      })).status,
      302
    );

    const volunteerCreate = await fetch(`${baseUrl}/volunteer`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        full_name: 'Integration Volunteer User',
        phone: '55590003',
        email: 'volunteer-integration@example.test',
        district: 'Chennai',
        interest: 'Community organizing',
        availability: 'Weekends'
      })
    });
    assert.equal(volunteerCreate.status, 200);
    const volunteer = await getDatabaseRow(
      environment.DB_PATH,
      'SELECT id FROM volunteers WHERE phone = ?',
      ['55590003']
    );
    assert(volunteer, 'public volunteer registration should be stored');
    assert.equal(
      (await postForm(baseUrl, `/admin/volunteers/${volunteer.id}/profile`, cookie, {
        full_name: 'Integration Volunteer User',
        phone: '55590003',
        email: 'volunteer-integration@example.test',
        district: 'Chennai',
        local_unit: 'Central',
        membership_category: 'Volunteer',
        address: '1 Test Road, Chennai',
        review_note: 'Profile completed by integration test'
      })).status,
      302
    );
    assert.equal(
      (await postForm(baseUrl, `/admin/volunteers/${volunteer.id}/approve`, cookie, {
        note: 'Approved by integration test'
      })).status,
      302
    );
    const volunteerMember = await getDatabaseRow(
      environment.DB_PATH,
      'SELECT id, member_id, status FROM volunteers WHERE id = ?',
      [volunteer.id]
    );
    assert.equal(volunteerMember.status, 'approved');
    const volunteerMemberId = volunteerMember.member_id;
    const member = await getDatabaseRow(environment.DB_PATH, 'SELECT id, member_id FROM members WHERE id = ?', [volunteerMemberId]);
    assert(member, 'approving a volunteer should create the linked permanent member');
    assert(await getDatabaseRow(environment.DB_PATH, 'SELECT id FROM cards WHERE member_id = ?', [member.id]), 'approval should issue a member card');
    assert.equal(
      (await postForm(baseUrl, `/admin/members/${member.id}/status`, cookie, { status: 'inactive' })).status,
      302
    );
    assert.equal(
      (await getDatabaseRow(environment.DB_PATH, 'SELECT status FROM members WHERE id = ?', [member.id])).status,
      'inactive',
      'admin member deactivation should persist'
    );
    assert.equal(
      (await getDatabaseRow(environment.DB_PATH, 'SELECT status FROM cards WHERE member_id = ?', [member.id])).status,
      'revoked',
      'member deactivation should revoke its card'
    );
    assert.equal(
      (await postForm(baseUrl, `/admin/members/${member.id}/status`, cookie, { status: 'active' })).status,
      302
    );

    const backupResponse = await postForm(baseUrl, '/admin/automatic-backups/create', cookie, {});
    assert.equal(backupResponse.status, 302, 'administrator should be able to create a full database backup');
    const manualBackups = fs.readdirSync(environment.BACKUP_DIR)
      .filter(filename => /^ptk-manual-.+\.sqlite$/.test(filename));
    assert(manualBackups.length > 0, 'manual backup should be saved in configured backup storage');
    const manualBackup = manualBackups.sort().at(-1);
    assert(fs.statSync(path.join(environment.BACKUP_DIR, `${manualBackup}.uploads`)).isDirectory());

    const publicPage = await fetch(baseUrl);
    const publicHtml = await publicPage.text();
    assert.match(publicHtml, /Persistent Integration Test PTK/, 'public homepage should show saved branding');
    assert.match(publicHtml, /Persistent public about content/, 'public homepage should show saved website content');
    assert.match(publicHtml, /Admin-controlled welcome/, 'admin should be able to change public hero copy');
    assert.match(publicHtml, /A future shaped by members/, 'admin should be able to change public section headings');
    assert.match(publicHtml, /Every public principle is now admin-editable\./, 'admin should be able to change public principle descriptions');
    assert.match(publicHtml, /Volunteer copy saved from the dashboard\./, 'admin should be able to change public involvement copy');
    assert.match(publicHtml, /Edited public announcement/, 'published announcement edits should appear publicly');
    assert.match(publicHtml, /Edited public event/, 'published event edits should appear publicly');
    await stopServer(child);
    child = null;

    child = await startServer(environment, port);
    const restartedBranding = await fetch(`${baseUrl}/admin/branding`, { headers: { cookie } });
    assert.equal(restartedBranding.status, 200, 'database-backed admin session should remain valid after restart');
    assert.match(await restartedBranding.text(), /Persistent Integration Test PTK/, 'branding settings should persist after restart');
    const restartedContent = await fetch(`${baseUrl}/admin/content`, { headers: { cookie } });
    assert.match(await restartedContent.text(), /Admin-controlled welcome/, 'admin-editable homepage copy should load after restart');
    const restartedPrivacy = await fetch(`${baseUrl}/privacy`);
    assert.match(await restartedPrivacy.text(), /Published privacy policy from admin/, 'public content should persist after restart');
    const restartedPublicPage = await fetch(baseUrl);
    const restartedPublicHtml = await restartedPublicPage.text();
    assert.match(restartedPublicHtml, /Edited public announcement/, 'edited published announcement should persist after restart');
    assert.match(restartedPublicHtml, /Edited public event/, 'edited published event should persist after restart');
    assert.match(restartedPublicHtml, /Admin-controlled welcome/, 'custom homepage copy should persist after restart');
    assert.match(restartedPublicHtml, /Every public principle is now admin-editable\./, 'custom principles should persist after restart');
    assert.equal(
      (await getDatabaseRow(environment.DB_PATH, 'SELECT status, subject FROM grievances WHERE id = ?', [grievance.id])).subject,
      'Edited grievance subject',
      'admin-edited grievance should persist after restart'
    );
    assert.equal(
      (await getDatabaseRow(environment.DB_PATH, 'SELECT status, subject FROM contact_requests WHERE id = ?', [contact.id])).status,
      'resolved',
      'admin contact status should persist after restart'
    );
    assert.equal(
      (await getDatabaseRow(environment.DB_PATH, 'SELECT status FROM volunteers WHERE id = ?', [volunteer.id])).status,
      'approved',
      'approved volunteer should persist after restart'
    );
    assert.equal(
      (await getDatabaseRow(environment.DB_PATH, 'SELECT status FROM members WHERE id = ?', [member.id])).status,
      'active',
      'member activation should persist after restart'
    );
    assert.equal(
      (await getDatabaseRow(environment.DB_PATH, 'SELECT full_name, local_unit FROM members WHERE id = ?', [applicantMember.id])).full_name,
      'Admin Edited Member',
      'admin-edited membership applicant profile should persist after restart'
    );
    assert.equal(
      (await getDatabaseRow(environment.DB_PATH, 'SELECT status FROM membership_applications WHERE id = ?', [application.id])).status,
      'approved',
      'application review status should persist after restart'
    );

    await runDatabaseQuery(
      environment.DB_PATH,
      "UPDATE settings SET setting_value = 'Unsaved test mutation' WHERE setting_key = 'party_name_english'"
    );
    const restoreResponse = await postForm(
      baseUrl,
      `/admin/automatic-backups/${encodeURIComponent(manualBackup)}/restore`,
      cookie,
      {}
    );
    assert.equal(restoreResponse.status, 302, 'administrator should be able to restore a full database snapshot');
    assert.equal(
      (await getDatabaseRow(environment.DB_PATH, 'SELECT setting_value FROM settings WHERE setting_key = ?', ['party_name_english'])).setting_value,
      'Persistent Integration Test PTK',
      'full snapshot restore should restore saved settings'
    );
    assert.equal(
      (await getDatabaseRow(environment.DB_PATH, 'SELECT title FROM announcements WHERE title = ?', ['Edited public announcement'])).title,
      'Edited public announcement',
      'full snapshot restore should restore public announcements'
    );

    const memberDelete = await postForm(baseUrl, `/admin/members/${applicantMember.id}/delete`, cookie, {});
    assert.equal(memberDelete.status, 302, 'admin should be able to delete an issued member');
    assert.equal(
      await getDatabaseRow(environment.DB_PATH, 'SELECT id FROM members WHERE id = ?', [applicantMember.id]),
      undefined,
      'member deletion should persist'
    );
    assert.equal(
      await getDatabaseRow(environment.DB_PATH, 'SELECT id FROM cards WHERE member_id = ?', [applicantMember.id]),
      undefined,
      'member deletion should remove its card'
    );
    assert.equal(
      await getDatabaseRow(environment.DB_PATH, 'SELECT id FROM membership_applications WHERE id = ?', [application.id]),
      undefined,
      'member deletion should remove its linked approved application'
    );

    const pendingApplicationResponse = await fetch(`${baseUrl}/membership`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        full_name: 'Application Delete Fixture',
        phone: '55590005',
        district: 'Chennai',
        local_unit: 'East',
        address: '3 Delete Road, Chennai',
        membership_category: 'General Member',
        consent: 'on'
      })
    });
    assert.equal(pendingApplicationResponse.status, 200);
    const pendingApplication = await getDatabaseRow(
      environment.DB_PATH,
      'SELECT id FROM membership_applications WHERE phone = ?',
      ['55590005']
    );
    const applicationDelete = await postForm(
      baseUrl,
      `/admin/application/${pendingApplication.id}/delete`,
      cookie,
      {}
    );
    assert.equal(applicationDelete.status, 302, 'admin should be able to delete a pending application');
    assert.equal(
      await getDatabaseRow(environment.DB_PATH, 'SELECT id FROM membership_applications WHERE id = ?', [pendingApplication.id]),
      undefined,
      'application deletion should persist'
    );

    for (const [route, table, recordId] of [
      [`/admin/grievances/${grievance.id}/delete`, 'grievances', grievance.id],
      [`/admin/contacts/${contact.id}/delete`, 'contact_requests', contact.id],
      [`/admin/volunteers/${volunteer.id}/delete`, 'volunteers', volunteer.id]
    ]) {
      const deletion = await postForm(baseUrl, route, cookie, {});
      assert.equal(deletion.status, 302, `admin should be able to delete the ${table} fixture`);
      assert.equal(
        await getDatabaseRow(environment.DB_PATH, `SELECT id FROM ${table} WHERE id = ?`, [recordId]),
        undefined,
        `${table} deletion should persist`
      );
    }

    const restartedImage = await fetch(`${baseUrl}${savedLogo.setting_value}`);
    assert.equal(restartedImage.status, 200, 'branding image should persist and remain served after restart');
    assert.equal(await restartedImage.text(), 'persistent branding image');
    const health = await fetch(`${baseUrl}/healthz`);
    assert.equal(health.status, 200);

    const passwordChange = await postForm(baseUrl, '/admin/settings/password', cookie, {
      current_password: adminPassword,
      new_password: 'Updated-Integration-Admin-Password-4831',
      confirm_password: 'Updated-Integration-Admin-Password-4831'
    });
    assert.equal(passwordChange.status, 302, 'administrator password change should save');
    const newPasswordLogin = await fetch(`${baseUrl}/admin/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: baseUrl
      },
      body: new URLSearchParams({
        username: 'admin',
        password: 'Updated-Integration-Admin-Password-4831'
      }),
      redirect: 'manual'
    });
    assert.equal(newPasswordLogin.status, 302, 'updated admin password should authenticate immediately');

    await stopServer(child);
    child = null;
    child = await startServer(environment, port);
    const loginAfterPasswordChange = await fetch(`${baseUrl}/admin/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: baseUrl
      },
      body: new URLSearchParams({
        username: 'admin',
        password: 'Updated-Integration-Admin-Password-4831'
      }),
      redirect: 'manual'
    });
    assert.equal(loginAfterPasswordChange.status, 302, 'changed admin password should persist across restart');

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
