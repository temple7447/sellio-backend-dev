const paystack = require('./src/utils/paystack');
const chalk = require('chalk');

async function testLiveVerify() {
    try {
        console.log(chalk.blue('Testing Live Bank Account Verification...'));
        const account_number = '7011951761';
        const bank_code = '999991'; // OPay Digital Services Limited

        // Note: Sometimes OPay is 999992 or 999991, let's check all_banks.json again for the code used in this environment
        // From grep: "code": "999992"
        const final_bank_code = '999992';

        console.log(chalk.gray(`Bank: OPay (Code: ${final_bank_code})`));
        console.log(chalk.gray(`Account Number: ${account_number}\n`));

        const result = await paystack.verifyAccountNumber(account_number, final_bank_code);

        console.log(chalk.green('✓ Verification Successful!'));
        console.log(chalk.white('Account Name:'), chalk.yellow(result.data.account_name));
        console.log(chalk.white('Account Number:'), chalk.yellow(result.data.account_number));

        console.log(chalk.gray('\nFull Response Data:'));
        console.log(JSON.stringify(result, null, 2));

    } catch (error) {
        console.error(chalk.red('\nVerification Failed:'), error.message || error);
        if (error.response && error.response.data) {
            console.error(chalk.red('Detail:'), JSON.stringify(error.response.data, null, 2));
        }
    }
}

testLiveVerify();
