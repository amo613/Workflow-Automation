/**
 * Load test: N users each log in (own session) and trigger workflow 1.
 * Requests are spread over DURATION_MS (default 60s), not all at once.
 *
 * Usage: npm run load-test
 * Env:   BASE_URL, LOAD_TEST_EMAIL, LOAD_TEST_PASSWORD (optional, see defaults)
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const EMAIL = process.env.LOAD_TEST_EMAIL || 'john@gmail.com';
const PASSWORD = process.env.LOAD_TEST_PASSWORD || '123456';
const WORKFLOW_ID = parseInt(process.env.LOAD_TEST_WORKFLOW_ID || '1', 10);
const NUM_USERS = parseInt(process.env.LOAD_TEST_NUM_USERS || '100', 10);
const DURATION_MS = parseInt(process.env.LOAD_TEST_DURATION_MS || '60000', 10);

function parseTokenFromSetCookie(header) {
  if (!header) return null;
  const parts = (Array.isArray(header) ? header.join(';') : header).split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('token=')) {
      return trimmed.slice(6).trim();
    }
  }
  return null;
}

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    redirect: 'manual',
  });
  const token = parseTokenFromSetCookie(res.headers.get('set-cookie'));
  if (!token) {
    throw new Error(`Login failed: ${res.status} – no token in Set-Cookie`);
  }
  if (res.status !== 200 && res.status !== 302) {
    const text = await res.text();
    throw new Error(`Login failed: ${res.status} ${text}`);
  }
  return token;
}

async function runWorkflow(token) {
  const res = await fetch(`${BASE_URL}/api/full-workflows/${WORKFLOW_ID}/trigger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });
  return { status: res.status, ok: res.ok };
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runOneUser(userIndex) {
  const start = Date.now();
  let loginOk = false;
  let triggerOk = false;
  let err = null;
  try {
    const token = await login();
    loginOk = true;
    const { status, ok } = await runWorkflow(token);
    triggerOk = ok;
    return { userIndex, loginOk, triggerOk, status, durationMs: Date.now() - start };
  } catch (e) {
    err = e.message || String(e);
    return { userIndex, loginOk, triggerOk, status: null, durationMs: Date.now() - start, err };
  }
}

async function main() {
  console.log('Load test config:', {
    BASE_URL,
    EMAIL,
    WORKFLOW_ID,
    NUM_USERS,
    DURATION_MS,
  });
  console.log('Spreading', NUM_USERS, 'users over', DURATION_MS / 1000, 'seconds...\n');

  const intervalMs = DURATION_MS / NUM_USERS;
  const promises = [];
  for (let i = 0; i < NUM_USERS; i++) {
    const t = i * intervalMs;
    promises.push(
      delay(t).then(() => runOneUser(i + 1))
    );
  }

  const results = await Promise.all(promises);

  const successful = results.filter((r) => r.loginOk && r.triggerOk);
  const loginFail = results.filter((r) => !r.loginOk);
  const triggerFail = results.filter((r) => r.loginOk && !r.triggerOk);
  const durations = results.map((r) => r.durationMs).filter((n) => n != null);

  console.log('\n--- Results ---');
  console.log('Total:', results.length);
  console.log('Login + Trigger OK:', successful.length);
  console.log('Login failed:', loginFail.length);
  console.log('Trigger failed (after login OK):', triggerFail.length);
  if (durations.length) {
    const sum = durations.reduce((a, b) => a + b, 0);
    console.log('Avg duration per user (ms):', Math.round(sum / durations.length));
    console.log('Min duration (ms):', Math.min(...durations));
    console.log('Max duration (ms):', Math.max(...durations));
  }
  if (loginFail.length) {
    console.log('\nFirst login error:', loginFail[0]?.err || loginFail[0]);
  }
  if (triggerFail.length) {
    console.log('First trigger status:', triggerFail[0]?.status, triggerFail[0]?.err);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
