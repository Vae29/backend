import crypto from 'node:crypto';
import { chmod, mkdir, open, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import pool from '../config/db.js';

const CONFIG_ID = 1;
const DEFAULT_HOST = 'smtp.gmail.com';
const DEFAULT_PORT = 465;
const TABLE_MISSING_CACHE_MS = 30_000;

let encryptionKeyPromise;
let tableMissingUntil = 0;
let tableMissingWarned = false;
let missingMailConfigWarned = false;
let databaseReadWarned = false;

export class EmailConfigStorageUnavailableError extends Error {
  constructor() {
    super('La tabla de configuración de correo no está disponible. Aplica la migración 004.');
    this.name = 'EmailConfigStorageUnavailableError';
  }
}

export class EmailConfigDecryptionError extends Error {
  constructor() {
    super('La contraseña de aplicación no se pudo descifrar; vuelve a guardarla.');
    this.name = 'EmailConfigDecryptionError';
  }
}

function isMissingConfigTable(error) {
  return error?.code === '42P01';
}

function reportMissingConfigTable() {
  tableMissingUntil = Date.now() + TABLE_MISSING_CACHE_MS;
  if (!tableMissingWarned) {
    console.warn('[Correo] No existe public.configuracion_correo; se usarán las variables SMTP como respaldo.');
    tableMissingWarned = true;
  }
}

function reportDatabaseReadFallback() {
  if (!databaseReadWarned) {
    console.warn('[Correo] No se pudo consultar la configuración guardada; se verificará el respaldo SMTP.');
    databaseReadWarned = true;
  }
}

function decodeEncryptionKey(value) {
  const trimmed = value.trim();
  let key;

  if (/^[\da-f]{64}$/i.test(trimmed)) {
    key = Buffer.from(trimmed, 'hex');
  } else {
    key = Buffer.from(trimmed, 'base64');
    const normalizedInput = trimmed.replace(/=+$/, '');
    const normalizedOutput = key.toString('base64').replace(/=+$/, '');
    if (normalizedInput !== normalizedOutput) {
      throw new Error('EMAIL_ENCRYPTION_KEY debe ser una clave de 32 bytes en hexadecimal o base64.');
    }
  }

  if (key.length !== 32) {
    throw new Error('EMAIL_ENCRYPTION_KEY debe representar exactamente 32 bytes.');
  }
  return key;
}

async function loadEncryptionKey() {
  if (process.env.EMAIL_ENCRYPTION_KEY) {
    return decodeEncryptionKey(process.env.EMAIL_ENCRYPTION_KEY);
  }

  const keyPath = process.env.EMAIL_ENCRYPTION_KEY_FILE
    ? path.resolve(process.env.EMAIL_ENCRYPTION_KEY_FILE)
    : path.join(homedir(), '.agrogestion', 'email-encryption.key');

  await mkdir(path.dirname(keyPath), { recursive: true, mode: 0o700 });
  try {
    const contents = await readFile(keyPath, 'utf8');
    const key = decodeEncryptionKey(contents);
    await chmod(keyPath, 0o600);
    return key;
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }

  const key = crypto.randomBytes(32);
  let file;
  try {
    file = await open(keyPath, 'wx', 0o600);
    await file.writeFile(key.toString('hex'), 'utf8');
    await file.sync();
  } catch (error) {
    if (error?.code === 'EEXIST') {
      return decodeEncryptionKey(await readFile(keyPath, 'utf8'));
    }
    throw error;
  } finally {
    await file?.close();
  }

  await chmod(keyPath, 0o600);
  return key;
}

export function initializeEmailEncryptionKey() {
  if (!encryptionKeyPromise) {
    encryptionKeyPromise = loadEncryptionKey();
  }
  return encryptionKeyPromise;
}

export function encryptSecretWithKey(value, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    password_cifrada: encrypted.toString('hex'),
    password_iv: iv.toString('hex'),
    password_auth_tag: cipher.getAuthTag().toString('hex'),
  };
}

