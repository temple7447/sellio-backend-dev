const axios = require('axios');
const chalk = require('chalk');

async function getTestToken() {
    const BASE_URL = 'http://localhost:4000/api';
    try {
        console.log(chalk.blue('→ Logging in as test_seller1@example.com...'));
        const response = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'test_seller1@example.com',
            password: 'password123'
        });

        const token = response.data.token;
        console.log(chalk.green('✓ Login successful!'));
        console.log(chalk.yellow('\nCopy the token below and add it to your .env as TEST_AUTH_TOKEN:'));
        console.log(chalk.cyan(token));
        
    } catch (error) {
        console.error(chalk.red('✗ Login failed:'));
        console.error(error.response?.data || error.message);
    }
}

getTestToken();
