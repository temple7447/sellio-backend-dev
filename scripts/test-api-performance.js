const axios = require('axios');
const chalk = require('chalk');

const BASE_URL = 'https://selliomarketplace.space';

async function runPerformanceTest() {
    console.log(chalk.blue(`--- Running API Performance & Load Test on ${BASE_URL} ---`));

    const endpoints = [
        { name: 'Root Endpoint', url: '/' },
        { name: 'Public Products', url: '/api/products/public?limit=20' },
        { name: 'Trending Products', url: '/api/products/trending' },
        { name: 'Categories', url: '/api/categories' }
    ];

    for (const endpoint of endpoints) {
        console.log(chalk.blue(`\nTesting ${endpoint.name}...`));
        const start = Date.now();
        try {
            const response = await axios.get(`${BASE_URL}${endpoint.url}`);
            const duration = Date.now() - start;
            console.log(chalk.green(`✓ Success: Status ${response.status}`));
            console.log(chalk.green(`✓ Latency: ${duration}ms`));

            if (duration > 1000) {
                console.log(chalk.yellow('⚠ Warning: Response time is over 1s. Consider optimizing.'));
            } else if (duration > 500) {
                console.log(chalk.yellow('ℹ Info: Response time is between 500ms and 1s.'));
            } else {
                console.log(chalk.green('✓ Performance: Fast response (<500ms).'));
            }
        } catch (error) {
            console.log(chalk.red(`✗ Failed: ${error.message}`));
        }
    }

    // Small Load Test: 10 concurrent requests to public products
    console.log(chalk.blue('\n--- Small Load Test: 10 Concurrent Requests (Public Products) ---'));
    const startLoad = Date.now();
    try {
        const requests = Array(10).fill().map(() => axios.get(`${BASE_URL}/api/products/public?limit=10`));
        const results = await Promise.all(requests);
        const durationLoad = Date.now() - startLoad;
        console.log(chalk.green(`✓ Load Test Success: 10 requests completed in ${durationLoad}ms`));
        console.log(chalk.green(`✓ Average Latency under load: ${Math.round(durationLoad / 10)}ms`));
    } catch (error) {
        console.log(chalk.red(`✗ Load Test Failed: ${error.message}`));
    }

    console.log(chalk.blue('\n--- Performance Reporting Complete ---'));
    process.exit(0);
}

runPerformanceTest();
