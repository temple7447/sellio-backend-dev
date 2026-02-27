const axios = require('axios');
const FormData = require('form-data');
const chalk = require('chalk');

const BASE_URL = 'https://selliomarketplace.space';
const ORDER_ITEM_ID = '69725f4633718919630da96b';

async function testUpload(sizeMB) {
    console.log(chalk.blue(`\n--- Testing ${sizeMB}MB Upload ---`));

    const sizeBytes = Math.round(sizeMB * 1024 * 1024);
    const buffer = Buffer.alloc(sizeBytes, 'a');

    const form = new FormData();
    form.append('proof', buffer, { filename: 'test-size.jpg', contentType: 'image/jpeg' });

    try {
        const response = await axios.post(`${BASE_URL}/api/orders/seller/${ORDER_ITEM_ID}/fulfillment-proof`, form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': 'Bearer INVALID_TOKEN'
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        console.log(chalk.green(`✓ Success: Received response with status ${response.status}`));
    } catch (error) {
        if (error.response) {
            const status = error.response.status;
            if (status === 413) {
                console.log(chalk.red(`❌ Rejected: Status 413 (Infrastructure/Nginx limit still blocking).`));
            } else if (status === 401) {
                console.log(chalk.green(`✓ PASS: File reached the Server (Rejected by Auth, but passed size check!).`));
            } else {
                console.log(chalk.yellow(`⚠ Status ${status}: ${JSON.stringify(error.response.data)}`));
            }
        } else {
            console.log(chalk.red(`❌ Network Error: ${error.message}`));
        }
    }
}

async function run() {
    console.log(chalk.blue('=== Final Remote Limit Verification ==='));

    // 1. Baseline: 4MB (Always passed)
    // await testUpload(4);

    // 2. Target: 9.5MB (Previously failed with 413, now should pass Nginx)
    await testUpload(9.5);

    process.exit(0);
}

run();
