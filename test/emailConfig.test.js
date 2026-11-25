import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import jwt from 'jsonwebtoken';
import test from 'node:test';
import emailConfigRoutes from '../routes/emailConfig.js';
import { JWT_CONFIG } from '../config/jwt.js';
import pool from '../config/db.js';
import {
  decryptSecretWithKey,
  encryptSecretWithKey,
  getEnvironmentMailSettings,
  getActiveEmailTransportSettings,
  initializeEmailEncryptionKey,
  normalizeApplicationPassword,
  safeEmailErrorLog,
  translateEmailError,
} from '../utils/emailConfigService.js';

function useSmtpEnvironment() {
  const names = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  Object.assign(process.env, {
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '465',
    SMTP_USER: 'admin@example.com',
    SMTP_PASS: 'application-password',
    SMTP_FROM: 'admin@example.com',
  });
  return () => {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  };
}

test('email application passwords are encrypted with an authenticated key', () => {
  const key = crypto.randomBytes(32);
  const password = 'abcd efgh ijkl mnop';
  const encrypted = encryptSecretWithKey(password, key);

  assert.notEqual(encrypted.password_cifrada, password);
  assert.equal(decryptSecretWithKey(encrypted, key), password);
  assert.throws(() => decryptSecretWithKey(encrypted, crypto.randomBytes(32)), {
    name: 'EmailConfigDecryptionError',
  });
  assert.equal(normalizeApplicationPassword(password), 'abcdefghijklmnop');
});

test('encryption key is generated in the configured external file with restricted permissions', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'agrogestion-email-key-'));
  const keyPath = path.join(directory, 'email-encryption.key');
  const previousKey = process.env.EMAIL_ENCRYPTION_KEY;
  const previousPath = process.env.EMAIL_ENCRYPTION_KEY_FILE;
  delete process.env.EMAIL_ENCRYPTION_KEY;
  process.env.EMAIL_ENCRYPTION_KEY_FILE = keyPath;

  try {
    const key = await initializeEmailEncryptionKey();
    const contents = await readFile(keyPath, 'utf8');
    assert.equal(key.length, 32);
    assert.match(contents, /^[a-f\d]{64}$/i);
    if (process.platform !== 'win32') {
      assert.equal((await stat(keyPath)).mode & 0o777, 0o600);
    }
  } finally {
    if (previousKey === undefined) delete process.env.EMAIL_ENCRYPTION_KEY;
    else process.env.EMAIL_ENCRYPTION_KEY = previousKey;
    if (previousPath === undefined) delete process.env.EMAIL_ENCRYPTION_KEY_FILE;
    else process.env.EMAIL_ENCRYPTION_KEY_FILE = previousPath;
    await rm(directory, { recursive: true, force: true });
  }
});

test('SMTP errors are translated and logs redact credentials', () => {
  const authError = Object.assign(new Error('Authentication failed'), { code: 'EAUTH' });
  const timeoutError = Object.assign(new Error('connection timed out'), { code: 'ETIMEDOUT' });

  assert.equal(
    translateEmailError(authError),
    'Gmail rechazó la contraseña; usa una contraseña de aplicación',
  );
  assert.equal(
    translateEmailError(timeoutError),
    'No se pudo conectar con el servidor de correo',
  );
  assert.equal(
    safeEmailErrorLog(
      new Error('Rejected password app-secret for smtp-user@example.com'),
      { pass: 'app-secret', user: 'smtp-user@example.com' },
    ).includes('app-secret'),
    false,
  );
});

test('environment SMTP variables remain a valid fallback', () => {
  assert.deepEqual(
    getEnvironmentMailSettings({
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '465',
      SMTP_USER: 'admin@example.com',
      SMTP_PASS: 'application-password',
    }),
    {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      user: 'admin@example.com',
      pass: 'application-password',
      from: 'admin@example.com',
      source: 'environment',
    },
  );
  assert.equal(getEnvironmentMailSettings({ SMTP_USER: 'admin@example.com' }), null);
});

test('active database mail settings take priority over environment settings', async () => {
  const key = await initializeEmailEncryptionKey();
  const encrypted = encryptSecretWithKey('database-password', key);
  const restoreEnvironment = useSmtpEnvironment();
  const originalQuery = pool.query;
  pool.query = async () => ({
    rows: [{
      remitente: 'sender@example.com',
      host: 'smtp.database.example',
      puerto: 587,
      secure: false,
      usuario: 'sender@example.com',
      activo: true,
      ...encrypted,
    }],
  });

  try {
    const settings = await getActiveEmailTransportSettings();
    assert.equal(settings.source, 'database');
    assert.equal(settings.host, 'smtp.database.example');
    assert.equal(settings.pass, 'database-password');
  } finally {
    pool.query = originalQuery;
    restoreEnvironment();
  }
});

test('inactive database mail settings fall back to environment settings', async () => {
  const restoreEnvironment = useSmtpEnvironment();
  const originalQuery = pool.query;
  pool.query = async () => ({ rows: [{ activo: false }] });

  try {
    const settings = await getActiveEmailTransportSettings();
    assert.equal(settings.source, 'environment');
    assert.equal(settings.pass, 'application-password');
  } finally {
    pool.query = originalQuery;
    restoreEnvironment();
  }
});

test('active mail transport falls back to environment when the config table is missing', async () => {
  const restoreEnvironment = useSmtpEnvironment();
  const originalQuery = pool.query;
  pool.query = async () => {
    const error = new Error('missing test table');
    error.code = '42P01';
    throw error;
  };

  try {
    const settings = await getActiveEmailTransportSettings();
    assert.equal(settings.source, 'environment');
    assert.equal(settings.user, 'admin@example.com');
    assert.equal(settings.pass, 'application-password');
  } finally {
    pool.query = originalQuery;
    restoreEnvironment();
  }
});

test('all administrative email routes reject non-admin users', async (t) => {
  const app = express();
  app.use(express.json());
  app.use('/admin', emailConfigRoutes);
  const server = app.listen(0);
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve) => server.once('listening', resolve));

  const token = jwt.sign(
    { id: 9, email: 'worker@example.com', role: 'worker' },
    JWT_CONFIG.ACCESS_TOKEN_SECRET,
  );
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const requests = [
    fetch(`${baseUrl}/admin/config-correo`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${baseUrl}/admin/config-correo`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }),
    fetch(`${baseUrl}/admin/config-correo/probar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),
  ];

  const responses = await Promise.all(requests);
  assert.deepEqual(responses.map((response) => response.status), [403, 403, 403]);
});
