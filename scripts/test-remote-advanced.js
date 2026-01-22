const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs');
const FormData = require('form-data');

const BASE_URL = 'https://selliomarketplace.space';

async function runAdvancedTest() {
    console.log(chalk.blue(`--- Running Advanced Remote Tests on ${BASE_URL} ---`));

    // 1. Root Health Check
    console.log(chalk.blue('\n1. Testing Root Endpoint...'));
    try {
        const res = await axios.get(`${BASE_URL}/`);
        console.log(chalk.green('✓ Root Success:'), res.data.message);
    } catch (error) {
        console.log(chalk.red('✗ Root Failed:'), error.message);
    }

    // 2. Public Products
    console.log(chalk.blue('\n2. Testing Public Products API...'));
    try {
        const res = await axios.get(`${BASE_URL}/api/products/public?limit=1`);
        console.log(chalk.green('✓ Products Success: Found'), res.data.pagination.total, 'products');
    } catch (error) {
        console.log(chalk.red('✗ Products Failed:'), error.message);
    }

    // 3. Public Categories
    console.log(chalk.blue('\n3. Testing Categories API...'));
    try {
        // Find categories endpoint from list_dir earlier
        const res = await axios.get(`${BASE_URL}/api/categories`);
        console.log(chalk.green('✓ Categories Success: Found'), res.data.length, 'categories');
    } catch (error) {
        console.log(chalk.red('✗ Categories Failed:'), error.message);
    }

    // 4. Large Image Upload (INTEGRATION TEST)
    // We'll hit an endpoint that requires authentication but we'll check the REJECTION reason.
    // If it's 401 Unauthorized, the size was likely accepted by the reverse proxy/load balancer.
    // If it's "Payload Too Large" or "File size too large", we know the limit is being enforced.

    console.log(chalk.blue('\n4. Testing 10MB Upload Rejection (Integration)...'));

    // Create a 11MB dummy buffer
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
    const form = new FormData();
    form.append('proof', largeBuffer, 'too-large.jpg');

    try {
        console.log(chalk.blue('Sending 11MB file to fulfillment endpoint...'));
        // Any order itemId would do, we just want to see the error
        await axios.post(`${BASE_URL}/api/orders/seller/mock-id/shipped`, form, {
            headers: {
                ...form.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
    } catch (error) {
        const status = error.response ? error.response.status : 'NO_RESPONSE';
        const message = error.response ? (error.response.data.message || error.response.statusText) : error.message;

        console.log(chalk.blue(`Response Status: ${status}`));
        console.log(chalk.blue(`Response Message: ${message}`));

        if (status === 401) {
            console.log(chalk.green('✓ Upload verified: Server accepted 11MB payload but rejected authentication (which is expected). This means the size limit is NOT being hit at the server/cloud level for 11MB.'));
        } else if (message.includes('too large') || status === 413) {
            console.log(chalk.yellow('ℹ Upload verified: Server rejected file for being too large. This confirms the 10MB limit is working.'));
        } else {
            console.log(chalk.yellow('ℹ Server responded with:'), message);
        }
    }

    console.log(chalk.blue('\n--- Advanced Reporting Complete ---'));
}

runAdvancedTest();
