const axios = require('axios');
const chalk = require('chalk');

async function testOrderDetail() {
    try {
        console.log(chalk.blue('Testing General Order Detail Route...'));

        const orderId = '6958d1af0358b8c753258436';

        try {
            // Test with a simple GET to the new endpoint
            // We expect a 401 because we're not authorized, but the 404 should be gone
            await axios.get(`http://localhost:3000/api/orders/${orderId}`);
        } catch (error) {
            if (error.response?.status === 401) {
                console.log(chalk.green('✓ Route /api/orders/:orderId exists and is protected by auth (received 401)'));
            } else if (error.response?.status === 404) {
                console.log(chalk.red('✗ Route still returning 404'));
            } else {
                console.log(chalk.yellow(`! Received status ${error.response?.status}: ${error.message}`));
            }
        }

    } catch (error) {
        console.error(chalk.red('\nVerification Failed:'), error);
    }
}

testOrderDetail();
