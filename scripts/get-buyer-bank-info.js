const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const { MarketUser } = require('../src/models/MarketUser');

async function getBuyerBankInfo() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        const buyer = await MarketUser.findOne({ email: 'buyer@example.com' });
        if (!buyer) {
            console.log(chalk.red('✗ Buyer not found'));
            return;
        }

        console.log(chalk.blue('\n=== Buyer Bank Information ==='));
        console.log(chalk.blue(`User ID: ${buyer._id}`));
        console.log(chalk.blue(`Email: ${buyer.email}`));
        console.log(chalk.blue(`Full Name: ${buyer.fullName}`));
        console.log(chalk.blue(`Role: ${buyer.role}`));

        if (buyer.bankAccount) {
            console.log(chalk.green('\nBank Details:'));
            console.log(chalk.green(`Bank Name: ${buyer.bankAccount.bankName || 'Not set'}`));
            console.log(chalk.green(`Bank Code: ${buyer.bankAccount.bankCode || 'Not set'}`));
            console.log(chalk.green(`Account Number: ${buyer.bankAccount.accountNumber || 'Not set'}`));
            console.log(chalk.green(`Account Name: ${buyer.bankAccount.accountName || 'Not set'}`));
            console.log(chalk.green(`Recipient Code: ${buyer.bankAccount.recipientCode || 'Not set'}`));
        } else {
            console.log(chalk.yellow('\n⚠ No bank information saved for this buyer'));
        }

    } catch (error) {
        console.error(chalk.red('Error fetching bank info:'), error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

getBuyerBankInfo();
