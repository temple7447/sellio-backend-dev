const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const { MarketUser } = require('../src/models/MarketUser');
const walletService = require('../src/services/wallet.service');
const WalletTransaction = require('../src/models/WalletTransaction');

async function testFullWithdrawalLifecycle() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        // Test for both roles
        const testUsers = [
            { email: 'buyer@example.com', role: 'customer' },
            { email: 'seller@example.com', role: 'seller' }
        ];

        for (const { email, role } of testUsers) {
            console.log(chalk.blue(`\n${'='.repeat(60)}`));
            console.log(chalk.blue(`Testing: ${role.toUpperCase()} (${email})`));
            console.log(chalk.blue('='.repeat(60)) + '\n');

            const user = await MarketUser.findOne({ email });
            if (!user) {
                console.log(chalk.red(`✗ User not found: ${email}`));
                continue;
            }

            // Get initial balance
            let balance = (await walletService.getBalance(user._id)).balance;
            console.log(chalk.blue(`Starting balance: ₦${balance.toLocaleString()}`));

            // Ensure sufficient balance
            if (balance < 3000) {
                const needed = 3000 - balance;
                await walletService.credit(user._id, needed, 'Test credit', { type: 'deposit', paymentGateway: 'system' });
                balance = (await walletService.getBalance(user._id)).balance;
                console.log(chalk.blue(`Credited ₦${needed.toLocaleString()}, new balance: ₦${balance.toLocaleString()}`));
            }

            const initialBalance = (await walletService.getBalance(user._id)).balance;

            // === TEST 1: Create and Cancel Withdrawal ===
            console.log(chalk.blue('\n--- Test 1: Create & Cancel Withdrawal ---'));
            
            try {
                const withdrawal1 = await walletService.requestWithdrawal(user._id, 2000);
                const tx1 = withdrawal1.transaction;
                
                console.log(chalk.yellow(`Created withdrawal: ${tx1.reference}`));
                console.log(`Amount: ₦2,000 | Debit: ₦${tx1.metadata.walletDebitAmount || tx1.amount}`);
                
                const afterWithdraw1 = (await walletService.getBalance(user._id)).balance;
                console.log(chalk.blue(`Balance after withdrawal: ₦${afterWithdraw1.toLocaleString()}`));

                // Cancel the withdrawal
                console.log(chalk.yellow('\nCancelling withdrawal...'));
                const cancel1 = await walletService.processManualWithdrawal(
                    tx1._id, 
                    'failed',
                    { reason: 'Test cancellation', adminId: null }
                );

                const afterCancel1 = (await walletService.getBalance(user._id)).balance;
                console.log(chalk.blue(`Balance after cancel: ₦${afterCancel1.toLocaleString()}`));

                // Verify balance restored
                if (afterCancel1 === initialBalance) {
                    console.log(chalk.green('✓ PASS: Balance fully restored after cancel'));
                } else {
                    console.log(chalk.red(`✗ FAIL: Balance mismatch! Expected ₦${initialBalance}, got ₦${afterCancel1}`));
                }

                // Verify transaction status
                const updatedTx1 = await WalletTransaction.findById(tx1._id);
                if (updatedTx1.status === 'failed') {
                    console.log(chalk.green('✓ PASS: Transaction status is FAILED'));
                } else {
                    console.log(chalk.red(`✗ FAIL: Expected FAILED, got ${updatedTx1.status}`));
                }

                // Verify refund transaction exists
                const refundTx1 = await WalletTransaction.findOne({
                    userId: user._id,
                    type: 'deposit',
                    'metadata.originalTransactionId': tx1._id
                });

                if (refundTx1) {
                    console.log(chalk.green(`✓ PASS: Refund recorded: ₦${refundTx1.amount}`));
                    if (refundTx1.amount === (tx1.metadata.walletDebitAmount || tx1.amount)) {
                        console.log(chalk.green('✓ PASS: Refund amount matches original debit'));
                    } else {
                        console.log(chalk.red(`✗ FAIL: Refund mismatch! Expected ₦${tx1.metadata.walletDebitAmount || tx1.amount}, got ₦${refundTx1.amount}`));
                    }
                } else {
                    console.log(chalk.red('✗ FAIL: No refund transaction found'));
                }

            } catch (error) {
                console.log(chalk.red(`✗ Test 1 failed: ${error.message}`));
            }

            // === TEST 2: Verify Transaction History ===
            console.log(chalk.blue('\n--- Test 2: Verify Withdrawal History ---'));
            
            const { transactions } = await walletService.getTransactions(user._id, { type: 'withdrawal' });
            const withdrawals = transactions.filter(tx => tx.type === 'withdrawal');

            if (withdrawals.length > 0) {
                console.log(chalk.green(`Found ${withdrawals.length} withdrawal records`));
                
                // Check the latest one (our test withdrawal)
                const latestWithdrawal = withdrawals[0];
                if (latestWithdrawal.status === 'failed') {
                    console.log(chalk.green('✓ PASS: Latest withdrawal shows as FAILED'));
                } else {
                    console.log(chalk.red(`✗ FAIL: Expected FAILED, got ${latestWithdrawal.status}`));
                }

                // Check metadata preservation
                if (latestWithdrawal.metadata.declineReason) {
                    console.log(chalk.green('✓ PASS: Decline reason preserved in metadata'));
                } else {
                    console.log(chalk.yellow('⚠ No decline reason in metadata'));
                }
            } else {
                console.log(chalk.red('✗ FAIL: No withdrawal history found'));
            }

            // Final balance
            const finalBalance = (await walletService.getBalance(user._id)).balance;
            console.log(chalk.blue(`\n--- Final Balance: ₦${finalBalance.toLocaleString()} ---`));
            console.log(chalk.blue(`--- Expected: ₦${initialBalance.toLocaleString()} ---`));

            if (finalBalance === initialBalance) {
                console.log(chalk.green('✓ PASS: Balance matches initial amount'));
            } else {
                console.log(chalk.red(`✗ FAIL: Balance mismatch! Expected ₦${initialBalance}, got ₦${finalBalance}`));
            }
        }

        console.log(chalk.green('\n\n✅ Full withdrawal lifecycle test completed!'));

    } catch (error) {
        console.error(chalk.red('Error during test:'), error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

testFullWithdrawalLifecycle();
