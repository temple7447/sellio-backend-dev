const paystack = require('./src/utils/paystack');
const chalk = require('chalk');

async function listBanks() {
    try {
        console.log(chalk.blue('Fetching Bank List from Paystack...'));
        const result = await paystack.getBanks();

        // Find "Test Bank"
        const testBank = result.data.find(b => b.name.toLowerCase().includes('test'));

        if (testBank) {
            console.log(chalk.green('✓ Found Test Bank:'), testBank);
        } else {
            console.log(chalk.yellow('! Test Bank not found in list. Listing first 10 banks:'));
            console.log(result.data.slice(0, 10));
        }

    } catch (error) {
        console.error(chalk.red('✗ Error fetching banks:'), error);
    }
}

listBanks();
