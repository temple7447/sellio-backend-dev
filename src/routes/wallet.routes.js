const express = require('express');
const router = express.Router();
const { auth, isAdmin } = require('../middleware/auth');
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
 * @route   GET /api/wallet/transaction/:reference
 * @desc    Verify transaction by reference
 * @access  Private (All authenticated users)
 */
router.get('/transaction/:reference', auth, walletController.verifyTransaction);

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

module.exports = router;
