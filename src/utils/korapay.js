const axios = require('axios');
const config = require('../config/config');

const KORAPAY_BASE_URL = 'https://api.korapay.com/merchant/api/v1';

const korapay = axios.create({
    baseURL: KORAPAY_BASE_URL,
    headers: {
        Authorization: `Bearer ${config.KORAPAY_SECRET_KEY}`,
        'Content-Type': 'application/json'
    }
});

/**
 * Initialize a Korapay checkout session (deposit)
 */
const initializePayment = async ({ email, name, amount, reference, redirectUrl, notificationUrl }) => {
    try {
        const response = await korapay.post('/charges/initialize', {
            amount,
            currency: 'NGN',
            reference,
            redirect_url: redirectUrl,
            notification_url: notificationUrl,
            customer: { name, email },
            channels: ['card', 'bank_transfer']
        });
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Verify a Korapay charge by reference (deposit)
 */
const verifyPayment = async (reference) => {
    try {
        const response = await korapay.get(`/charges/${reference}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Initiate a payout (withdrawal) to a bank account
 */
const initiatePayout = async ({ reference, amount, bankCode, accountNumber, accountName, email, narration }) => {
    try {
        const response = await korapay.post('/payouts', {
            reference,
            destination: {
                type: 'bank_account',
                amount,
                currency: 'NGN',
                narration: narration || 'Withdrawal from Sellio Marketplace',
                bank_account: {
                    bank: bankCode,
                    account: accountNumber
                },
                customer: {
                    name: accountName,
                    email
                }
            }
        });
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Verify a payout status by reference
 */
const verifyPayout = async (reference) => {
    try {
        const response = await korapay.get(`/payouts/${reference}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Get list of supported banks
 */
const getBanks = async () => {
    try {
        const response = await korapay.get('/misc/banks?currency=NGN');
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Resolve / verify a bank account number
 */
const verifyAccount = async (accountNumber, bankCode) => {
    try {
        const response = await korapay.post('/misc/banks/resolve', {
            bank: bankCode,
            account: accountNumber
        });
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Map Korapay status to internal status
 */
const getTransactionStatus = (korapayStatus) => {
    switch (korapayStatus) {
        case 'success':
            return 'completed';
        case 'failed':
            return 'failed';
        case 'expired':
            return 'failed';
        default:
            return 'pending';
    }
};

module.exports = {
    initializePayment,
    verifyPayment,
    initiatePayout,
    verifyPayout,
    getBanks,
    verifyAccount,
    getTransactionStatus
};