export function decryptSecretWithKey(encrypted, key) {
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(encrypted.password_iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(encrypted.password_auth_tag, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted.password_cifrada, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new EmailConfigDecryptionError();
  }
}

async function encryptSecret(value) {
  return encryptSecretWithKey(value, await initializeEmailEncryptionKey());
}

async function decryptSecret(row) {
  try {
    return decryptSecretWithKey(row, await initializeEmailEncryptionKey());
  } catch {
    throw new EmailConfigDecryptionError();
  }
}

export function normalizeApplicationPassword(value) {
  return String(value || '').replace(/\s/g, '');
}

function mapConfigRow(row) {
  return {
    remitente: row.remitente,
    host: row.host,
    puerto: Number(row.puerto),
    secure: row.secure,
    usuario: row.usuario,
    activo: row.activo,
    ultimo_error: row.ultimo_error,
    ultimo_envio_ok: row.ultimo_envio_ok,
    actualizado_en: row.actualizado_en,
    tieneClave: Boolean(row.password_cifrada && row.password_iv && row.password_auth_tag),
  };
}

async function readConfigRow(client = pool) {
  if (Date.now() < tableMissingUntil) {
    return { available: false, row: null };
  }

  try {
    const result = await client.query(
      `SELECT id, remitente, host, puerto, secure, usuario,
              password_cifrada, password_iv, password_auth_tag,
              activo, ultimo_error, ultimo_envio_ok, actualizado_por, actualizado_en
         FROM public.configuracion_correo
        WHERE id = $1`,
      [CONFIG_ID],
    );
    return { available: true, row: result.rows[0] || null };
  } catch (error) {
    if (!isMissingConfigTable(error)) {
      throw error;
    }
    reportMissingConfigTable();
    return { available: false, row: null };
  }
}

export function getEnvironmentMailSettings(environment = process.env) {
  const host = environment.SMTP_HOST?.trim();
  const user = environment.SMTP_USER?.trim();
  const from = (environment.SMTP_FROM || environment.SMTP_USER || '').trim();
  const pass = environment.SMTP_PASS;
  const rawPort = environment.SMTP_PORT;
  const port = rawPort ? Number(rawPort) : DEFAULT_PORT;

  if (!host || !user || !from || !pass || !Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }
  return { host, port, secure: port === 465, user, pass, from, source: 'environment' };
}

async function markConfigInactive(message) {
  try {
    await pool.query(
      `UPDATE public.configuracion_correo
          SET activo = FALSE, ultimo_error = $1, actualizado_en = CURRENT_TIMESTAMP
        WHERE id = $2`,
      [message, CONFIG_ID],
    );
  } catch (error) {
    if (!isMissingConfigTable(error)) {
      console.error('[Correo] No se pudo actualizar el estado de la configuración.');
    }
  }
}

async function getDecryptedSettings(row) {
  try {
    return {
      host: row.host,
      port: Number(row.puerto),
      secure: row.secure,
      user: row.usuario,
      pass: await decryptSecret(row),
      from: row.remitente,
      source: 'database',
    };
  } catch {
    await markConfigInactive('No se pudo descifrar la contraseña de aplicación; vuelve a guardarla.');
    return null;
  }
}

export async function getAdminEmailConfig() {
  const { available, row } = await readConfigRow();
  if (!row) {
    const environment = getEnvironmentMailSettings();
    return {
      remitente: environment?.from || '',
      host: environment?.host || DEFAULT_HOST,
      puerto: environment?.port || DEFAULT_PORT,
      secure: environment?.secure ?? true,
      usuario: environment?.user || '',
      activo: Boolean(environment),
      ultimo_error: null,
      ultimo_envio_ok: null,
      actualizado_en: null,
      tieneClave: false,
      storageAvailable: available,
      fuente: environment ? 'environment' : 'none',
    };
  }

  const config = mapConfigRow(row);
  if (config.tieneClave || config.activo) {
    const decrypted = await getDecryptedSettings(row);
    if (!decrypted) {
      config.activo = false;
      config.ultimo_error = 'No se pudo descifrar la contraseña de aplicación; vuelve a guardarla.';
      config.tieneClave = false;
    }
  }

  return {
    ...config,
    storageAvailable: true,
    fuente: 'database',
    respaldoActivo: Boolean(getEnvironmentMailSettings()),
  };
}

export async function isPasswordResetEmailAvailable() {
  let row;
  try {
    ({ row } = await readConfigRow());
  } catch {
    reportDatabaseReadFallback();
  }
  if (row?.activo) {
    if (row.password_cifrada && row.password_iv && row.password_auth_tag) {
      if (await getDecryptedSettings(row)) {
        return true;
      }
    } else {
      await markConfigInactive('No se encontró la contraseña de aplicación; vuelve a guardarla.');
    }
  }

  const available = Boolean(getEnvironmentMailSettings());
  if (!available && !missingMailConfigWarned) {
    console.warn('[Correo] No hay una configuración SMTP válida para la recuperación de contraseña.');
    missingMailConfigWarned = true;
  }
  return available;
}

export async function getActiveEmailTransportSettings() {
  let row;
  try {
    ({ row } = await readConfigRow());
  } catch {
    reportDatabaseReadFallback();
  }
  if (row?.activo) {
    const settings = await getDecryptedSettings(row);
    if (settings) {
      return settings;
    }
  }

  const environment = getEnvironmentMailSettings();
  if (environment) {
    return environment;
  }

  if (!missingMailConfigWarned) {
    console.warn('[Correo] No hay una configuración SMTP válida para la recuperación de contraseña.');
    missingMailConfigWarned = true;
  }
  throw new Error('No hay una configuración de correo válida.');
}

export async function getConfiguredEmailTransportSettings() {
  const { available, row } = await readConfigRow();
  if (!available) {
    throw new EmailConfigStorageUnavailableError();
  }
  if (!row) {
    throw new Error('Guarda una configuración de correo antes de probarla.');
  }
  const settings = await getDecryptedSettings(row);
  if (!settings) {
    throw new EmailConfigDecryptionError();
  }
  return settings;
}

async function insertAdminAudit(client, { userId, ip, action, description }) {
  await client.query(
    `SELECT public.fn_auditoria_contexto(
       $1::integer, $2::text, NULL, NULL, 'USUARIOS', $3::text
     )`,
    [userId, ip || null, description],
  );
  await client.query(
    `INSERT INTO public.auditoria
       (usuario_id, modulo, accion, tabla_afectada, registro_id, descripcion, ip_usuario)
     VALUES ($1, 'USUARIOS', $2, 'configuracion_correo', $3, $4, $5)`,
    [userId, action, CONFIG_ID, description, ip || null],
  );
}

export async function saveAdminEmailConfig(config, { userId, ip }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { available, row: previous } = await readConfigRow(client);
    if (!available) {
      throw new EmailConfigStorageUnavailableError();
    }

    let encrypted;
    if (config.password) {
      encrypted = await encryptSecret(config.password);
    } else if (previous?.password_cifrada && previous?.password_iv && previous?.password_auth_tag) {
      await decryptSecret(previous);
      encrypted = {
        password_cifrada: previous.password_cifrada,
        password_iv: previous.password_iv,
        password_auth_tag: previous.password_auth_tag,
      };
    } else {
      throw new Error('Ingresa una contraseña de aplicación para guardar la configuración.');
    }

    await client.query(
      `INSERT INTO public.configuracion_correo
         (id, remitente, host, puerto, secure, usuario,
          password_cifrada, password_iv, password_auth_tag, activo,
          ultimo_error, ultimo_envio_ok, actualizado_por, actualizado_en)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, NULL, NULL, $10, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE
         SET remitente = EXCLUDED.remitente,
             host = EXCLUDED.host,
             puerto = EXCLUDED.puerto,
             secure = EXCLUDED.secure,
             usuario = EXCLUDED.usuario,
             password_cifrada = EXCLUDED.password_cifrada,
             password_iv = EXCLUDED.password_iv,
             password_auth_tag = EXCLUDED.password_auth_tag,
             activo = FALSE,
             ultimo_error = NULL,
             ultimo_envio_ok = NULL,
             actualizado_por = EXCLUDED.actualizado_por,
             actualizado_en = CURRENT_TIMESTAMP`,
      [
        CONFIG_ID,
        config.remitente,
        config.host,
        config.puerto,
        config.secure,
        config.usuario,
        encrypted.password_cifrada,
        encrypted.password_iv,
        encrypted.password_auth_tag,
        userId,
      ],
    );
    await insertAdminAudit(client, {
      userId,
      ip,
      action: 'CONFIGURACION_CORREO',
      description: 'Configuración de correo actualizada; queda inactiva hasta probar el envío.',
    });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {
      console.error('[Correo] No se pudo revertir la transacción de configuración.');
    });
    if (isMissingConfigTable(error)) {
      reportMissingConfigTable();
      throw new EmailConfigStorageUnavailableError();
    }
    throw error;
  } finally {
    client.release();
  }
  return getAdminEmailConfig();
}

