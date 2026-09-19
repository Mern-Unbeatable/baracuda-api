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

  static async sendCampaignEmail(to, subjectObj, campaign) {
    const subject = subjectObj.en || 'My12Photos Newsletter';
    const title = campaign.title?.en || '';
    const contentText = campaign.content?.en || '';
    const baseUrl = config.app.backendUrl ? config.app.backendUrl.replace(/\/$/, '') : 'http://localhost:3000';
    
    // Construct HTML template based on UI design
    // bannerUrl is now already a full URL from the service, but let's make sure it handles both.
    const finalBannerUrl = campaign.bannerUrl?.startsWith('http') ? campaign.bannerUrl : (campaign.bannerUrl ? `${baseUrl}${campaign.bannerUrl}` : null);
    
    const html = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        ${finalBannerUrl ? `<img src="${finalBannerUrl}" alt="Banner" style="width: 100%; max-height: 400px; object-fit: cover; border-radius: 8px 8px 0 0;" />` : ''}
        <div style="padding: 30px 20px; background-color: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
          <h1 style="font-size: 24px; color: #111; margin-top: 0;">${title}</h1>
          <div style="font-size: 16px; line-height: 1.6; color: #555;">
            ${contentText}
          </div>
          ${(campaign.ctaText && campaign.ctaUrl) ? `
            <div style="margin-top: 30px; text-align: center;">
              <a href="${campaign.ctaUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 4px;">${campaign.ctaText}</a>
            </div>
          ` : ''}
        </div>
        <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
          <p>You received this email because you are subscribed to My12Photos Newsletter.</p>
        </div>
      </div>
    `;
    
    return this.sendEmail(to, subject, contentText, html);
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
