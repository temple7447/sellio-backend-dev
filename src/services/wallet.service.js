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
        return await paystack.getBanks();
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
            console.log(chalk.blue('→ Creating Paystack transfer recipient...'));
            const recipient = await paystack.createTransferRecipient(
                user.bankAccount.accountName || user.fullName,
                user.bankAccount.accountNumber,
                user.bankAccount.bankCode
            );
            recipientCode = recipient.data.recipient_code;

            // Save recipient code for future use
            user.bankAccount.recipientCode = recipientCode;
            await user.save();
        }

        // 4. Record the debit first (set as pending)
        const transaction = await this.debit(userId, amount, 'Wallet withdrawal', {
            type: 'withdrawal',
            status: 'pending',
            metadata: {
                requestedAt: new Date(),
                minWithdrawalLimit: settings.withdrawal.minAmount,
                bankName: user.bankAccount.bankName,
                accountNumber: user.bankAccount.accountNumber
            }
        });

        // 5. Initiate Paystack transfer
        try {
            console.log(chalk.blue(`→ Initiating Paystack transfer of ₦${amount}...`));
            const transfer = await paystack.initiateTransfer(
                amount,
                recipientCode,
                `Withdrawal for ${user.fullName} (${transaction._id})`
            );

            // Update transaction with Paystack reference
            transaction.metadata.paystackTransferCode = transfer.data.transfer_code;
            transaction.metadata.paystackReference = transfer.data.reference;
            await transaction.save();

            return {
                transaction,
                balanceAfter: user.wallet?.balance || 0 // Assuming balance is updated by debit()
            };
        } catch (error) {
            console.error(chalk.red('✗ Paystack transfer initiation failed:'), error);

            // If transfer initiation fails, we should probably reverse the debit 
            // or mark it as failed so user can try again.
            transaction.status = 'failed';
            transaction.metadata.error = error.message || 'Transfer initiation failed';
            await transaction.save();

            // Refund the user's wallet
            const Wallet = require('../models/Wallet');
            await Wallet.findOneAndUpdate(
                { userId },
                { $inc: { balance: amount } }
            );

            throw {
                status: 500,
                message: `Failed to initiate transfer: ${error.message || 'Unknown error'}`
            };
        }
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