export async function recordEmailConfigTest({ success, errorMessage, userId, ip }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { available, row } = await readConfigRow(client);
    if (!available) {
      throw new EmailConfigStorageUnavailableError();
    }
    if (!row) {
      throw new Error('Guarda una configuración de correo antes de probarla.');
    }

    const description = success
      ? 'Prueba de envío de correo exitosa.'
      : 'Prueba de envío de correo fallida.';
    await insertAdminAudit(client, {
      userId,
      ip,
      action: 'PRUEBA_CORREO',
      description,
    });
    await client.query(
      `UPDATE public.configuracion_correo
          SET activo = $1,
              ultimo_error = $2,
              ultimo_envio_ok = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE ultimo_envio_ok END,
              actualizado_por = $3,
              actualizado_en = CURRENT_TIMESTAMP
        WHERE id = $4`,
      [success, success ? null : errorMessage, userId, CONFIG_ID],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {
      console.error('[Correo] No se pudo revertir la transacción de prueba.');
    });
    if (isMissingConfigTable(error)) {
      reportMissingConfigTable();
      throw new EmailConfigStorageUnavailableError();
    }
    throw error;
  } finally {
    client.release();
  }
  return getAdminEmailConfig();
}

export async function recordEmailDeliveryFailure(message) {
  try {
    await pool.query(
      `UPDATE public.configuracion_correo
          SET activo = FALSE, ultimo_error = $1
        WHERE id = $2`,
      [message, CONFIG_ID],
    );
  } catch (error) {
    if (isMissingConfigTable(error)) {
      reportMissingConfigTable();
      return;
    }
    console.error('[Correo] No se pudo guardar el error de envío.');
  }
}

