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
        await transporter.sendMail({
            from: config.EMAIL_USER,
            to: email,
            subject: 'Verify Your Market Vendor Account',
            html: `
                <h1>Email Verification</h1>
                <p>Your OTP for account verification is: <strong>${otp}</strong></p>
                <p>This OTP will expire in 5 minutes.</p>
            `,
        });
        return true;
    } catch (error) {
        console.error(chalk.red('✗ Email sending failed:'), error);
        return false;
    }
};

module.exports = { sendOTP };
