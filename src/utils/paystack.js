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

module.exports = {
    getBanks,
    verifyAccountNumber,
    createTransferRecipient,
    initiateTransfer
};
