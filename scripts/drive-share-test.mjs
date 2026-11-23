#!/usr/bin/env node
// Shared-album test for Google Drive, run on a computer (no phone build needed).
//
// Answers one question: if account A's copy of Memora makes a folder and invites
// account B as an editor, can B's copy of Memora find the folder and add a photo?
// It tries the narrow `drive.file` permission first, then full `drive`.
//
// Needs a Google Cloud "Desktop app" OAuth client (its downloaded JSON file), the
// Drive API enabled, and both accounts listed as test users.
//
//   node scripts/drive-share-test.mjs <path-to-client.json> [--scope=file|full|both]
//
// Each run opens your browser to sign in, twice per scope: first account A (the
// album owner), then account B (the friend). Use two different Google accounts.
// Everything it creates is cleaned up at the end. No invite emails are sent.

import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const SCOPES = {
  file: 'https://www.googleapis.com/auth/drive.file',
  full: 'https://www.googleapis.com/auth/drive',
};
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name';
// A 1x1 cream-coloured PNG, so the "photo" upload is a real image.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4+uX7fwAJdQPekQxc8gAAAABJRU5ErkJggg==',
  'base64',
);

// ---------- setup ----------

const [, , clientPath, ...flags] = process.argv;
if (!clientPath) {
  console.log('Usage: node scripts/drive-share-test.mjs <path-to-client.json> [--scope=file|full|both]');
  process.exit(1);
}
const json = JSON.parse(readFileSync(clientPath, 'utf8'));
const client = json.installed ?? json.web;
if (!client?.client_id) {
  console.log('That file has no client_id. Download the JSON of a "Desktop app" client.');
  process.exit(1);
}
const scopeFlag = (flags.find((f) => f.startsWith('--scope=')) ?? '--scope=both').split('=')[1];
const runs = scopeFlag === 'both' ? ['file', 'full'] : [scopeFlag];

// ---------- Google sign-in (loopback + PKCE, the flow for desktop apps) ----------

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '""', url.replace(/&/g, '^&')] : [url];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
}

async function signIn(scope, who) {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(8).toString('hex');

  const { code, redirectUri } = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (u.pathname !== '/') return res.writeHead(404).end();
      const err = u.searchParams.get('error');
      const ok = !err && u.searchParams.get('state') === state && u.searchParams.get('code');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        `<p style="font:16px system-ui;margin:40px">${ok ? 'Signed in. You can close this tab and go back to the terminal.' : `Sign-in failed: ${err ?? 'unknown'}`}</p>`,
      );
      server.close();
      if (ok) resolve({ code: u.searchParams.get('code'), redirectUri });
      else reject(new Error(`Sign-in failed: ${err ?? 'state mismatch'}`));
    });
    let redirectUri = '';
    server.listen(0, '127.0.0.1', () => {
      redirectUri = `http://127.0.0.1:${server.address().port}`;
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.search = new URLSearchParams({
        client_id: client.client_id,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: `openid email ${scope}`,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
        prompt: 'select_account consent',
      }).toString();
      console.log(`\n→ Sign in as ${who} in the browser window that just opened.`);
      console.log(`  (If nothing opened, paste this into your browser:)\n  ${url}\n`);
      openBrowser(url.toString());
    });
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: client.client_id,
      client_secret: client.client_secret ?? '',
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });
  const tok = await res.json();
  if (!res.ok) throw new Error(`Token exchange failed: ${JSON.stringify(tok)}`);
  if (!tok.scope?.split(' ').includes(scope)) {
    throw new Error(`Google didn't grant ${scope}. Tick the Drive box on the consent screen, and check the scope is added under Data Access.`);
  }
  const me = await call(tok.access_token, 'GET', `${API}/about?fields=user(emailAddress,displayName)`);
  console.log(`  ✓ signed in as ${me.user.emailAddress}`);
  return { token: tok.access_token, email: me.user.emailAddress.toLowerCase(), name: me.user.displayName };
}

// ---------- Drive helpers ----------

async function call(token, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const e = new Error(data.error?.message ?? `${res.status}`);
    e.status = res.status;
    throw e;
  }
  return data;
}

