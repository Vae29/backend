import nodemailer from 'nodemailer';
import {
  getActiveEmailTransportSettings,
  getConfiguredEmailTransportSettings,
  emailStatusError,
  recordEmailConfigTest,
  recordEmailDeliveryFailure,
  recordEmailDeliverySuccess,
  safeEmailErrorLog,
  translateEmailError,
} from './emailConfigService.js';

const smtpTimeoutMs = 15000;

function createTransporter(settings) {
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: {
      user: settings.user,
      pass: settings.pass,
    },
    connectionTimeout: smtpTimeoutMs,
    greetingTimeout: smtpTimeoutMs,
    socketTimeout: smtpTimeoutMs,
  });
}

async function deliver(settings, message) {
  const transporter = createTransporter(settings);
  return transporter.sendMail({ from: settings.from, ...message });
}

export async function sendResetCodeEmail(to, code) {
  let settings;
  try {
    settings = await getActiveEmailTransportSettings();
    await deliver(settings, {
      to,
      subject: 'Código de recuperación de AgroGestión',
      text: `Tu código de recuperación es: ${code}\n\nNo compartas este código con nadie. Expira en 5 minutos.`,
      html: `<p>Tu código de recuperación es: <strong>${code}</strong></p><p>No compartas este código con nadie. Expira en 5 minutos.</p>`,
    });
    await recordEmailDeliverySuccess(settings.source);
    return true;
  } catch (error) {
    const safeMessage = emailStatusError(error);
    console.error(`[Correo] Falló el envío del código de recuperación: ${safeEmailErrorLog(error, settings)}`);
    await recordEmailDeliveryFailure(safeMessage);
    return false;
  }
}

export async function sendConfiguredTestEmail({ to, userId, ip }) {
  let settings;
  let success = false;
  let errorMessage = null;
  let storedErrorMessage = null;
  let statusCode = 502;

  try {
    settings = await getConfiguredEmailTransportSettings();
  } catch (error) {
    if (error.name === 'EmailConfigStorageUnavailableError') {
      return { success: false, statusCode: 503, message: error.message };
    }
    if (error.message === 'Guarda una configuración de correo antes de probarla.') {
      return { success: false, statusCode: 400, message: error.message };
    }
    errorMessage = error.name === 'EmailConfigDecryptionError'
      ? error.message
      : translateEmailError(error);
    storedErrorMessage = errorMessage;
    console.error(`[Correo] Falló la prueba de envío: ${safeEmailErrorLog(error, settings)}`);
  }

  if (settings) {
    try {
      await deliver(settings, {
        to,
        subject: 'Prueba de configuración de correo - AgroGestión',
        text: 'Este es un correo de prueba de la configuración de correo de AgroGestión.',
        html: '<p>Este es un correo de prueba de la configuración de correo de AgroGestión.</p>',
      });
      success = true;
      statusCode = 200;
    } catch (error) {
      errorMessage = translateEmailError(error);
      storedErrorMessage = emailStatusError(error);
      console.error(`[Correo] Falló la prueba de envío: ${safeEmailErrorLog(error, settings)}`);
    }
  }

  try {
    await recordEmailConfigTest({
      success,
      errorMessage: storedErrorMessage || errorMessage,
      userId,
      ip,
    });
  } catch (error) {
    console.error(`[Correo] No se pudo guardar el resultado de la prueba: ${safeEmailErrorLog(error)}`);
    return {
      success: false,
      statusCode: error.name === 'EmailConfigStorageUnavailableError' ? 503 : 500,
      message: 'No se pudo guardar el resultado de la prueba de correo.',
    };
  }

  return {
    success,
    statusCode,
    message: success ? 'Correo de prueba enviado correctamente.' : errorMessage,
  };
}
