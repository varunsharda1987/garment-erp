/**
 * Email Configuration
 *
 * Configures nodemailer transport for sending emails.
 * Supports SMTP (production) and test mode (development).
 */

import nodemailer, { Transporter } from 'nodemailer';
import { logInfo, logWarn } from '../utils/logger';

// Email configuration from environment
export const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  from: {
    name: process.env.EMAIL_FROM_NAME || 'Garment ERP',
    address: process.env.EMAIL_FROM_ADDRESS || 'noreply@example.com',
  },
};

// Check if email is configured
export function isEmailConfigured(): boolean {
  return !!(emailConfig.auth.user && emailConfig.auth.pass);
}

// Singleton transporter instance
let transporter: Transporter | null = null;

/**
 * Get or create email transporter
 */
export async function getTransporter(): Promise<Transporter> {
  if (transporter) {
    return transporter;
  }

  if (!isEmailConfigured()) {
    logWarn('Email not configured. Set SMTP_USER and SMTP_PASS environment variables.');
    // Create a test account for development
    if (process.env.NODE_ENV !== 'production') {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      logInfo(`Using Ethereal test email account: ${testAccount.user}`);
      return transporter;
    }
    throw new Error('Email not configured for production');
  }

  transporter = nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: emailConfig.auth,
  });

  // Verify connection
  try {
    await transporter.verify();
    logInfo('Email transporter connected successfully');
  } catch (error) {
    logWarn('Email transporter verification failed:', error);
  }

  return transporter;
}

/**
 * Get default from address
 */
export function getFromAddress(): string {
  return `"${emailConfig.from.name}" <${emailConfig.from.address}>`;
}

export default {
  emailConfig,
  isEmailConfigured,
  getTransporter,
  getFromAddress,
};
