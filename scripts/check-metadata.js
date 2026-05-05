const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const WalletTransaction = require('../src/models/WalletTransaction');

async function checkMetadata() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        const latestWithdrawal = await WalletTransaction.find({ type: 'withdrawal' })
            .sort('-createdAt')
            .limit(1)
            .lean();

        if (latestWithdrawal.length === 0) {
            console.log(chalk.red('✗ No withdrawals found'));
            return;
        }

        const tx = latestWithdrawal[0];
        console.log(chalk.blue('\n=== Raw Transaction Data ==='));
        console.log(chalk.yellow(`Reference: ${tx.reference}`));
        console.log(chalk.yellow(`Amount: ₦${tx.amount}`));
        console.log(chalk.yellow(`Status: ${tx.status}`));
        console.log(chalk.yellow('\nMetadata:'));
        console.log(JSON.stringify(tx.metadata, null, 2));

    } catch (error) {
        console.error(chalk.red('Error:'), error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

checkMetadata();
