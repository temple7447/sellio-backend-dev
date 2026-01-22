const mongoose = require('mongoose');
const chalk = require('chalk');
const config = require('../src/config/config');
const { MarketUser } = require('../src/models/MarketUser');
const MarketWallet = require('../src/models/MarketWallet');
const WalletTransaction = require('../src/models/WalletTransaction');

async function runAudit() {
    try {
        console.log(chalk.blue('Connecting to MongoDB for Wallet Audit...'));
        await mongoose.connect(process.env.MONGODB_URI || config.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        // Get all wallets
        const wallets = await MarketWallet.find({});
        console.log(chalk.blue(`Auditing ${wallets.length} wallets...\n`));

        let totalDiscrepancies = 0;

        for (const wallet of wallets) {
            const transactions = await WalletTransaction.find({
                userId: wallet.userId,
                status: 'completed'
            });

            const calculatedBalance = transactions.reduce((acc, tx) => {
                if (['deposit', 'earning', 'referral_bonus', 'cashback', 'refund'].includes(tx.type)) {
                    return acc + tx.amount;
                } else if (['withdrawal', 'payment', 'transfer'].includes(tx.type)) {
                    return acc - tx.amount;
                }
                return acc;
            }, 0);

            const difference = Math.abs(wallet.balance - calculatedBalance);

            if (difference > 0.01) { // Floating point tolerance
                totalDiscrepancies++;
                console.log(chalk.red(`✗ Discrepancy found for User ${wallet.userId}:`));
                console.log(`  Wallet Balance: ₦${wallet.balance}`);
                console.log(`  Calculated Sum: ₦${calculatedBalance}`);
                console.log(`  Difference:     ₦${difference}`);
            }
        }

        if (totalDiscrepancies === 0) {
            console.log(chalk.green('✓ Audit Complete: All wallets match their transaction histories perfectly!'));
        } else {
            console.log(chalk.red(`\nAudit Complete: Found ${totalDiscrepancies} discrepancies.`));
        }

        process.exit(0);
    } catch (error) {
        console.error(chalk.red('✗ Audit Failed:'), error.message);
        process.exit(1);
    }
}

runAudit();
