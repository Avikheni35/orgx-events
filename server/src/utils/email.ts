import nodemailer from 'nodemailer';
import { env } from '../config/env';

function createTransport() {
  if (!env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

const transport = createTransport();

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  if (!transport) {
    console.log(`[M2 Email] To: ${options.to}\nSubject: ${options.subject}\n${options.html}${options.attachments ? `\n[${options.attachments.length} attachment(s)]` : ''}`);
    return;
  }
  await transport.sendMail({ from: env.EMAIL_FROM, ...options });
}
