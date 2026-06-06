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
 * Verify a Paystack transfer by ID
 */
const verifyTransfer = async (transferId) => {
    try {
        const response = await paystack.get(`/transfer/${transferId}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * List transfers with optional filters
 */
const listTransfers = async (params = {}) => {
    try {
        const response = await paystack.get('/transfer', { params });
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
    verifyTransaction,
    verifyTransfer,
    listTransfers,
    getTransactionStatus
};
