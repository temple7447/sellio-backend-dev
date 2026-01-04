const { MarketUser } = require('../models/MarketUser');
const WalletTransaction = require('../models/WalletTransaction');
const chalk = require('chalk');

class WalletService {
    /**
     * Get wallet balance for a user
     */
    async getBalance(userId) {
        const MarketWallet = require('../models/MarketWallet');
        let wallet = await MarketWallet.findOne({ userId });

        // If wallet doesn't exist, create it (lazy initialization)
        if (!wallet) {
            wallet = await MarketWallet.create({ userId });
        }

        return {
            balance: wallet.balance,
            currency: wallet.currency,
            lastTransaction: wallet.lastTransactionAt,
            status: wallet.status
        };
    }

    /**
     * Credit wallet (add funds)
     */
    async credit(userId, amount, description, metadata = {}) {
        if (amount <= 0) {
            throw { status: 400, message: 'Amount must be greater than zero' };
        }

        const MarketWallet = require('../models/MarketWallet');

        // Use atomic update to avoid race conditions
        const wallet = await MarketWallet.findOneAndUpdate(
            { userId },
            {
                $inc: { balance: amount },
                $set: { lastTransactionAt: new Date() }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        const balanceAfter = wallet.balance;
        const balanceBefore = balanceAfter - amount;

        // Record transaction
        const transaction = await WalletTransaction.create({
            userId,
            type: metadata.type || 'deposit',
            amount,
            balanceBefore,
            balanceAfter,
            reference: metadata.reference || this.generateReference(),
            description,
            status: metadata.status || 'completed',
            paymentGateway: metadata.paymentGateway || 'system',
            relatedOrder: metadata.relatedOrder || null,
            metadata
        });

        console.log(chalk.green(`✓ Wallet credited: ${amount} NGN for user ${userId}`));

        return {
            balanceBefore,
            balanceAfter,
            transaction
        };
    }

    /**
     * Debit wallet (deduct funds)
     */
    async debit(userId, amount, description, metadata = {}) {
        if (amount <= 0) {
            throw { status: 400, message: 'Amount must be greater than zero' };
        }

        const MarketWallet = require('../models/MarketWallet');

        // First check if user has enough balance
        const currentWallet = await MarketWallet.findOne({ userId });
        if (!currentWallet || currentWallet.balance < amount) {
            throw {
                status: 400,
                message: 'Insufficient wallet balance',
                required: amount,
                available: currentWallet ? currentWallet.balance : 0
            };
        }

        if (currentWallet.status !== 'active') {
            throw { status: 403, message: `Wallet is ${currentWallet.status}` };
        }

        // Atomic update for debit
        const wallet = await MarketWallet.findOneAndUpdate(
            { userId, balance: { $gte: amount } },
            {
                $inc: { balance: -amount },
                $set: { lastTransactionAt: new Date() }
            },
            { new: true }
        );

        if (!wallet) {
            // Re-check for internal consistency
            throw { status: 400, message: 'Transaction failed: insufficient funds or race condition' };
        }

        const balanceAfter = wallet.balance;
        const balanceBefore = balanceAfter + amount;

        // Record transaction
        const transaction = await WalletTransaction.create({
            userId,
            type: metadata.type || 'payment',
            amount,
            balanceBefore,
            balanceAfter,
            reference: metadata.reference || this.generateReference(),
            description,
            status: metadata.status || 'completed',
            paymentGateway: metadata.paymentGateway || 'system',
            relatedOrder: metadata.relatedOrder || null,
            metadata
        });

        console.log(chalk.blue(`→ Wallet debited: ${amount} NGN from user ${userId}`));

        return {
            balanceBefore,
            balanceAfter,
            transaction
        };
    }

    /**
     * Get transaction history
     */
    async getTransactions(userId, query = {}) {
        const { page = 1, limit = 20, type, status } = query;
        const skip = (page - 1) * limit;

        const filter = { userId };
        if (type) filter.type = type;
        if (status) filter.status = status;

        const [transactions, total] = await Promise.all([
            WalletTransaction.find(filter)
                .sort('-createdAt')
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            WalletTransaction.countDocuments(filter)
        ]);

        return {
            transactions,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        };
    }

    /**
     * Get all transactions across the system (Admin only)
     */
    async getAllTransactions(query = {}) {
        const { page = 1, limit = 20, type, status, userId, reference } = query;
        const skip = (page - 1) * limit;

        const filter = {};
        if (type) filter.type = type;
        if (status) filter.status = status;
        if (userId) filter.userId = userId;
        if (reference) filter.reference = reference;

        const [transactions, total] = await Promise.all([
            WalletTransaction.find(filter)
                .populate('userId', 'fullName email phoneNumber businessName')
                .sort('-createdAt')
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            WalletTransaction.countDocuments(filter)
        ]);

        return {
            transactions,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        };
    }

    /**
     * Get wallet summary statistics
     */
    async getWalletSummary(userId) {
        const [balance, stats] = await Promise.all([
            this.getBalance(userId),
            WalletTransaction.aggregate([
                { $match: { userId: mongoose.Types.ObjectId(userId) } },
                {
                    $group: {
                        _id: '$type',
                        totalAmount: { $sum: '$amount' },
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        const summary = {
            balance: balance.balance,
            currency: balance.currency,
            statistics: {}
        };

        stats.forEach(stat => {
            summary.statistics[stat._id] = {
                totalAmount: stat.totalAmount,
                count: stat.count
            };
        });

        return summary;
    }

    /**
     * Get list of banks from Paystack
     */
    async getBanks() {
        const paystack = require('../utils/paystack');
        const response = await paystack.getBanks();

        // Inject Test Bank for sandboxing
        if (response.status && response.data) {
            response.data.unshift({
                name: "Test Bank (Paystack Sandbox)",
                slug: "test-bank-sandbox",
                code: "001",
                active: true,
                is_deleted: false,
                type: "nuban"
            });
        }

        return response;
    }

    /**
     * Verify account number with bank code
     */
    async verifyAccount(accountNumber, bankCode) {
        const paystack = require('../utils/paystack');
        return await paystack.verifyAccountNumber(accountNumber, bankCode);
    }

    /**
     * Request withdrawal
     */
    async requestWithdrawal(userId, amount) {
        const RewardSettings = require('../models/RewardSettings');
        const paystack = require('../utils/paystack');
        const settings = await RewardSettings.getSettings();

        // 1. Check minimum withdrawal amount
        if (amount < settings.withdrawal.minAmount) {
            throw {
                status: 400,
                message: `Minimum withdrawal amount is ₦${settings.withdrawal.minAmount}`
            };
        }

        // 2. Check user verification status and bank details
        const user = await MarketUser.findById(userId);
        if (!user) throw { status: 404, message: 'User not found' };

        if (user.role === 'seller' && (!user.isVerified || !user.adminVerified)) {
            throw {
                status: 403,
                message: 'Only verified sellers can withdraw funds'
            };
        }

        if (!user.bankAccount || !user.bankAccount.accountNumber || !user.bankAccount.bankCode) {
            throw {
                status: 400,
                message: 'Please update your bank information before withdrawing'
            };
        }

        // 3. Create or get transfer recipient
        let recipientCode = user.bankAccount.recipientCode;
        if (!recipientCode) {
            // SIMULATION: If bankCode is 001 (Test Bank), simulate a success
            if (user.bankAccount.bankCode === '001') {
                console.log(chalk.yellow('ℹ Sandbox: Simulating Paystack recipient creation for Test Bank'));
                recipientCode = `RCP_TEST_${Math.random().toString(36).substring(7).toUpperCase()}`;
            } else {
                console.log(chalk.blue('→ Creating Paystack transfer recipient...'));
                const recipient = await paystack.createTransferRecipient(
                    user.bankAccount.accountName || user.fullName,
                    user.bankAccount.accountNumber,
                    user.bankAccount.bankCode
                );
                recipientCode = recipient.data.recipient_code;
            }

            // Save recipient code for future use
            user.bankAccount.recipientCode = recipientCode;
            await user.save();
        }

        // 4. Record the debit first (set as pending)
        const debitResult = await this.debit(userId, amount, 'Wallet withdrawal', {
            type: 'withdrawal',
            status: 'pending',
            metadata: {
                requestedAt: new Date(),
                minWithdrawalLimit: settings.withdrawal.minAmount,
                bankName: user.bankAccount.bankName,
                accountNumber: user.bankAccount.accountNumber
            }
        });

        const transaction = debitResult.transaction;

        // 5. Initiate Paystack transfer
        try {
            let transferData;

            // SIMULATION: If it's a test recipient, simulate a success
            if (recipientCode.startsWith('RCP_TEST_')) {
                console.log(chalk.yellow(`ℹ Sandbox: Simulating Paystack transfer of ₦${amount}`));
                transferData = {
                    data: {
                        transfer_code: `TRF_TEST_${Math.random().toString(36).substring(7).toUpperCase()}`,
                        reference: `REF_TEST_${Math.random().toString(36).substring(7).toUpperCase()}`,
                        status: 'success'
                    }
                };
            } else {
                console.log(chalk.blue(`→ Initiating Paystack transfer of ₦${amount}...`));
                transferData = await paystack.initiateTransfer(
                    amount,
                    recipientCode,
                    `Withdrawal for ${user.fullName} (${transaction._id})`
                );
            }

            // Update transaction with Paystack reference
            transaction.metadata.paystackTransferCode = transferData.data.transfer_code;
            transaction.metadata.paystackReference = transferData.data.reference;

            // If it was simulated, we can mark it as successful immediately in test mode
            if (recipientCode.startsWith('RCP_TEST_')) {
                transaction.status = 'completed';
            }

            await transaction.save();

            return {
                transaction,
                balanceAfter: debitResult.balanceAfter
            };
        } catch (error) {
            console.error(chalk.red('✗ Paystack transfer initiation failed:'), error);

            // HYBRID SYSTEM: Instead of auto-refunding, we keep it pending and flag for admin
            if (transaction) {
                transaction.status = 'pending';
                transaction.metadata.paystackError = error.message || 'Transfer initiation failed';
                transaction.metadata.requiresManualAction = true;
                transaction.metadata.failedAt = new Date();
                await transaction.save();

                console.log(chalk.yellow(`⚠ Withdrawal ${transaction.reference} queued for manual admin review due to Paystack failure.`));

                return {
                    transaction,
                    balanceAfter: debitResult.balanceAfter,
                    requiresManualAction: true,
                    message: 'Automated transfer failed, but request is queued for manual processing.'
                };
            }

            throw {
                status: 500,
                message: `Failed to initiate transfer: ${error.message || 'Unknown error'}`
            };
        }
    }

    /**
     * Process a manual withdrawal request (Admin Only)
     */
    async processManualWithdrawal(transactionId, status, adminData = {}) {
        const transaction = await WalletTransaction.findById(transactionId);
        if (!transaction) throw { status: 404, message: 'Transaction not found' };

        if (transaction.type !== 'withdrawal') {
            throw { status: 400, message: 'Transaction is not a withdrawal' };
        }

        if (transaction.status !== 'pending') {
            throw { status: 400, message: `Cannot process transaction with status: ${transaction.status}` };
        }

        const { reason, adminId } = adminData;

        if (status === 'completed') {
            transaction.status = 'completed';
            transaction.metadata.manuallyProcessed = true;
            transaction.metadata.processedAt = new Date();
            transaction.metadata.processedBy = adminId;
            await transaction.save();

            return { success: true, transaction };
        }

        if (status === 'failed') {
            transaction.status = 'failed';
            transaction.metadata.declineReason = reason || 'Declined by admin';
            transaction.metadata.processedAt = new Date();
            transaction.metadata.processedBy = adminId;
            await transaction.save();

            // Perform the refund
            console.log(chalk.red(`→ Refunding ₦${transaction.amount} to user ${transaction.userId} due to manual decline`));

            const MarketWallet = require('../models/MarketWallet');
            await MarketWallet.findOneAndUpdate(
                { userId: transaction.userId },
                {
                    $inc: { balance: transaction.amount },
                    $set: { lastTransactionAt: new Date() }
                }
            );

            // Record a reversal transaction for clarity
            const reversal = await WalletTransaction.create({
                userId: transaction.userId,
                type: 'deposit',
                amount: transaction.amount,
                balanceBefore: 0, // We'll need to fetch current balance to be precise, or just use 0 if we don't track it here
                // Note: balanceBefore/After in WalletTransaction usually reflects the balance AFTER the specific operation it describes.
                // In our 'debit' method, balanceAfter is balance before - amount.
                // For reversal, we'll just omit or set logically if we have the wallet.
                balanceAfter: 0,
                reference: `REV-${transaction.reference}`,
                description: `Reversal: ${transaction.description}`,
                status: 'completed',
                paymentGateway: 'system',
                metadata: {
                    originalTransactionId: transaction._id,
                    reason: reason || 'Manual decline by admin'
                }
            });

            // Refresh balance after in reversal
            const wallet = await MarketWallet.findOne({ userId: transaction.userId });
            reversal.balanceAfter = wallet.balance;
            reversal.balanceBefore = wallet.balance - transaction.amount;
            await reversal.save();

            return { success: true, transaction, reversal };
        }

        throw { status: 400, message: 'Invalid status for manual processing. Use "completed" or "failed".' };
    }

    /**
     * Generate unique transaction reference
     */
    generateReference() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9).toUpperCase();
        return `WTX-${timestamp}-${random}`;
    }

    /**
     * Verify transaction exists
     */
    async verifyTransaction(reference) {
        const transaction = await WalletTransaction.findOne({ reference });
        if (!transaction) {
            throw { status: 404, message: 'Transaction not found' };
        }
        return transaction;
    }
}

module.exports = new WalletService();
