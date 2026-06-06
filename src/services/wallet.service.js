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
        try {
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
        } catch (error) {
            // Rollback the atomic balance deduction if transaction log fails
            console.error(chalk.red('✗ Wallet transaction logging failed, rolling back balance:'), error);
            await MarketWallet.findOneAndUpdate(
                { userId },
                { $inc: { balance: amount } }
            );
            throw {
                status: 500,
                message: 'Internal transaction error. Please try again.',
                details: error.message
            };
        }
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
     * Initialize a wallet deposit via Korapay
     */
    async initializeDeposit(userId, amount) {
        const korapay = require('../utils/korapay');
        const config = require('../config/config');
        const user = await MarketUser.findById(userId);

        if (!user) {
            throw { status: 404, message: 'User not found' };
        }

        const reference = this.generateReference();

        // 1. Create a pending transaction record
        const wallet = await this.getBalance(userId);
        const transaction = await WalletTransaction.create({
            userId,
            type: 'deposit',
            amount,
            balanceBefore: wallet.balance,
            balanceAfter: wallet.balance, // Will be updated on verification
            reference,
            description: 'Wallet deposit via Korapay',
            status: 'pending',
            paymentGateway: 'korapay',
            metadata: {
                initializedAt: new Date(),
                amount
            }
        });

        // 2. Initialize Korapay checkout
        try {
            const redirectUrl = `${config.FRONTEND_URL}/deposit/verify/${reference}`;
            const notificationUrl = `${config.BACKEND_URL || config.FRONTEND_URL}/api/wallet/deposit/webhook`;

            const response = await korapay.initializePayment({
                email: user.email,
                name: user.fullName || user.email,
                amount,
                reference,
                redirectUrl,
                notificationUrl
            });

            return {
                transaction,
                checkoutUrl: response.data.checkout_url,
                reference: response.data.reference
            };
        } catch (error) {
            transaction.status = 'failed';
            transaction.metadata.error = error.message || 'Korapay initialization failed';
            await transaction.save();

            throw {
                status: 500,
                message: 'Failed to initialize Korapay payment',
                details: error.message
            };
        }
    }

    /**
     * Verify a wallet deposit via Korapay
     */
    async verifyDeposit(userId, reference) {
        const korapay = require('../utils/korapay');

        // 1. Find the transaction
        const transaction = await WalletTransaction.findOne({ reference, userId });
        if (!transaction) {
            throw { status: 404, message: 'Transaction not found' };
        }

        if (transaction.status !== 'pending') {
            return {
                message: `Transaction is already ${transaction.status}`,
                transaction
            };
        }

        // 2. Verify with Korapay
        try {
            const response = await korapay.verifyPayment(reference);
            const paymentData = response.data;

            if (paymentData.status === 'success') {
                // 3. Credit the wallet with a NEW unique reference
                const newReference = this.generateReference();
                const creditResult = await this.credit(userId, transaction.amount, transaction.description, {
                    type: 'deposit',
                    reference: newReference,
                    paymentGateway: 'korapay',
                    status: 'completed',
                    metadata: {
                        ...transaction.metadata,
                        paidAt: paymentData.paid_at || new Date(),
                        channel: paymentData.payment_type,
                        korapayData: paymentData,
                        originalReference: transaction.reference
                    }
                });

                // Update the original pending transaction record
                transaction.status = 'completed';
                transaction.balanceAfter = creditResult.balanceAfter;
                transaction.metadata = {
                    ...transaction.metadata,
                    verifiedAt: new Date(),
                    korapayData: paymentData
                };
                await transaction.save();

                return {
                    success: true,
                    transaction,
                    newBalance: creditResult.balanceAfter
                };
            } else {
                transaction.status = korapay.getTransactionStatus(paymentData.status);
                transaction.metadata.korapayError = paymentData.status;
                await transaction.save();

                return {
                    success: false,
                    status: transaction.status,
                    message: `Payment ${paymentData.status}`,
                    transaction
                };
            }
        } catch (error) {
            console.error(chalk.red('✗ Deposit verification failed:'), error);
            throw {
                status: 500,
                message: 'Error verifying deposit with Korapay',
                details: error.message
            };
        }
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
     * Get list of banks from Korapay
     */
    async getBanks() {
        const korapay = require('../utils/korapay');
        const response = await korapay.getBanks();

        // Inject Test Bank for sandboxing
        if (response.status && response.data) {
            response.data.unshift({
                name: 'Test Bank (Sandbox)',
                slug: 'test-bank-sandbox',
                code: '001',
                active: true,
                type: 'nuban'
            });
        }

        return response;
    }

    /**
     * Verify account number with bank code via Korapay
     */
    async verifyAccount(accountNumber, bankCode) {
        const korapay = require('../utils/korapay');
        return await korapay.verifyAccount(accountNumber, bankCode);
    }

    /**
     * Request withdrawal
     */
    async requestWithdrawal(userId, amount) {
        const RewardSettings = require('../models/RewardSettings');
        const korapay = require('../utils/korapay');
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

        if (!user.isVerified) {
            throw {
                status: 403,
                message: 'Only verified users can withdraw funds'
            };
        }

        if (user.role === 'seller' && !user.adminVerified) {
            throw {
                status: 403,
                message: 'Your seller account is pending admin verification. Please wait for approval.'
            };
        }

        if (!user.bankAccount || !user.bankAccount.accountNumber || !user.bankAccount.bankCode) {
            throw {
                status: 400,
                message: 'Please update your bank information before withdrawing'
            };
        }

        // 3. Calculate withdrawal fee based on user role
        const feePercentage = user.role === 'seller' ? 0.03 : 0.015; // 3% for sellers, 1.5% for buyers
        const feeAmount = Math.round(amount * feePercentage * 100) / 100;
        const amountAfterFee = Math.round((amount - feeAmount) * 100) / 100;

        if (amountAfterFee <= 0) {
            throw {
                status: 400,
                message: 'Withdrawal amount too low after fee deduction'
            };
        }

        // 4. Record the debit first (set as pending) - debit the FULL original amount
        const debitResult = await this.debit(userId, amount, 'Wallet withdrawal', {
            type: 'withdrawal',
            status: 'pending',
            requestedAt: new Date(),
            minWithdrawalLimit: settings.withdrawal.minAmount,
            bankName: user.bankAccount.bankName,
            accountNumber: user.bankAccount.accountNumber,
            originalAmount: amount,
            feePercentage: feePercentage * 100,
            feeAmount: feeAmount,
            amountAfterFee: amountAfterFee
        });

        const transaction = debitResult.transaction;

        // Update transaction to show the amount user receives (after fee), not the debit amount
        // This is for display purposes in withdrawal history
        transaction.amount = amountAfterFee;
        transaction.metadata.walletDebitAmount = amount;
        transaction.markModified('metadata');
        await transaction.save();

        // 5. Initiate Korapay payout
        try {
            const isSandbox = user.bankAccount.bankCode === '001';
            let payoutData;

            if (isSandbox) {
                console.log(chalk.yellow(`ℹ Sandbox: Simulating Korapay payout of ₦${amountAfterFee}`));
                payoutData = {
                    data: {
                        reference: transaction.reference,
                        status: 'success'
                    }
                };
            } else {
                console.log(chalk.blue(`→ Initiating Korapay payout of ₦${amountAfterFee}...`));
                payoutData = await korapay.initiatePayout({
                    reference: transaction.reference,
                    amount: amountAfterFee,
                    bankCode: user.bankAccount.bankCode,
                    accountNumber: user.bankAccount.accountNumber,
                    accountName: user.bankAccount.accountName || user.fullName,
                    email: user.email,
                    narration: `Withdrawal for ${user.fullName} (${transaction._id})`
                });
            }

            // Update transaction with Korapay payout reference
            transaction.metadata.korapayPayoutReference = payoutData.data.reference;
            transaction.metadata.korapayStatus = payoutData.data.status;
            transaction.paymentGateway = 'korapay';

            const korapayStatus = payoutData.data.status;
            if (korapayStatus === 'success' || isSandbox) {
                transaction.status = 'completed';
            } else if (korapayStatus === 'failed') {
                transaction.status = 'failed';
                transaction.metadata.korapayError = 'Payout failed at initiation';
            } else {
                transaction.status = 'pending';
            }

            transaction.markModified('metadata');
            await transaction.save();

            // Auto-refund if payout failed immediately
            if (transaction.status === 'failed') {
                console.log(chalk.red(`→ Auto refund: Korapay payout failed for ${transaction.reference}`));
                const refundAmount = transaction.metadata.walletDebitAmount || amount;
                const MarketWallet = require('../models/MarketWallet');
                await MarketWallet.findOneAndUpdate(
                    { userId: transaction.userId },
                    { $inc: { balance: refundAmount }, $set: { lastTransactionAt: new Date() } }
                );
                const wallet = await MarketWallet.findOne({ userId: transaction.userId });
                await WalletTransaction.create({
                    userId: transaction.userId,
                    type: 'deposit',
                    amount: refundAmount,
                    balanceBefore: wallet.balance - refundAmount,
                    balanceAfter: wallet.balance,
                    reference: `REV-${transaction.reference}`,
                    description: `Reversal (Payout Failed): ${transaction.description}`,
                    status: 'completed',
                    paymentGateway: 'system',
                    metadata: { originalTransactionId: transaction._id, reason: 'Korapay payout failed' }
                });
            }

            // Send emails
            try {
                const emailService = require('./email.service');
                const config = require('../config/config');
                const feeDetails = {
                    originalAmount: amount,
                    feePercentage: (feePercentage * 100).toFixed(1),
                    feeAmount: feeAmount,
                    amountAfterFee: amountAfterFee
                };

                const userHtml = emailService.withdrawalRequested(user.email, user.fullName || 'User', amount, feeDetails);
                await emailService.sendEmail(user.email, '⏳ Withdrawal Request Received - Sellio Marketplace', userHtml);
                console.log(chalk.blue(`✓ Withdrawal confirmation email sent to ${user.email}`));

                if (config.ADMIN_EMAIL) {
                    const adminHtml = emailService.adminWithdrawalAlert(user.fullName || 'User', user.email, user.role, amount, feeDetails);
                    await emailService.sendEmail(config.ADMIN_EMAIL, `🔔 New Withdrawal Request - ${user.fullName || user.email}`, adminHtml);
                    console.log(chalk.blue(`✓ Admin notified of withdrawal from ${user.email}`));
                }
            } catch (emailError) {
                console.log(chalk.yellow(`⚠ Failed to send withdrawal emails: ${emailError.message}`));
            }

            return { transaction, balanceAfter: debitResult.balanceAfter };

        } catch (error) {
            console.error(chalk.red('✗ Korapay payout initiation failed:'), error);

            if (transaction) {
                transaction.status = 'pending';
                transaction.metadata.korapayError = error.message || 'Payout initiation failed';
                transaction.metadata.requiresManualAction = true;
                transaction.metadata.failedAt = new Date();
                transaction.markModified('metadata');
                await transaction.save();

                console.log(chalk.yellow(`⚠ Withdrawal ${transaction.reference} queued for manual admin review.`));

                return {
                    transaction,
                    balanceAfter: debitResult.balanceAfter,
                    requiresManualAction: true,
                    message: 'Automated payout failed, request queued for manual processing.'
                };
            }

            throw { status: 500, message: `Failed to initiate payout: ${error.message || 'Unknown error'}` };
        }
    }

    /**
     * Process a manual withdrawal request (Admin Only)
     */
    async processManualWithdrawal(transactionId, status, adminData = {}) {
        const notificationService = require('./notification.service');
        const transaction = await WalletTransaction.findById(transactionId);
        if (!transaction) throw { status: 404, message: 'Transaction not found' };

        if (transaction.type !== 'withdrawal') {
            throw { status: 400, message: 'Transaction is not a withdrawal' };
        }

        if (transaction.status !== 'pending') {
            throw { status: 400, message: `Cannot process transaction with status: ${transaction.status}` };
        }

        const { reason, adminId } = adminData;
        const m = transaction.metadata || {};
        const oldM = m.metadata || {};
        const feeDetails = {
            originalAmount: m.originalAmount || oldM.originalAmount || m.walletDebitAmount || transaction.amount,
            feePercentage: m.feePercentage || oldM.feePercentage || 0,
            feeAmount: m.feeAmount || oldM.feeAmount || 0,
            amountAfterFee: m.amountAfterFee || oldM.amountAfterFee || transaction.amount
        };

        if (status === 'completed') {
            transaction.status = 'completed';
            transaction.metadata.manuallyProcessed = true;
            transaction.metadata.processedAt = new Date();
            transaction.metadata.processedBy = adminId;
            transaction.markModified('metadata');
            await transaction.save();

            // Notify user
            const user = await MarketUser.findById(transaction.userId);
            if (user) {
                await notificationService.notifyWithdrawalStatus(user, feeDetails.amountAfterFee, 'approved', null, feeDetails);
            }

            return { success: true, transaction, feeDetails };
        }

        if (status === 'failed') {
            transaction.status = 'failed';
            transaction.metadata.declineReason = reason || 'Declined by admin';
            transaction.metadata.processedAt = new Date();
            transaction.metadata.processedBy = adminId;
            transaction.markModified('metadata');
            await transaction.save();

            // Notify user
            const user = await MarketUser.findById(transaction.userId);
            if (user) {
                await notificationService.notifyWithdrawalStatus(user, feeDetails.originalAmount, 'rejected', reason, feeDetails);
            }

            // Perform the refund - refund the FULL amount that was debited from the wallet
            const m = transaction.metadata || {};
            const oldM = m.metadata || {};
            const refundAmount = m.walletDebitAmount || oldM.originalAmount || transaction.amount;
            console.log(chalk.red(`→ Refunding ₦${refundAmount} to user ${transaction.userId} due to manual decline`));

            const MarketWallet = require('../models/MarketWallet');
            await MarketWallet.findOneAndUpdate(
                { userId: transaction.userId },
                {
                    $inc: { balance: refundAmount },
                    $set: { lastTransactionAt: new Date() }
                }
            );

            // Record a reversal transaction for clarity
            const reversal = await WalletTransaction.create({
                userId: transaction.userId,
                type: 'deposit',
                amount: refundAmount,
                balanceBefore: 0,
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
            reversal.balanceBefore = wallet.balance - refundAmount;
            await reversal.save();

            return { success: true, transaction, reversal, feeDetails, refundAmount };
        }

        throw { status: 400, message: 'Invalid status for manual processing. Use "completed" or "failed".' };
    }

    /**
     * Reconcile pending withdrawals with Korapay
     * Checks all pending withdrawals and updates status based on Korapay response
     */
    async reconcilePendingWithdrawals() {
        const korapay = require('../utils/korapay');
        const notificationService = require('./notification.service');

        // Find all pending withdrawal transactions that have a Korapay payout reference
        const pendingWithdrawals = await WalletTransaction.find({
            type: 'withdrawal',
            status: 'pending',
            'metadata.korapayPayoutReference': { $exists: true, $ne: null }
        });

        console.log(chalk.blue(`Found ${pendingWithdrawals.length} pending withdrawals to reconcile...`));

        const results = {
            total: pendingWithdrawals.length,
            completed: 0,
            failed: 0,
            stillPending: 0,
            errors: 0
        };

        for (const transaction of pendingWithdrawals) {
            try {
                const payoutRef = transaction.metadata.korapayPayoutReference;
                console.log(chalk.blue(`→ Checking payout ${payoutRef} for transaction ${transaction.reference}...`));

                const korapayResponse = await korapay.verifyPayout(payoutRef);
                const korapayStatus = korapayResponse.data.status;

                console.log(chalk.yellow(`  Korapay status for ${payoutRef}: ${korapayStatus}`));

                const getFeeDetails = (t) => {
                    const m = t.metadata || {};
                    return {
                        originalAmount: m.originalAmount || m.walletDebitAmount || t.amount,
                        feePercentage: m.feePercentage || 0,
                        feeAmount: m.feeAmount || 0,
                        amountAfterFee: m.amountAfterFee || t.amount
                    };
                };

                if (korapayStatus === 'success') {
                    transaction.status = 'completed';
                    transaction.metadata.korapayStatus = korapayStatus;
                    transaction.metadata.reconciledAt = new Date();
                    transaction.markModified('metadata');
                    await transaction.save();

                    const user = await MarketUser.findById(transaction.userId);
                    if (user) {
                        await notificationService.notifyWithdrawalStatus(user, getFeeDetails(transaction).amountAfterFee, 'approved', null, getFeeDetails(transaction));
                    }

                    results.completed++;
                    console.log(chalk.green(`  ✓ Transaction ${transaction.reference} marked as completed`));

                } else if (korapayStatus === 'failed') {
                    transaction.status = 'failed';
                    transaction.metadata.korapayStatus = korapayStatus;
                    transaction.metadata.korapayError = 'Payout failed';
                    transaction.metadata.reconciledAt = new Date();
                    transaction.markModified('metadata');
                    await transaction.save();

                    const m = transaction.metadata || {};
                    const refundAmount = m.walletDebitAmount || m.originalAmount || transaction.amount;
                    const MarketWallet = require('../models/MarketWallet');
                    await MarketWallet.findOneAndUpdate(
                        { userId: transaction.userId },
                        { $inc: { balance: refundAmount }, $set: { lastTransactionAt: new Date() } }
                    );

                    const wallet = await MarketWallet.findOne({ userId: transaction.userId });
                    await WalletTransaction.create({
                        userId: transaction.userId,
                        type: 'deposit',
                        amount: refundAmount,
                        balanceBefore: wallet.balance - refundAmount,
                        balanceAfter: wallet.balance,
                        reference: `REV-${transaction.reference}`,
                        description: `Reversal (Payout Failed): ${transaction.description}`,
                        status: 'completed',
                        paymentGateway: 'system',
                        metadata: { originalTransactionId: transaction._id, reason: 'Korapay payout failed', korapayPayoutReference: payoutRef }
                    });

                    const user = await MarketUser.findById(transaction.userId);
                    if (user) {
                        await notificationService.notifyWithdrawalStatus(user, getFeeDetails(transaction).amountAfterFee, 'rejected', 'Payout failed - funds refunded', getFeeDetails(transaction));
                    }

                    results.failed++;
                    console.log(chalk.red(`  ✗ Transaction ${transaction.reference} failed and refunded`));

                } else {
                    results.stillPending++;
                    console.log(chalk.yellow(`  ⏳ Transaction ${transaction.reference} still ${korapayStatus}`));
                }

            } catch (error) {
                results.errors++;
                console.error(chalk.red(`  ✗ Error reconciling ${transaction.reference}: ${error.message}`));
            }
        }

        console.log(chalk.green(`\nReconciliation complete: ${results.completed} completed, ${results.failed} failed, ${results.stillPending} still pending, ${results.errors} errors`));
        return results;
    }

    /**
     * Purchase trusted badge for seller
     * Cost: 3500 Naira
     * Duration: 1 year
     */
    async purchaseTrustedBadge(userId) {
        const { MarketUser } = require('../models/MarketUser');
        const TRUSTED_BADGE_COST = 3500;
        const BADGE_DURATION_DAYS = 365;

        const user = await MarketUser.findById(userId);
        
        if (!user) {
            throw { status: 404, message: 'User not found' };
        }

        if (user.role !== 'seller') {
            throw { status: 403, message: 'Only sellers can purchase trusted badge' };
        }

        if (user.isTrustedSeller) {
            const now = new Date();
            if (user.trustedBadgeAwardedAt) {
                const expiryDate = new Date(user.trustedBadgeAwardedAt);
                expiryDate.setFullYear(expiryDate.getFullYear() + 1);
                
                if (now < expiryDate) {
                    throw { 
                        status: 400, 
                        message: 'You already have an active trusted badge',
                        expiresAt: expiryDate
                    };
                }
            }
        }

        const wallet = await this.getBalance(userId);
        if (wallet.balance < TRUSTED_BADGE_COST) {
            throw {
                status: 400,
                message: `Insufficient wallet balance. Required: ₦${TRUSTED_BADGE_COST}, Available: ₦${wallet.balance}`
            };
        }

        const debitResult = await this.debit(userId, TRUSTED_BADGE_COST, 'Trusted badge purchase', {
            type: 'payment',
            status: 'completed',
            metadata: {
                badgePurchase: true,
                purchaseDate: new Date()
            }
        });

        user.isTrustedSeller = true;
        user.trustedBadgeAwardedAt = new Date();
        await user.save();

        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);

        console.log(chalk.green(`✓ Trusted badge purchased for seller ${userId}, expires: ${expiresAt}`));

        return {
            success: true,
            message: 'Trusted badge purchased successfully',
            isTrustedSeller: user.isTrustedSeller,
            purchasedAt: user.trustedBadgeAwardedAt,
            expiresAt: expiresAt,
            amountPaid: TRUSTED_BADGE_COST,
            newBalance: debitResult.balanceAfter
        };
    }

    /**
     * Check and expire trusted badges that have exceeded 1 year
     */
    async checkAndExpireBadges() {
        const { MarketUser } = require('../models/MarketUser');
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const expiredSellers = await MarketUser.find({
            role: 'seller',
            isTrustedSeller: true,
            trustedBadgeAwardedAt: { $lte: oneYearAgo }
        });

        for (const seller of expiredSellers) {
            seller.isTrustedSeller = false;
            seller.trustedBadgeAwardedAt = null;
            await seller.save();
            console.log(chalk.yellow(`⚠ Trusted badge expired for seller ${seller._id}`));
        }

        return {
            checked: expiredSellers.length,
            expired: expiredSellers.length
        };
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
