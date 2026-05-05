const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const { MarketUser, MarketSeller } = require('../src/models/MarketUser');
const walletService = require('../src/services/wallet.service');
const WalletTransaction = require('../src/models/WalletTransaction');

async function testWithdrawalHistory() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        // Test both buyer and seller
        const users = [
            { email: 'buyer@example.com', role: 'customer', name: 'Buyer' },
            { email: 'seller@example.com', role: 'seller', name: 'Seller' }
        ];

        for (const userInfo of users) {
            console.log(chalk.blue(`\n${'='.repeat(60)}`));
            console.log(chalk.blue(`Testing: ${userInfo.name} (${userInfo.email})`));
            console.log(chalk.blue('='.repeat(60)) + '\n');

            const user = await MarketUser.findOne({ email: userInfo.email });
            if (!user) {
                console.log(chalk.red(`✗ ${userInfo.name} not found`));
                continue;
            }

            // Get initial balance
            const initialBalance = await walletService.getBalance(user._id);
            console.log(chalk.blue(`Initial balance: ₦${initialBalance.balance.toLocaleString()}`));

            // Ensure sufficient balance for tests
            if (initialBalance.balance < 5000) {
                const needed = 5000 - initialBalance.balance;
                await walletService.credit(user._id, needed, 'Test credit', { type: 'deposit', paymentGateway: 'system' });
                const newBalance = await walletService.getBalance(user._id);
                console.log(chalk.blue(`Credited ₦${needed.toLocaleString()}, new balance: ₦${newBalance.balance.toLocaleString()}`));
            }

            console.log(chalk.blue(`\n--- Current Wallet Balance: ₦${(await walletService.getBalance(user._id)).balance.toLocaleString()} ---\n`));

            // Get all transactions
            const { transactions } = await walletService.getTransactions(user._id);
            
            const withdrawalTxs = transactions.filter(tx => tx.type === 'withdrawal');
            const reversalTxs = transactions.filter(tx => 
                tx.type === 'deposit' && 
                tx.description && 
                (tx.description.includes('Reversal') || tx.description.includes('refund'))
            );

            console.log(chalk.blue(`\n--- Withdrawal History (${withdrawalTxs.length} records) ---`));
            
            if (withdrawalTxs.length === 0) {
                console.log(chalk.yellow('No withdrawal history found'));
            } else {
                for (const tx of withdrawalTxs) {
                    const statusColor = {
                        'pending': chalk.yellow,
                        'completed': chalk.green,
                        'failed': chalk.red
                    }[tx.status] || chalk.white;

                    console.log(chalk.dim(`\nReference: ${tx.reference}`));
                    console.log(`Amount: ₦${tx.amount.toLocaleString()}`);
                    console.log(`Status: ${statusColor(tx.status.toUpperCase())}`);
                    console.log(`Date: ${new Date(tx.createdAt).toLocaleString()}`);
                    
                    if (tx.metadata) {
                        if (tx.metadata.originalAmount) {
                            console.log(`Original Amount: ₦${tx.metadata.originalAmount.toLocaleString()}`);
                        }
                        if (tx.metadata.feeAmount) {
                            console.log(`Fee: ₦${tx.metadata.feeAmount.toLocaleString()}`);
                        }
                        if (tx.metadata.declineReason) {
                            console.log(chalk.red(`Decline Reason: ${tx.metadata.declineReason}`));
                        }
                        if (tx.metadata.paystackStatus) {
                            console.log(`Paystack Status: ${tx.metadata.paystackStatus}`);
                        }
                    }
                }
            }

            if (reversalTxs.length > 0) {
                console.log(chalk.blue(`\n--- Reversals/Refunds (${reversalTxs.length} records) ---`));
                for (const tx of reversalTxs) {
                    console.log(chalk.dim(`\nReference: ${tx.reference}`));
                    console.log(chalk.green(`Refund Amount: ₦${tx.amount.toLocaleString()}`));
                    console.log(`Description: ${tx.description}`);
                    console.log(`Status: ${chalk.green(tx.status.toUpperCase())}`);
                }
            }

            // Final balance check
            const finalBalance = await walletService.getBalance(user._id);
            console.log(chalk.blue(`\n--- Final Balance: ₦${finalBalance.balance.toLocaleString()} ---`));
        }

        console.log(chalk.green('\n\n✅ Withdrawal history test completed!'));

    } catch (error) {
        console.error(chalk.red('Error during test:'), error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

testWithdrawalHistory();
