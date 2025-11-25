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
}

module.exports = new WalletController();
