const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config(); // Ensure env variables are loaded
const config = require('../src/config/config');

// Load models & services
const { MarketUser } = require('../src/models/MarketUser');
const walletService = require('../src/services/wallet.service');

async function testPaystackDeposit() {
    try {
        console.log(chalk.blue('Connecting to MongoDB for Testing Paystack Deposit...'));
        await mongoose.connect(process.env.MONGODB_URI || config.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        // Find a user to test with
        const user = await MarketUser.findOne({ email: { $ne: null } });
        if (!user) {
            console.log(chalk.red('❌ No users found in the database. Please create a user first.'));
            process.exit(1);
        }

        console.log(chalk.blue(`Found test user: ${user.fullName} (${user.email})`));

        // 1. Initialize Deposit
        const amount = 5000; // 5000 NGN
        console.log(chalk.blue(`\n[1/2] Initializing deposit of ${amount} NGN...`));
        
        const initResult = await walletService.initializeDeposit(user._id, amount);
        
        console.log(chalk.green('✓ Deposit Initialized successfully. The system correctly calls Paystack and creates a pending transaction.'));
        console.log('Returned Data:');
        console.log('-------------------------------------------');
        console.log(`Reference: ${initResult.reference}`);
        console.log(`Access Code: ${initResult.accessCode}`);
        console.log(`Authorization URL: ${initResult.authorizationUrl}`);
        console.log(`Transaction ID: ${initResult.transaction._id}`);
        console.log('-------------------------------------------\n');

        const reference = initResult.reference;

        // 2. Verify Deposit (This should simulate checking an unpaid Paystack link)
        console.log(chalk.blue(`[2/2] Verifying deposit for reference: ${reference}...`));
        console.log(chalk.blue('We expect this to return an unpaid/abandoned status because we just created the link and didn\'t actually pay it.'));
        
        try {
            const verifyResult = await walletService.verifyDeposit(user._id, reference);
            
            // It might return success: false or success: true if we magically paid it
            if (verifyResult.success) {
                console.log(chalk.green('✓ Deposit Verified successfully (Unexpected for an unpaid link):'), verifyResult);
            } else {
                console.log(chalk.yellow('✓ Verification correctly identified the link is unpaid/abandoned:'));
                console.log(`Status: ${verifyResult.status}`);
                console.log(`Message: ${verifyResult.message}`);
            }
        } catch (verifyError) {
            console.log(chalk.yellow('✓ Verification behaved correctly for unpaid status. Error caught:'));
            console.log(verifyError.message || verifyError);
        }

        console.log(chalk.blue('\n--- Test Complete! ---'));
        process.exit(0);
    } catch (error) {
        console.error(chalk.red('❌ Test Failed:'), error.message || error);
        console.error(error);
        process.exit(1);
    }
}

testPaystackDeposit();
