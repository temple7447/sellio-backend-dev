const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const { MarketUser } = require('../src/models/MarketUser');

async function testGetBankInfo() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        const buyer = await MarketUser.findOne({ email: 'buyer@example.com' });
        if (!buyer) {
            console.log(chalk.red('✗ Buyer not found'));
            return;
        }

        // Simulate what GET /api/auth/user/bank-info returns
        const bank = buyer.bankAccount || null;
        const response = {
            success: true,
            message: bank ? 'Bank information fetched successfully' : 'No bank information found',
            bankAccount: bank ? {
                bankName: bank.bankName || null,
                accountNumber: bank.accountNumber || null,
                accountName: bank.accountName || null
            } : null
        };

        console.log(chalk.blue('\n=== API Response (GET /api/auth/user/bank-info) ==='));
        console.log(chalk.green(JSON.stringify(response, null, 2)));

    } catch (error) {
        console.error(chalk.red('Error:'), error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

testGetBankInfo();
