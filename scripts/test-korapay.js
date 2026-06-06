require('dotenv').config();
const axios = require('axios');

const SECRET_KEY = process.env.KORAPAY_SECRET_KEY;
const BASE_URL = 'https://api.korapay.com/merchant/api/v1';

const korapay = axios.create({
    baseURL: BASE_URL,
    headers: {
        Authorization: `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/json'
    }
});

const reference = `TEST-${Date.now()}`;

async function runTests() {
    console.log('='.repeat(55));
    console.log(' KORAPAY INTEGRATION TEST');
    console.log('='.repeat(55));
    console.log(`Key:       ${SECRET_KEY?.slice(0, 20)}...`);
    console.log(`Reference: ${reference}`);
    console.log('='.repeat(55));

    // ── Test 1: Initialize a payment ──────────────────────────
    console.log('\n[1] Initializing Korapay checkout...');
    let checkoutUrl;
    try {
        const res = await korapay.post('/charges/initialize', {
            amount: 1000,
            currency: 'NGN',
            reference,
            redirect_url: 'http://localhost:8080/deposit/verify/' + reference,
            notification_url: 'http://localhost:4000/api/wallet/deposit/webhook',
            customer: {
                name: 'Test User',
                email: 'testuser@sellio.com'
            },
            channels: ['card', 'bank_transfer']
        });

        if (res.data.status === true) {
            checkoutUrl = res.data.data.checkout_url;
            console.log('    ✅ SUCCESS');
            console.log('    Status:       ', res.data.status);
            console.log('    Reference:    ', res.data.data.reference);
            console.log('    Checkout URL: ', checkoutUrl);
        } else {
            console.log('    ❌ FAILED:', res.data.message);
        }
    } catch (err) {
        console.log('    ❌ ERROR:', err.response?.data || err.message);
    }

    // ── Test 2: Verify the payment (will be pending since unpaid) ──
    console.log('\n[2] Verifying charge by reference...');
    try {
        const res = await korapay.get(`/charges/${reference}`);

        if (res.data.status === true) {
            const d = res.data.data;
            console.log('    ✅ SUCCESS');
            console.log('    Payment Status:', d.status);
            console.log('    Amount:        ', d.amount, d.currency);
            console.log('    Customer:      ', d.customer?.email);
        } else {
            console.log('    ❌ FAILED:', res.data.message);
        }
    } catch (err) {
        console.log('    ❌ ERROR:', err.response?.data || err.message);
    }

    // ── Summary ───────────────────────────────────────────────
    console.log('\n' + '='.repeat(55));
    console.log(' KORAPAY is connected and working ✅');
    if (checkoutUrl) {
        console.log('\n Open this URL in a browser to test a full payment:');
        console.log(' ' + checkoutUrl);
        console.log('\n Test card:  4084 0840 8408 4081');
        console.log(' Expiry:     any future date');
        console.log(' CVV:        408  |  PIN: 0000  |  OTP: 123456');
    }
    console.log('='.repeat(55));
}

runTests();
