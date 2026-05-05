const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const { MarketUser } = require('../src/models/MarketUser');
const walletService = require('../src/services/wallet.service');
const WalletTransaction = require('../src/models/WalletTransaction');

async function testWithdrawalFees() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        const seller = await MarketUser.findOne({ email: 'seller@example.com' });
        if (!seller) {
            console.log(chalk.red('✗ Seller not found'));
            return;
        }

        console.log(chalk.blue(`\nTesting withdrawal for: ${seller.email} (${seller.role})`));

        const initialBalance = (await walletService.getBalance(seller._id)).balance;
        console.log(chalk.blue(`Initial balance: ₦${initialBalance.toLocaleString()}`));

        if (initialBalance < 5000) {
            const needed = 5000 - initialBalance;
            await walletService.credit(seller._id, needed, 'Test credit', { type: 'deposit', paymentGateway: 'system' });
        }

        const balanceBefore = (await walletService.getBalance(seller._id)).balance;
        console.log(chalk.blue(`Balance before withdrawal: ₦${balanceBefore.toLocaleString()}`));

        console.log(chalk.blue('\nRequesting withdrawal of ₦3,000...'));
        const withdrawal = await walletService.requestWithdrawal(seller._id, 3000);
        const tx = withdrawal.transaction;

        console.log(chalk.blue('\n--- Transaction Details from DB ---'));
        const freshTx = await WalletTransaction.findById(tx._id);
        console.log(chalk.yellow(`Transaction amount: ₦${freshTx.amount}`));
        console.log(chalk.yellow(`walletDebitAmount: ₦${freshTx.metadata?.walletDebitAmount || 'not set'}`));
        console.log(chalk.yellow(`originalAmount: ₦${freshTx.metadata?.originalAmount || 'not set'}`));
        console.log(chalk.yellow(`feeAmount: ₦${freshTx.metadata?.feeAmount || 'not set'}`));
        console.log(chalk.yellow(`amountAfterFee: ₦${freshTx.metadata?.amountAfterFee || 'not set'}`));
        console.log(chalk.yellow(`Status: ${freshTx.status}`));

        const balanceAfter = (await walletService.getBalance(seller._id)).balance;
        console.log(chalk.blue(`\nBalance after withdrawal: ₦${balanceAfter.toLocaleString()}`));
        console.log(chalk.blue(`Actual debited: ₦${(balanceBefore - balanceAfter).toLocaleString()}`));

        const fee = seller.role === 'seller' ? 0.03 : 0.015;
        const expectedFee = Math.round(3000 * fee * 100) / 100;
        const expectedDebit = 3000;
        const expectedAfterFee = 3000 - expectedFee;

        console.log(chalk.blue('\n--- Expected Values ---'));
        console.log(chalk.blue(`Fee (${fee * 100}%): ₦${expectedFee}`));
        console.log(chalk.blue(`Should debit from wallet: ₦${expectedDebit}`));
        console.log(chalk.blue(`Amount after fee (display): ₦${expectedAfterFee}`));

        console.log(chalk.blue('\n--- Verification ---'));
        if (freshTx.amount === expectedAfterFee) {
            console.log(chalk.green(`✓ Transaction amount correct: ₦${freshTx.amount}`));
        } else {
            console.log(chalk.red(`✗ Transaction amount WRONG! Expected ₦${expectedAfterFee}, got ₦${freshTx.amount}`));
        }

        if (balanceAfter === balanceBefore - expectedDebit) {
            console.log(chalk.green(`✓ Balance debited correctly: ₦${expectedDebit}`));
        } else {
            console.log(chalk.red(`✗ Balance debit WRONG! Expected ₦${balanceBefore - expectedDebit}, got ₦${balanceAfter}`));
        }

    } catch (error) {
        console.error(chalk.red('Error:'), error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

testWithdrawalFees();
