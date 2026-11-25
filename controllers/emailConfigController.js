import {
  EmailConfigDecryptionError,
  EmailConfigStorageUnavailableError,
  getAdminEmailConfig,
  saveAdminEmailConfig,
} from '../utils/emailConfigService.js';
import { sendConfiguredTestEmail } from '../utils/emailSender.js';

function getActor(req) {
  return {
    userId: Number(req.user?.id),
    ip: req.ip || req.socket.remoteAddress || null,
  };
}

function validateConfig(body) {
  const remitente = typeof body?.remitente === 'string' ? body.remitente.trim() : '';
  const host = typeof body?.host === 'string' ? body.host.trim() : '';
  const usuario = typeof body?.usuario === 'string' ? body.usuario.trim() : '';
  const puerto = Number(body?.puerto);
  const secure = body?.secure;
  const password = typeof body?.password === 'string' ? body.password.replace(/\s/g, '') : '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(remitente)) {
    return { error: 'Ingresa un correo remitente válido.' };
  }
  if (!host || host.length > 253 || /[\s/\\]/.test(host)) {
    return { error: 'Ingresa un servidor SMTP válido.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(usuario)) {
    return { error: 'Ingresa un usuario de correo válido.' };
  }
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    return { error: 'El puerto SMTP debe estar entre 1 y 65535.' };
  }
  if (typeof secure !== 'boolean') {
    return { error: 'Indica si el servidor SMTP usa conexión segura.' };
  }
  if (password.length > 512) {
    return { error: 'La contraseña de aplicación no es válida.' };
  }
  return { config: { remitente, host, usuario, puerto, secure, password } };
}

export async function getEmailConfig(req, res) {
  try {
    const config = await getAdminEmailConfig();
    return res.json({ success: true, data: config });
  } catch {
    console.error('[Correo] No se pudo consultar la configuración administrativa.');
    return res.status(500).json({
      success: false,
      message: 'No se pudo consultar la configuración de correo.',
    });
  }
}

export async function putEmailConfig(req, res) {
  const validation = validateConfig(req.body);
  if (validation.error) {
    return res.status(400).json({ success: false, message: validation.error });
  }

  try {
    const config = await saveAdminEmailConfig(validation.config, getActor(req));
    return res.json({
      success: true,
      message: 'Configuración guardada. Envía un correo de prueba para activarla.',
      data: config,
    });
  } catch (error) {
    if (error instanceof EmailConfigStorageUnavailableError) {
      return res.status(503).json({ success: false, message: error.message });
    }
    if (error instanceof EmailConfigDecryptionError) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña guardada no se puede descifrar. Ingresa de nuevo la contraseña de aplicación.',
      });
    }
    if (error.message === 'Ingresa una contraseña de aplicación para guardar la configuración.') {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('[Correo] No se pudo guardar la configuración administrativa.');
    return res.status(500).json({
      success: false,
      message: 'No se pudo guardar la configuración de correo.',
    });
  }
}

export async function testEmailConfig(req, res) {
  const email = req.user?.email;
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'La cuenta administradora no tiene un correo válido para la prueba.',
    });
  }

  const result = await sendConfiguredTestEmail({
    to: email,
    ...getActor(req),
  });
  return res.status(result.statusCode).json({
    success: result.success,
    message: result.message,
    data: result.success ? result.data : undefined,
  });
}
