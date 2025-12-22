const mongoose = require('mongoose');
const config = require('./src/config/config');

mongoose.connect(config.MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB\n');

        const { MarketUser } = require('./src/models/MarketUser');
        const WalletTransaction = require('./src/models/WalletTransaction');

        const userId = '68a24631e001213ad86881c5';

        console.log('=== Checking User Wallet ===\n');

        // Get user
        const user = await MarketUser.findById(userId);
        if (user) {
            console.log(`Email: ${user.email}`);
            console.log(`Role: ${user.role}`);
            console.log(`Wallet Balance: ₦${user.wallet?.balance || 0}`);
            console.log(`Last Transaction: ${user.wallet?.lastTransaction || 'None'}`);
        }

        console.log('\n=== Recent Transactions for This User ===\n');

        const transactions = await WalletTransaction.find({ userId })
            .sort({ createdAt: -1 })
            .limit(5);

        let calculatedBalance = 0;
        transactions.reverse().forEach(tx => {
            calculatedBalance = tx.balanceAfter;
            console.log(`${tx.type}: ₦${tx.amount}`);
            console.log(`  ${tx.balanceBefore} → ${tx.balanceAfter}`);
            console.log(`  ${tx.description}`);
            console.log(`  ${tx.createdAt}\n`);
        });

        console.log(`Expected Balance (from transactions): ₦${calculatedBalance}`);
        console.log(`Actual Balance (in user document): ₦${user.wallet?.balance || 0}`);

        if (calculatedBalance !== (user.wallet?.balance || 0)) {
            console.log('\n⚠️ MISMATCH DETECTED!');
            console.log('Wallet balance is not synced with transactions.');
            console.log('\nFixing now...');

            if (!user.wallet) {
                user.wallet = {};
            }
            user.wallet.balance = calculatedBalance;
            user.wallet.currency = 'NGN';
            user.wallet.lastTransaction = new Date();
            await user.save();

            console.log(`✓ Fixed! New balance: ₦${user.wallet.balance}`);
        } else {
            console.log('\n✅ Balance is correct!');
        }

        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
