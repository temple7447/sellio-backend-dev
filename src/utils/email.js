const nodemailer = require('nodemailer');
const chalk = require('chalk');
const config = require('../config/config');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_PASS,
    },
});

const sendOTP = async (email, otp) => {
    try {
        const mailResponse = await transporter.sendMail({
            from: config.EMAIL_USER,
            to: email,
            subject: 'Your One-Time Password (OTP) - Market Vendor',
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f7f7f7; padding: 40px 0;">
                  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow: hidden;">
                    <div style="background: #0d6efd; color: #fff; padding: 24px 32px; text-align: center;">
                      <h2 style="margin: 0; font-size: 1.7rem; letter-spacing: 1px;">Market Vendor</h2>
                    </div>
                    <div style="padding: 32px 32px 16px 32px;">
                      <h3 style="margin-top: 0; color: #222;">Your One-Time Password (OTP)</h3>
                      <p style="font-size: 1.05rem; color: #444;">Hello,</p>
                      <p style="font-size: 1.05rem; color: #444;">Use the OTP below to complete your request. This code is valid for <b>5 minutes</b>.</p>
                      <div style="text-align: center; margin: 32px 0;">
                        <span style="display: inline-block; font-size: 2.2rem; letter-spacing: 8px; color: #0d6efd; font-weight: bold; background: #f1f3f6; padding: 16px 32px; border-radius: 8px; border: 1px dashed #0d6efd;">${otp}</span>
                      </div>
                      <p style="font-size: 1rem; color: #666;">If you did not request this, please ignore this email. Do not share this code with anyone.</p>
                    </div>
                    <div style="background: #f1f3f6; color: #888; text-align: center; padding: 18px 32px; font-size: 0.95rem;">
                      &copy; ${new Date().getFullYear()} Market Vendor. All rights reserved.
                    </div>
                  </div>
                </div>
            `,
        });

        console.log(chalk.green('✓ Email sent successfully'));
        console.log(chalk.blue('Message ID:'), mailResponse.messageId);
        
        return {
            success: true,
            messageId: mailResponse.messageId,
            message: 'OTP sent successfully'
        };
    } catch (error) {
        console.error(chalk.red('✗ Email sending failed:'), error);
        return {
            success: false,
            error: error.message,
            message: 'Failed to send OTP email'
        };
    }
};

module.exports = { sendOTP };
