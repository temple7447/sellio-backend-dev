const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const { MarketUser, MarketCustomer } = require('../src/models/MarketUser');
const walletService = require('../src/services/wallet.service');
const WalletTransaction = require('../src/models/WalletTransaction');

async function testRefundOnCancel() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        const buyer = await MarketUser.findOne({ email: 'buyer@example.com' });
        if (!buyer) {
            console.log(chalk.red('✗ Buyer not found'));
            return;
        }

        const currentBalance = await walletService.getBalance(buyer._id);
        if (currentBalance.balance < 3000) {
            console.log(chalk.blue('Crediting wallet...'));
            await walletService.credit(buyer._id, 3000, 'Test credit', { type: 'deposit', paymentGateway: 'system' });
        }

        console.log(chalk.blue('\n=== Testing Refund on Withdrawal Cancel ===\n'));

        const initialBalance = await walletService.getBalance(buyer._id);
        console.log(chalk.blue(`1. Initial balance: ₦${initialBalance.balance.toLocaleString()}`));

        console.log(chalk.blue('2. Creating withdrawal request of ₦2,000...'));
        const withdrawal = await walletService.requestWithdrawal(buyer._id, 2000);
        const withdrawalTx = withdrawal.transaction;

        console.log(chalk.yellow(`   Transaction amount: ₦${withdrawalTx.amount}`));
        console.log(chalk.yellow(`   walletDebitAmount: ₦${withdrawalTx.metadata?.walletDebitAmount || 'not set'}`));

        const afterWithdrawalBalance = await walletService.getBalance(buyer._id);
        console.log(chalk.blue(`3. Balance after withdrawal: ₦${afterWithdrawalBalance.balance.toLocaleString()}`));
        console.log(chalk.blue(`   Debit from wallet: ₦${(initialBalance.balance - afterWithdrawalBalance.balance).toLocaleString()}`));

        console.log(chalk.blue('\n4. Admin cancelling the withdrawal...'));
        const cancelResult = await walletService.processManualWithdrawal(
            withdrawalTx._id,
            'failed',
            { reason: 'Test cancellation', adminId: null }
        );

        const finalBalance = await walletService.getBalance(buyer._id);
        console.log(chalk.green(`5. Balance after cancel: ₦${finalBalance.balance.toLocaleString()}`));

        const refundTx = await WalletTransaction.findOne({
            userId: buyer._id,
            type: 'deposit',
            'metadata.originalTransactionId': withdrawalTx._id
        });

        console.log(chalk.blue('\n=== Results ==='));
        console.log(chalk.blue(`Initial balance:  ₦${initialBalance.balance.toLocaleString()}`));
        console.log(chalk.blue(`After withdraw:   ₦${afterWithdrawalBalance.balance.toLocaleString()}`));
        console.log(chalk.blue(`After cancel:     ₦${finalBalance.balance.toLocaleString()}`));

        if (finalBalance.balance === initialBalance.balance) {
            console.log(chalk.green('✓ PASS: Balance fully restored'));
        } else {
            console.log(chalk.red(`✗ FAIL: Expected ₦${initialBalance.balance}, got ₦${finalBalance.balance}`));
        }

        if (refundTx) {
            console.log(chalk.green(`✓ Refund: ₦${refundTx.amount}`));
        }

    } catch (error) {
        console.error(chalk.red('Error:'), error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

testRefundOnCancel();
