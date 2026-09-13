import nodemailer from 'nodemailer';
import config from '../config/env.js';

export class EmailUtil {
  static transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });

  /**
   * Send an email
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} text - Email plain text content
   * @param {string} html - Email HTML content
   */
  static async sendEmail(to, subject, text, html) {
    try {
      // For development, if credentials are empty, ethereal can be used or just mock the email sending.
      if (!config.smtp.user && process.env.NODE_ENV !== 'production') {
        console.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject}`);
        console.log(`[MOCK EMAIL CONTENT]: ${text}`);
        return true;
      }

      const info = await this.transporter.sendMail({
        from: config.smtp.from,
        to,
        subject,
        text,
        html,
      });

      console.log('Message sent: %s', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Could not send email. Please try again later.');
    }
  }

  static async sendOtp(to, otp) {
    const subject = 'Your Password Reset OTP';
    const text = `Your OTP for password reset is: ${otp}. It will expire in 15 minutes.`;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Password Reset</h2>
        <p>Your One-Time Password (OTP) for resetting your account is:</p>
        <h1 style="color: #4CAF50; letter-spacing: 5px;">${otp}</h1>
        <p>This code will expire in 15 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      </div>
    `;
    return this.sendEmail(to, subject, text, html);
  }
}
