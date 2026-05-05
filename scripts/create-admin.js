const chalk = require('chalk');
require('dotenv').config();
const config = require('../src/config/config');
const adminService = require('../src/services/admin.service');
const mongoose = require('mongoose');

async function createAdminAccount() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        const adminData = {
            email: 'admin@campustrade.com',
            password: 'Admin@12345678',
            fullName: 'Campus Trade Admin',
            phoneNumber: '08000000000',
            setupKey: config.ADMIN_SETUP_KEY
        };

        console.log(chalk.blue('\nAttempting to register admin...'));
        const result = await adminService.registerAdmin(adminData);

        console.log(chalk.green('\n✓ Admin account created successfully!'));
        console.log(chalk.cyan('\n📋 Admin Credentials:'));
        console.log(chalk.white(`Email:    ${adminData.email}`));
        console.log(chalk.white(`Password: ${adminData.password}`));
        console.log(chalk.white(`Full Name: ${adminData.fullName}`));
        console.log(chalk.white(`Phone:    ${adminData.phoneNumber}`));
        console.log(chalk.yellow(`\nAuth Token: ${result.token}`));
        console.log(chalk.dim('\n⚠️  Store these credentials securely!'));

    } catch (error) {
        console.error(chalk.red('✗ Error creating admin account:'));
        console.error(chalk.red(`  ${error.message}`));
        if (error.status) {
            console.error(chalk.yellow(`  Status: ${error.status}`));
        }
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

createAdminAccount();
