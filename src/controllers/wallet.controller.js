const walletService = require('../services/wallet.service');
const chalk = require('chalk');

class WalletController {
    /**
     * Get wallet balance
     * GET /api/wallet/balance
     */
    async getBalance(req, res) {
        try {
            const balance = await walletService.getBalance(req.user._id);
            console.log(chalk.green('✓ Wallet balance retrieved successfully'));
            res.json(balance);
        } catch (error) {
            console.error(chalk.red('✗ Get balance failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Get transaction history
     * GET /api/wallet/transactions
     */
    async getTransactions(req, res) {
        try {
            const result = await walletService.getTransactions(req.user._id, req.query);
            console.log(chalk.green(`✓ Retrieved ${result.transactions.length} transactions`));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Get transactions failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Get all transactions (Admin only)
     * GET /api/wallet/admin/transactions
     */
    async getAllTransactions(req, res) {
        try {
            const result = await walletService.getAllTransactions(req.query);
            console.log(chalk.green(`✓ Admin retrieved ${result.transactions.length} global transactions`));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Admin get all transactions failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Get wallet summary with statistics
     * GET /api/wallet/summary
     */
    async getSummary(req, res) {
        try {
            const summary = await walletService.getWalletSummary(req.user._id);
            console.log(chalk.green('✓ Wallet summary retrieved successfully'));
            res.json(summary);
        } catch (error) {
            console.error(chalk.red('✗ Get summary failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Credit wallet (for testing/manual operations)
     * POST /api/wallet/credit
     * Admin only endpoint
     */
    async creditWallet(req, res) {
        try {
            const { userId, amount, description } = req.body;

            if (!userId || !amount || !description) {
                return res.status(400).json({
                    message: 'Missing required fields: userId, amount, description'
                });
            }

            const result = await walletService.credit(userId, amount, description, {
                type: 'deposit',
                paymentGateway: 'manual'
            });

            console.log(chalk.green('✓ Wallet credited successfully'));
            res.json({
                message: 'Wallet credited successfully',
                balanceBefore: result.balanceBefore,
                balanceAfter: result.balanceAfter,
                transaction: result.transaction
            });
        } catch (error) {
            console.error(chalk.red('✗ Credit wallet failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Debit wallet (for testing/manual operations)
     * POST /api/wallet/debit
     * Admin only endpoint
     */
    async debitWallet(req, res) {
        try {
            const { userId, amount, description } = req.body;

            if (!userId || !amount || !description) {
                return res.status(400).json({
                    message: 'Missing required fields: userId, amount, description'
                });
            }

            const result = await walletService.debit(userId, amount, description, {
                type: 'withdrawal',
                paymentGateway: 'manual'
            });

            console.log(chalk.green('✓ Wallet debited successfully'));
            res.json({
                message: 'Wallet debited successfully',
                balanceBefore: result.balanceBefore,
                balanceAfter: result.balanceAfter,
                transaction: result.transaction
            });
        } catch (error) {
            console.error(chalk.red('✗ Debit wallet failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Verify transaction by reference
     * GET /api/wallet/transaction/:reference
     */
    async verifyTransaction(req, res) {
        try {
            const transaction = await walletService.verifyTransaction(req.params.reference);
            console.log(chalk.green('✓ Transaction verified successfully'));
            res.json(transaction);
        } catch (error) {
            console.error(chalk.red('✗ Verify transaction failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Get list of banks
     * GET /api/wallet/banks
     */
    async getBanks(req, res) {
        try {
            const banks = await walletService.getBanks();
            res.json(banks);
        } catch (error) {
            console.error(chalk.red('✗ Fetching banks failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Verify account number
     * POST /api/wallet/verify-account
     */
    async verifyAccount(req, res) {
        try {
            const { accountNumber, bankCode } = req.body;
            if (!accountNumber || !bankCode) {
                return res.status(400).json({ message: 'Account number and bank code are required' });
            }

            const verification = await walletService.verifyAccount(accountNumber, bankCode);
            res.json(verification);
        } catch (error) {
            console.error(chalk.red('✗ Account verification failed:', error.message));
            res.status(error.status || 400).json({ message: error.message });
        }
    }

    /**
     * Request withdrawal
     * POST /api/wallet/withdraw
     */
    async requestWithdrawal(req, res) {
        try {
            const { amount } = req.body;
            if (!amount) {
                return res.status(400).json({ message: 'Amount is required' });
            }

            const result = await walletService.requestWithdrawal(req.user._id, amount);
            console.log(chalk.green('✓ Withdrawal request processed successfully'));

            const metadata = result.transaction.metadata || {};
            res.json({
                message: result.message || 'Withdrawal request processed successfully',
                transaction: result.transaction,
                newBalance: result.balanceAfter,
                requiresManualAction: result.requiresManualAction || false,
                feeDetails: {
                    originalAmount: metadata.originalAmount || amount,
                    feePercentage: metadata.feePercentage || (req.user.role === 'seller' ? 3 : 1.5),
                    feeAmount: metadata.feeAmount || 0,
                    amountAfterFee: metadata.amountAfterFee || result.balanceAfter
                }
            });
        } catch (error) {
            console.error(chalk.red('✗ Withdrawal failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Initialize wallet deposit
     * POST /api/wallet/deposit/initialize
     */
    async initializeDeposit(req, res) {
        try {
            const { amount } = req.body;
            if (!amount || amount <= 0) {
                return res.status(400).json({ message: 'A valid amount is required' });
            }

            const result = await walletService.initializeDeposit(req.user._id, amount);
            console.log(chalk.green('✓ Wallet deposit initialized successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Initialize deposit failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Verify wallet deposit
     * GET /api/wallet/deposit/verify/:reference
     */
    async verifyDeposit(req, res) {
        try {
            const { reference } = req.params;
            if (!reference) {
                return res.status(400).json({ message: 'Transaction reference is required' });
            }

            const result = await walletService.verifyDeposit(req.user._id, reference);

            if (result.success) {
                console.log(chalk.green('✓ Wallet deposit verified and credited successfully'));
                res.json(result);
            } else {
                console.log(chalk.yellow('⚠ Wallet deposit verification failed:', result.message));
                res.status(400).json(result);
            }
        } catch (error) {
            console.error(chalk.red('✗ Verify deposit failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Approve a pending withdrawal (Admin Only)
     * POST /api/wallet/admin/withdrawals/:transactionId/approve
     */
    async approveWithdrawal(req, res) {
        try {
            const { transactionId } = req.params;
            const result = await walletService.processManualWithdrawal(transactionId, 'completed', {
                adminId: req.user._id
            });

            console.log(chalk.green('✓ Withdrawal approved manually'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Manual approval failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Decline a pending withdrawal (Admin Only)
     * POST /api/wallet/admin/withdrawals/:transactionId/decline
     */
    async declineWithdrawal(req, res) {
        try {
            const { transactionId } = req.params;
            const { reason } = req.body;

            if (!reason) {
                return res.status(400).json({ message: 'A reason for declining is required' });
            }

            const result = await walletService.processManualWithdrawal(transactionId, 'failed', {
                reason,
                adminId: req.user._id
            });

            console.log(chalk.green('✓ Withdrawal declined manually'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Manual decline failed:'), error.message);
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Purchase trusted badge
     * POST /api/wallet/trusted-badge/purchase
     */
    async purchaseTrustedBadge(req, res) {
        try {
            const result = await walletService.purchaseTrustedBadge(req.user._id);
            console.log(chalk.green('✓ Trusted badge purchased successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Purchase trusted badge failed:'), error.message);
            res.status(error.status || 500).json({ 
                message: error.message,
                expiresAt: error.expiresAt 
            });
        }
    }
}

module.exports = new WalletController();
