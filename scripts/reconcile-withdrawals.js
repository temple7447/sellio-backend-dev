const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const walletService = require('../src/services/wallet.service');

async function reconcileWithdrawals() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        console.log(chalk.blue('\nStarting withdrawal reconciliation with Paystack...\n'));
        const results = await walletService.reconcilePendingWithdrawals();

        console.log(chalk.green('\n=== Reconciliation Summary ==='));
        console.log(chalk.blue(`Total pending withdrawals checked: ${results.total}`));
        console.log(chalk.green(`Marked as completed: ${results.completed}`));
        console.log(chalk.red(`Failed and refunded: ${results.failed}`));
        console.log(chalk.yellow(`Still pending: ${results.stillPending}`));
        console.log(chalk.red(`Errors: ${results.errors}`));

    } catch (error) {
        console.error(chalk.red('Error during reconciliation:'), error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

reconcileWithdrawals();