async function upload(token, folderId, name) {
  const boundary = `memora${randomBytes(6).toString('hex')}`;
  const meta = JSON.stringify({ name, parents: [folderId], mimeType: 'image/png' });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: image/png\r\n\r\n`),
    PNG,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await fetch(UPLOAD, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    const e = new Error(data.error?.message ?? `${res.status}`);
    e.status = res.status;
    throw e;
  }
  return data;
}

const q = (s) => encodeURIComponent(s);

/** Retries fn every 5 s until it succeeds or the time runs out. */
async function poll(fn, ms = 90_000) {
  const end = Date.now() + ms;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      if (Date.now() > end) throw e;
      process.stdout.write('  … waiting for Drive search to catch up\r');
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

/** Runs one check, records pass/fail, never stops the whole test. */
async function check(results, label, fn) {
  try {
    const detail = await fn();
    results.push({ label, ok: true, detail });
    console.log(`  ✓ ${label}${detail ? ` (${detail})` : ''}`);
    return true;
  } catch (e) {
    results.push({ label, ok: false, detail: e.message });
    console.log(`  ✗ ${label}: ${e.message}`);
    return false;
  }
}

// ---------- the test ----------

async function runScope(kind) {
  const scope = SCOPES[kind];
  console.log(`\n================ Testing ${kind === 'file' ? 'drive.file (narrow)' : 'drive (full)'} ================`);
  const A = await signIn(scope, 'account A (the album owner)');
  const B = await signIn(scope, 'account B (the friend, a DIFFERENT account)');
  if (A.email === B.email) throw new Error('A and B are the same account. Run again and pick two different accounts.');

  const results = [];
  let folder;
  let bFile;

  await check(results, 'A creates the album folder', async () => {
    folder = await call(A.token, 'POST', `${API}/files?fields=id,name`, {
      name: `Memora test album (${kind}) ${new Date().toISOString().slice(0, 16)}`,
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: { memoraAlbum: '1' },
    });
    return folder.name;
  });
  if (!folder) return { kind, results };

  await check(results, 'A adds a photo', async () => (await upload(A.token, folder.id, 'from-A.png')).name);

  await check(results, `A invites B (${B.email}) as editor`, async () => {
    await call(A.token, 'POST', `${API}/files/${folder.id}/permissions?sendNotificationEmail=false`, {
      type: 'user',
      role: 'writer',
      emailAddress: B.email,
    });
  });

  await check(results, 'B opens the album folder by its ID (invite link)', async () => {
    const f = await call(B.token, 'GET', `${API}/files/${folder.id}?fields=id,name,capabilities(canAddChildren),appProperties`);
    if (!f.capabilities?.canAddChildren) throw new Error('can open it but not add to it');
    return f.appProperties?.memoraAlbum ? 'B can read the Memora tag' : 'B can NOT read the Memora tag';
  });

  // Drive's search can lag behind a fresh share, so B's searches retry for a while.
  const sharedAt = Date.now();
  const since = () => `${Math.round((Date.now() - sharedAt) / 1000)}s after the invite`;

  await check(results, "B sees A's photo in the folder", () =>
    poll(async () => {
      const list = await call(B.token, 'GET', `${API}/files?q=${q(`'${folder.id}' in parents and trashed=false`)}&fields=files(name)`);
      if (!list.files.some((f) => f.name === 'from-A.png')) throw new Error(`saw ${list.files.length} file(s), not A's photo`);
      return since();
    }),
  );

  await check(results, 'B finds it among folders shared with them (no tag)', () =>
    poll(async () => {
      const query = q(`mimeType='application/vnd.google-apps.folder' and sharedWithMe and trashed=false`);
      const list = await call(B.token, 'GET', `${API}/files?q=${query}&fields=files(id)&pageSize=200`);
      if (!list.files.some((f) => f.id === folder.id)) throw new Error('not in the list');
      return since();
    }),
  );

  await check(results, 'B finds it by the Memora tag', () =>
    poll(async () => {
      const query = q(`appProperties has { key='memoraAlbum' and value='1' } and sharedWithMe and trashed=false`);
      const list = await call(B.token, 'GET', `${API}/files?q=${query}&fields=files(id)`);
      if (!list.files.some((f) => f.id === folder.id)) throw new Error('not in the list');
      return since();
    }, 30_000),
  );

  await check(results, 'B adds a photo to the album', async () => {
    bFile = await upload(B.token, folder.id, 'from-B.png');
    return bFile.name;
  });

  await check(results, "A sees B's photo, and who added it", async () => {
    const list = await call(
      A.token,
      'GET',
      `${API}/files?q=${q(`'${folder.id}' in parents and trashed=false`)}&fields=files(name,owners(displayName,emailAddress))`,
    );
    const f = list.files.find((x) => x.name === 'from-B.png');
    if (!f) throw new Error(`saw ${list.files.length} file(s), not B's photo`);
    return `added by ${f.owners?.[0]?.displayName ?? f.owners?.[0]?.emailAddress ?? 'unknown'}`;
  });

  // Clean up: B removes its own photo, A deletes the folder.
  if (bFile) await call(B.token, 'DELETE', `${API}/files/${bFile.id}`).catch(() => {});
  await call(A.token, 'DELETE', `${API}/files/${folder.id}`).catch(() => {});
  console.log('  (test folder and photos cleaned up)');

  return { kind, results };
}

const summaries = [];
for (const kind of runs) {
  try {
    summaries.push(await runScope(kind));
  } catch (e) {
    console.log(`\n✗ ${kind}: ${e.message}`);
    summaries.push({ kind, results: [{ label: 'setup', ok: false, detail: e.message }] });
  }
}

console.log('\n================ Summary ================');
for (const { kind, results } of summaries) {
  const passed = results.every((r) => r.ok);
  console.log(`${kind === 'file' ? 'drive.file' : 'drive     '}: ${passed ? 'WORKS for shared albums' : 'does NOT work'}`);
  for (const r of results.filter((x) => !x.ok)) console.log(`   ✗ ${r.label}: ${r.detail}`);
}
console.log('\nPaste this summary back to Claude.');
