const express = require('express');
const router = express.Router();
const { auth, isAdmin, isStaff } = require('../middleware/auth');
const walletController = require('../controllers/wallet.controller');

/**
 * @route   GET /api/wallet/balance
 * @desc    Get wallet balance
 * @access  Private (All authenticated users)
 */
router.get('/balance', auth, walletController.getBalance);

/**
 * @route   GET /api/wallet/transactions
 * @desc    Get wallet transaction history
 * @access  Private (All authenticated users)
 */
router.get('/transactions', auth, walletController.getTransactions);

/**
 * @route   GET /api/wallet/summary
 * @desc    Get wallet summary with statistics
 * @access  Private (All authenticated users)
 */
router.get('/summary', auth, walletController.getSummary);

/**
 * @route   GET /api/wallet/admin/transactions
 * @desc    Get all transactions across the system (Admin only)
 * @access  Private (Admin)
 */
router.get('/admin/transactions', auth, isAdmin, walletController.getAllTransactions);

/**
 * @route   GET /api/wallet/transaction/:reference
 * @desc    Verify transaction by reference
 * @access  Private (All authenticated users)
 */
router.get('/transaction/:reference', auth, walletController.verifyTransaction);

/**
 * @route   GET /api/wallet/banks
 * @desc    Get list of supported banks
 * @access  Private
 */
router.get('/banks', auth, walletController.getBanks);

/**
 * @route   POST /api/wallet/verify-account
 * @desc    Verify bank account details
 * @access  Private
 */
router.post('/verify-account', auth, walletController.verifyAccount);

/**
 * @route   POST /api/wallet/credit
 * @desc    Credit a user's wallet (Admin only)
 * @access  Private (Admin)
 */
router.post('/credit', auth, isAdmin, walletController.creditWallet);

/**
 * @route   POST /api/wallet/debit
 * @desc    Debit a user's wallet (Admin only)
 * @access  Private (Admin)
 */
router.post('/debit', auth, isAdmin, walletController.debitWallet);

/**
 * @route   POST /api/wallet/withdraw
 * @desc    Request a withdrawal
 * @access  Private (Sellers and Admins only)
 */
router.post('/withdraw', auth, isStaff, walletController.requestWithdrawal);

/**
 * @route   POST /api/wallet/admin/withdrawals/:transactionId/approve
 * @desc    Approve a pending withdrawal manually (Admin only)
 * @access  Private (Admin)
 */
router.post('/admin/withdrawals/:transactionId/approve', auth, isAdmin, walletController.approveWithdrawal);

/**
 * @route   POST /api/wallet/admin/withdrawals/:transactionId/decline
 * @desc    Decline a pending withdrawal manually (Admin only)
 * @access  Private (Admin)
 */
router.post('/admin/withdrawals/:transactionId/decline', auth, isAdmin, walletController.declineWithdrawal);

module.exports = router;
