import nodemailer from 'nodemailer';

const smtpTimeoutMs = 15000;

export async function sendResetCodeEmail(to, code) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
    throw new Error('Correo no configurado. Define SMTP_HOST, SMTP_USER, SMTP_PASS y SMTP_FROM en Render.');
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    connectionTimeout: smtpTimeoutMs,
    greetingTimeout: smtpTimeoutMs,
    socketTimeout: smtpTimeoutMs,
  });

  return transporter.sendMail({
    from: smtpFrom,
    to,
    subject: 'Código de recuperación de AgroGestión',
    text: `Tu código de recuperación es: ${code}\n\nNo compartas este código con nadie. Expira en 5 minutos.`,
    html: `<p>Tu código de recuperación es: <strong>${code}</strong></p><p>No compartas este código con nadie. Expira en 5 minutos.</p>`,
  });
}
