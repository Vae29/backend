import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || smtpUser;

const smtpConfigComplete = Boolean(smtpHost && smtpUser && smtpPass);

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: smtpConfigComplete
    ? {
        user: smtpUser,
        pass: smtpPass,
      }
    : undefined,
  // Evita que el request de backend quede “colgado” si el SMTP no responde
  connectionTimeout: 15000,
  greetingTimeout: 15000,
});

if (!smtpConfigComplete) {
  console.warn(
    'SMTP incompleto: define SMTP_HOST, SMTP_USER y SMTP_PASS en tu archivo .env para enviar correos reales.'
  );
}

try {
  if (smtpConfigComplete) {
    await transporter.verify();
    console.log('SMTP OK');
  }
} catch (error) {
  console.error('SMTP VERIFY ERROR:', error);
}

export async function sendResetCodeEmail(to, code) {
  if (!smtpConfigComplete) {
    throw new Error(
      'SMTP no configurado. Define SMTP_HOST, SMTP_USER y SMTP_PASS en tu archivo .env.'
    );
  }

  const mailOptions = {
    from: smtpFrom,
    to,
    subject: 'Código de recuperación de AgroGestión',
    text: `Tu código de recuperación es: ${code}\n\nNo compartas este código con nadie. Expira en 5 minutos.`,
    html: `<p>Tu código de recuperación es: <strong>${code}</strong></p><p>No compartas este código con nadie. Expira en 5 minutos.</p>`,
  };

  return transporter.sendMail({ ...mailOptions, timeout: 20000 });
}