export async function recordEmailDeliverySuccess(source) {
  if (source !== 'database') {
    return;
  }
  try {
    await pool.query(
      `UPDATE public.configuracion_correo
          SET ultimo_envio_ok = CURRENT_TIMESTAMP, ultimo_error = NULL
        WHERE id = $1 AND activo = TRUE`,
      [CONFIG_ID],
    );
  } catch (error) {
    if (isMissingConfigTable(error)) {
      reportMissingConfigTable();
      return;
    }
    console.error('[Correo] No se pudo actualizar la fecha del último envío correcto.');
  }
}

export function translateEmailError(error) {
  const code = String(error?.code || '').toUpperCase();
  const response = String(error?.response || '');
  const responseCode = Number(error?.responseCode || response.match(/\b\d{3}\b/)?.[0]);
  if (code === 'EAUTH' || responseCode === 535 || responseCode === 534) {
    return 'Gmail rechazó la contraseña; usa una contraseña de aplicación';
  }
  if (
    ['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH']
      .includes(code)
  ) {
    return 'No se pudo conectar con el servidor de correo';
  }
  return 'No se pudo enviar el correo. Revisa la configuración e inténtalo de nuevo.';
}

export function emailStatusError(error) {
  const message = translateEmailError(error);
  const code = String(error?.code || error?.responseCode || '').replace(/[^A-Z0-9_-]/gi, '').slice(0, 40);
  return code ? `${message} (${code})` : message;
}

export function safeEmailErrorLog(error, settings) {
  const code = String(error?.code || 'ERROR').replace(/[^A-Z0-9_-]/gi, '').slice(0, 40);
  let detail = [error?.message, error?.response].filter(Boolean).map(String).join(' ');
  const credentials = [
    settings?.pass,
    settings?.pass?.replace(/\s/g, ''),
    settings?.user,
  ];
  for (const secret of credentials) {
    if (secret) {
      detail = detail.replace(new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '[redactado]');
    }
  }
  detail = detail.slice(0, 400);
  return `${code}: ${detail || translateEmailError(error)}`;
}
