const axios = require('axios');
const config = require('../config/config');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const SECRET_KEY = config.PAYSTACK_SECRET_KEY;

const paystack = axios.create({
    baseURL: PAYSTACK_BASE_URL,
    headers: {
        Authorization: `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/json'
    }
});

const getBanks = async () => {
    try {
        const response = await paystack.get('/bank?currency=NGN');
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

const verifyAccountNumber = async (accountNumber, bankCode) => {
    try {
        const response = await paystack.get(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

const createTransferRecipient = async (name, accountNumber, bankCode) => {
    try {
        const response = await paystack.post('/transferrecipient', {
            type: 'nuban',
            name: name,
            account_number: accountNumber,
            bank_code: bankCode,
            currency: 'NGN'
        });
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

const initiateTransfer = async (amount, recipientCode, reason) => {
    try {
        const response = await paystack.post('/transfer', {
            source: 'balance',
            amount: amount * 100, // Paystack amount is in kobo
            recipient: recipientCode,
            reason: reason || 'Withdrawal from Sellio'
        });
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Initialize a Paystack transaction
 */
const initializeTransaction = async (email, amount, reference, callbackUrl) => {
    try {
        const response = await paystack.post('/transaction/initialize', {
            email,
            amount: Math.round(amount * 100), // Convert to kobo
            reference,
            callback_url: callbackUrl
        });
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Verify a Paystack transaction by reference
 */
const verifyTransaction = async (reference) => {
    try {
        const response = await paystack.get(`/transaction/verify/${reference}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Map Paystack status to system status
 */
const getTransactionStatus = (paystackStatus) => {
    switch (paystackStatus) {
        case 'success':
            return 'completed';
        case 'failed':
            return 'failed';
        case 'abandoned':
            return 'failed';
        default:
            return 'pending';
    }
};

module.exports = {
    getBanks,
    verifyAccountNumber,
    createTransferRecipient,
    initiateTransfer,
    initializeTransaction,
    verifyTransaction,
    getTransactionStatus
};
