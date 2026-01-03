const Nodemailer = require('nodemailer');
const { MailtrapTransport } = require('mailtrap');
const chalk = require('chalk');
const config = require('../config/config');

// Initialize Mailtrap transport
let transport;
const initializeMailtrap = () => {
    try {
        if (!config.MAILTRAP_TOKEN) {
            throw new Error('Mailtrap token not configured');
        }

        transport = Nodemailer.createTransport(
            MailtrapTransport({
                token: config.MAILTRAP_TOKEN,
            })
        );

        console.log(chalk.green('✓ Mailtrap is configured and ready'));
        console.log(chalk.blue('Sender:'), `${config.MAILTRAP_SENDER_NAME} <${config.MAILTRAP_SENDER_EMAIL}>`);
    } catch (error) {
        console.error(chalk.red('✗ Mailtrap configuration error:'), error.message);
    }
};

// Initialize on startup
initializeMailtrap();

const sendOTP = async (email, otp) => {
    // Log OTP to terminal in development
    if (process.env.NODE_ENV === 'development') {
        process.stdout.write('\n' + '='.repeat(50) + '\n');
        process.stdout.write(chalk.yellow.bold(' DEVELOPMENT OTP LOG \n'));
        process.stdout.write(chalk.blue(' To:      ') + chalk.white(email) + '\n');
        process.stdout.write(chalk.blue(' OTP:     ') + chalk.green.bold(otp) + '\n');
        process.stdout.write('='.repeat(50) + '\n\n');
    }

    try {
        // Validate required Mailtrap configuration
        if (!config.MAILTRAP_TOKEN) {
            throw new Error('Mailtrap token not configured');
        }

        if (!transport) {
            throw new Error('Mailtrap transport not initialized');
        }

        const sender = {
            address: config.MAILTRAP_SENDER_EMAIL,
            name: config.MAILTRAP_SENDER_NAME,
        };

        const emailData = {
            from: sender,
            to: [email],
            subject: 'Your One-Time Password (OTP) - Sellio Marketplace',
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f7f7f7; padding: 40px 0;">
                  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow: hidden;">
                    <div style="background: #0d6efd; color: #fff; padding: 24px 32px; text-align: center;">
                      <h2 style="margin: 0; font-size: 1.7rem; letter-spacing: 1px;">Sellio Marketplace</h2>
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
                      &copy; ${new Date().getFullYear()} Sellio Marketplace. All rights reserved.
                    </div>
                  </div>
                </div>
            `,
            text: `Sellio Marketplace - Your OTP: ${otp}. This code is valid for 5 minutes. If you did not request this, please ignore this email.`,
            category: 'OTP Verification'
        };

        const mailResponse = await transport.sendMail(emailData);

        console.log(chalk.green('✓ Email sent successfully via Mailtrap'));
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

const sendWelcomeEmail = async (user) => {
    try {
        if (!transport) throw new Error('Mailtrap transport not initialized');

        const sender = {
            address: config.MAILTRAP_SENDER_EMAIL,
            name: config.MAILTRAP_SENDER_NAME,
        };

        const isSeller = user.role === 'seller';
        const welcomeMessage = isSeller
            ? "Your seller account has been created. Start listing your products to reach potential buyers and grow your business."
            : "Your account is ready. Start exploring the best deals and items today.";

        const emailData = {
            from: sender,
            to: [user.email],
            subject: `Welcome to Sellio Marketplace, ${user.fullName}!`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9fafb; }
                        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
                        .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px 20px; text-align: center; color: white; }
                        .content { padding: 40px 30px; }
                        .btn { display: inline-block; padding: 14px 28px; background-color: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }
                        .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 14px; color: #6b7280; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1 style="margin: 0; font-size: 28px;">Welcome to Sellio!</h1>
                        </div>
                        <div class="content">
                            <h2 style="color: #111827; margin-top: 0;">Hi ${user.fullName},</h2>
                            <p style="font-size: 16px;">We're thrilled to have you join our community! ${welcomeMessage}</p>
                            ${isSeller ? `
                            <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; margin: 20px 0;">
                                <p style="margin: 0; font-weight: 600; color: #1e40af;">Verify Your Documents</p>
                                <p style="margin: 5px 0 0 0; font-size: 14px; color: #1e40af;">Our team is currently reviewing your business details. You'll receive another email once your store is fully verified and ready for sales.</p>
                            </div>
                            ` : ''}
                            <a href="${config.FRONTEND_URL || '#'}" class="btn">Get Started Now</a>
                            <p style="margin-top: 30px;">Best regards,<br>The Sellio Team</p>
                        </div>
                        <div class="footer">
                            &copy; ${new Date().getFullYear()} Sellio Marketplace. All rights reserved.
                        </div>
                    </div>
                </body>
                </html>
            `,
            category: 'Welcome'
        };

        await transport.sendMail(emailData);
        console.log(chalk.green(`✓ Welcome email sent to ${user.email}`));
        return { success: true };
    } catch (error) {
        console.error(chalk.red('✗ Welcome email failed:'), error.message);
        return { success: false, error: error.message };
    }
};

const sendAccountVerifiedEmail = async (user) => {
    try {
        if (!transport) throw new Error('Mailtrap transport not initialized');

        const sender = {
            address: config.MAILTRAP_SENDER_EMAIL,
            name: config.MAILTRAP_SENDER_NAME,
        };

        const emailData = {
            from: sender,
            to: [user.email],
            subject: 'Congratulations! Your Shop is Verified',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9fafb; }
                        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
                        .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 40px 20px; text-align: center; color: white; }
                        .content { padding: 40px 30px; }
                        .badge { display: inline-block; padding: 6px 12px; background: #ecfdf5; color: #065f46; border-radius: 9999px; font-size: 14px; font-weight: 600; margin-bottom: 10px; }
                        .btn { display: inline-block; padding: 14px 28px; background-color: #059669; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }
                        .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 14px; color: #6b7280; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1 style="margin: 0; font-size: 28px;">Account Verified!</h1>
                        </div>
                        <div class="content">
                            <span class="badge">Verification Complete</span>
                            <h2 style="color: #111827; margin-top: 0;">Congratulations ${user.fullName},</h2>
                            <p style="font-size: 16px;">We're excited to inform you that your seller account has been officially verified! Your shop <strong>${user.businessName}</strong> is now live and visible to customers.</p>
                            <p style="font-size: 16px;">You can now start receiving orders and building your campus presence.</p>
                            <a href="${config.FRONTEND_URL || '#'}/dashboard" class="btn">Go to Dashboard</a>
                            <p style="margin-top: 30px;">Happy Selling!<br>The Sellio Team</p>
                        </div>
                        <div class="footer">
                            &copy; ${new Date().getFullYear()} Sellio Marketplace. All rights reserved.
                        </div>
                    </div>
                </body>
                </html>
            `,
            category: 'Verification'
        };

        await transport.sendMail(emailData);
        console.log(chalk.green(`✓ Verification success email sent to ${user.email}`));
        return { success: true };
    } catch (error) {
        console.error(chalk.red('✗ Verification email failed:'), error.message);
        return { success: false, error: error.message };
    }
};

module.exports = { sendOTP, sendWelcomeEmail, sendAccountVerifiedEmail };
