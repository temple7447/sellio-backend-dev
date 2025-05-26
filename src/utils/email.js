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
            subject: 'Verify Your Market Vendor Account',
            html: `
                <h1>Email Verification</h1>
                <p>Your OTP for account verification is: <strong>${otp}</strong></p>
                <p>This OTP will expire in 5 minutes.</p>
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
