import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || smtpUser;

if (!smtpHost || !smtpUser || !smtpPass) {
  console.warn(
    'SMTP incompleto: define SMTP_HOST, SMTP_USER y SMTP_PASS en tu archivo .env para enviar correos reales.'
  );
}

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
  // Evita que el request de backend quede “colgado” si el SMTP no responde
  connectionTimeout: 15000,
  greetingTimeout: 15000,
});


export async function sendResetCodeEmail(to, code) {
  const mailOptions = {
    from: smtpFrom,
    to,
    subject: 'Código de recuperación de AgroGestión',
    text: `Tu código de recuperación es: ${code}\n\nNo compartas este código con nadie. Expira en 5 minutos.`,
    html: `<p>Tu código de recuperación es: <strong>${code}</strong></p><p>No compartas este código con nadie. Expira en 5 minutos.</p>`,
  };

  return transporter.sendMail({ ...mailOptions, timeout: 20000 });
}

