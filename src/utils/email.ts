import nodemailer from 'nodemailer';
import { env } from '@config/env';
import logger from './logger';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: env.NODE_ENV === 'production',
  },
});

if (env.NODE_ENV !== 'test') {
  transporter.verify((error) => {
    if (error) {
      logger.warn('SMTP connection failed:', { error: error.message });
    } else {
      logger.info('SMTP server is ready to send emails');
    }
  });
}

const baseTemplate = (content: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Golden Tap Connect</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #D4A017 0%, #B8860B 100%); padding: 32px 40px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px; }
    .body { padding: 40px; }
    .body h2 { color: #1a1a2e; font-size: 22px; margin: 0 0 16px; }
    .body p { color: #4a4a6a; line-height: 1.7; margin: 0 0 16px; font-size: 15px; }
    .button { display: inline-block; background: linear-gradient(135deg, #D4A017, #B8860B); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 8px 0 24px; }
    .code-box { background: #f8f9fa; border: 2px dashed #D4A017; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
    .code { font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1a1a2e; font-family: monospace; }
    .divider { height: 1px; background: #f0f0f0; margin: 24px 0; }
    .footer { background: #f8f9fa; padding: 24px 40px; text-align: center; }
    .footer p { color: #9999aa; font-size: 12px; margin: 4px 0; }
    .footer a { color: #D4A017; text-decoration: none; }
    .warning { background: #fff8e1; border-left: 4px solid #D4A017; padding: 12px 16px; border-radius: 0 6px 6px 0; font-size: 13px; color: #7a6000; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Golden Tap Connect</h1>
      <p>Founder Key Platform</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Golden Tap Connect. All rights reserved.</p>
      <p>Questions? <a href="mailto:support@goldentap.com">support@goldentap.com</a></p>
    </div>
  </div>
</body>
</html>`;

export const welcomeEmail = (name: string): string =>
  baseTemplate(`
    <h2>Welcome to Founder Key, ${name}!</h2>
    <p>You've just joined an exclusive network of founders, innovators, and visionaries. We're thrilled to have you on board.</p>
    <p>Here's what you can do on the platform:</p>
    <ul>
      <li>Connect with other founders at events</li>
      <li>Apply for your <strong>Founder Card</strong></li>
      <li>Track your <strong>FK Score</strong> and earn badges</li>
      <li>Discover and register for exclusive events</li>
    </ul>
    <p>Start exploring and building your network today!</p>
    <a href="${env.FRONTEND_URL}/dashboard" class="button">Go to Dashboard</a>
  `);

export const verificationEmail = (name: string, token: string, url: string): string =>
  baseTemplate(`
    <h2>Verify Your Email Address</h2>
    <p>Hi ${name}, thanks for signing up! Please verify your email address to activate your account.</p>
    <a href="${url}" class="button">Verify Email Address</a>
    <div class="divider"></div>
    <p>Or use this verification code:</p>
    <div class="code-box">
      <div class="code">${token}</div>
    </div>
    <div class="warning">This link will expire in <strong>24 hours</strong>. If you didn't create an account, please ignore this email.</div>
  `);

export const passwordResetEmail = (name: string, token: string, url: string): string =>
  baseTemplate(`
    <h2>Reset Your Password</h2>
    <p>Hi ${name}, we received a request to reset your password.</p>
    <a href="${url}" class="button">Reset Password</a>
    <div class="divider"></div>
    <p>Or use this reset code:</p>
    <div class="code-box">
      <div class="code">${token}</div>
    </div>
    <div class="warning">This link will expire in <strong>15 minutes</strong>. If you didn't request a password reset, please ignore this email and your account will remain secure.</div>
  `);

export const connectionRequestEmail = (
  recipientName: string,
  requesterName: string,
  requesterCompany?: string
): string =>
  baseTemplate(`
    <h2>New Connection Request</h2>
    <p>Hi ${recipientName},</p>
    <p><strong>${requesterName}</strong>${requesterCompany ? ` from ${requesterCompany}` : ''} wants to connect with you on Founder Key.</p>
    <p>Expanding your network is one of the best ways to grow as a founder.</p>
    <a href="${env.FRONTEND_URL}/connections" class="button">View Request</a>
  `);

export const founderCardApprovedEmail = (name: string): string =>
  baseTemplate(`
    <h2>Your Founder Card is Active!</h2>
    <p>Congratulations ${name}! Your Founder Card application has been <strong>approved</strong>.</p>
    <p>You now have access to:</p>
    <ul>
      <li>Your unique <strong>Founder Card QR code</strong> for networking</li>
      <li><strong>100 FK Score points</strong> added to your profile</li>
      <li>Exclusive founder-tier events and features</li>
    </ul>
    <a href="${env.FRONTEND_URL}/founder-card" class="button">View Your Founder Card</a>
  `);

export const eventReminderEmail = (
  name: string,
  eventTitle: string,
  eventDate: string,
  eventLocation: string,
  eventUrl: string
): string =>
  baseTemplate(`
    <h2>Event Reminder: ${eventTitle}</h2>
    <p>Hi ${name}, this is a reminder that you have an upcoming event tomorrow!</p>
    <div class="code-box" style="text-align:left; padding: 20px;">
      <p style="margin:0 0 8px;"><strong>Event:</strong> ${eventTitle}</p>
      <p style="margin:0 0 8px;"><strong>Date:</strong> ${eventDate}</p>
      <p style="margin:0;"><strong>Location:</strong> ${eventLocation}</p>
    </div>
    <a href="${eventUrl}" class="button">View Event Details</a>
  `);

export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<void> => {
  if (env.NODE_ENV === 'test') {
    logger.debug('Email sending skipped in test environment', { to, subject });
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM}>`,
      to,
      subject,
      html,
      text: text ?? html.replace(/<[^>]*>/g, ''),
    });

    logger.info('Email sent', { to, subject, messageId: info.messageId });
  } catch (error) {
    logger.error('Failed to send email', { to, subject, error });
    throw error;
  }
};

export default { sendEmail, welcomeEmail, verificationEmail, passwordResetEmail, connectionRequestEmail, founderCardApprovedEmail, eventReminderEmail };
