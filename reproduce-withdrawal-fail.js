const paystack = require('./src/utils/paystack');
const chalk = require('chalk');

async function testWithdrawalFlow() {
    try {
        console.log(chalk.blue('Testing Paystack Transfer Recipient Creation with Magic Number (0001234567)...'));
        const account_number = '0001234567';
        const bank_code = '011';
        const name = 'SUCCESS TEST';

        const recipient = await paystack.createTransferRecipient(name, account_number, bank_code);

        console.log(chalk.green('✓ Recipient Created Successfully!'));
        console.log(chalk.white('Recipient Code:'), chalk.yellow(recipient.data.recipient_code));

    } catch (error) {
        console.error(chalk.red('\nTest Failed:'), error.message || error);
        if (error.data) {
            console.error(chalk.red('Detail:'), JSON.stringify(error.data, null, 2));
        }
    }
}

testWithdrawalFlow();
