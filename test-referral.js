const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();

const authService = require('./src/services/auth.service');
const walletService = require('./src/services/wallet.service');
const { MarketUser } = require('./src/models/MarketUser');
const MarketOTP = require('./src/models/MarketOTP');
const MarketWallet = require('./src/models/MarketWallet');
const MarketReferral = require('./src/models/MarketReferral');
const RewardSettings = require('./src/models/RewardSettings');

async function testReferral() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        // 1. Setup/Get Referrer
        console.log(chalk.blue('\n--- Step 1: Setting up Referrer ---'));
        const referrerEmail = 'referrer@test.com';
        let referrer = await MarketUser.findOne({ email: referrerEmail });

        if (!referrer) {
            console.log(chalk.yellow('Referrer not found, creating one...'));
            // Create a referrer manually to avoid email sends in this step
            const { MarketCustomer } = require('./src/models/MarketUser');
            referrer = new MarketCustomer({
                email: referrerEmail,
                password: 'password123',
                fullName: 'Main Referrer',
                phoneNumber: '08011111111',
                isVerified: true,
                role: 'customer'
            });
            await referrer.save();
        }

        // Ensure referrer has a wallet
        await MarketWallet.findOneAndUpdate(
            { userId: referrer._id },
            { $setOnInsert: { balance: 0 } },
            { upsert: true, new: true }
        );

        console.log(chalk.green(`✓ Referrer: ${referrer.email}`));
        console.log(chalk.green(`✓ Referral Code: ${referrer.referralCode}`));

        const balanceBefore = (await walletService.getBalance(referrer._id)).balance;
        console.log(chalk.blue(`Initial Referrer Balance: ₦${balanceBefore}`));

        // 2. Register new user with referral code
        console.log(chalk.blue('\n--- Step 2: Registering Referee ---'));
        const refereeEmail = `referee_${Date.now()}@test.com`;
        const refereeData = {
            email: refereeEmail,
            password: 'password123',
            fullName: 'New Referee',
            phoneNumber: '08022222222',
            referralCode: referrer.referralCode
        };

        // We use registerCustomer but we might need to handle the profileImage file as null
        console.log(chalk.yellow(`Registering referee: ${refereeEmail}...`));
        const regResult = await authService.registerCustomer(refereeData, null);
        console.log(chalk.green('✓ Registration successful'));

        // 3. Get OTP for referee
        console.log(chalk.blue('\n--- Step 3: Verifying OTP ---'));
        const otpRecord = await MarketOTP.findOne({ email: refereeEmail }).sort({ createdAt: -1 });
        if (!otpRecord) throw new Error('OTP not found for referee');

        console.log(chalk.yellow(`Found OTP: ${otpRecord.otp} for ${refereeEmail}`));

        // 4. Verify OTP and check bonus
        console.log(chalk.yellow('Verifying referee account...'));
        const verifyResult = await authService.verifyOTP({
            email: refereeEmail,
            otp: otpRecord.otp
        });
        console.log(chalk.green('✓ Account verified successfully'));

        // 5. Check Payout
        console.log(chalk.blue('\n--- Step 4: Verifying Bonus Payout ---'));
        const balanceAfter = (await walletService.getBalance(referrer._id)).balance;
        const rewardSettings = await RewardSettings.getSettings();
        const expectedBonus = rewardSettings.referralBonus.amount;

        console.log(chalk.blue(`Final Referrer Balance: ₦${balanceAfter}`));

        if (balanceAfter === balanceBefore + expectedBonus) {
            console.log(chalk.green(`✓ SUCCESS: Bonus of ₦${expectedBonus} was correctly paid!`));
        } else {
            console.log(chalk.red(`✗ FAILURE: Expected balance ₦${balanceBefore + expectedBonus}, but got ₦${balanceAfter}`));
        }

        // 6. Verify Referral Record
        const referralRecord = await MarketReferral.findOne({ referredUserId: verifyResult.data.user.id });
        if (referralRecord && referralRecord.status === 'bonus_paid') {
            console.log(chalk.green('✓ Referral record status updated to "bonus_paid"'));
        } else {
            console.log(chalk.red('✗ Referral record not updated correctly'));
            console.log(JSON.stringify(referralRecord, null, 2));
        }

        console.log(chalk.blue('\n--- Test Completed ---'));

    } catch (error) {
        console.error(chalk.red('\n✗ Test Failed:'), error);
        if (error.stack) console.error(chalk.gray(error.stack));
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

testReferral();
