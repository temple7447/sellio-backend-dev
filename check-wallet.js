const mongoose = require('mongoose');
const config = require('./src/config/config');

mongoose.connect(config.MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');

        // Check recent wallet transactions
        const WalletTransaction = require('./src/models/WalletTransaction');
        const { MarketUser } = require('./src/models/MarketUser');

        console.log('\n=== Recent Wallet Transactions ===');
        const transactions = await WalletTransaction.find()
            .sort({ createdAt: -1 })
            .limit(5);

        transactions.forEach(tx => {
            console.log(`${tx.type}: ₦${tx.amount} for user ${tx.userId}`);
            console.log(`  Balance: ${tx.balanceBefore} → ${tx.balanceAfter}`);
            console.log(`  Description: ${tx.description}`);
            console.log(`  Created: ${tx.createdAt}\n`);
        });

        // Check seller with referral bonus (ID from logs)
        console.log('\n=== Checking User 68a24631e001213ad86881c5 ===');
        const user = await MarketUser.findById('68a24631e001213ad86881c5');
        if (user) {
            console.log(`Email: ${user.email}`);
            console.log(`Role: ${user.role}`);
            console.log(`Wallet Balance: ₦${user.wallet?.balance || 0}`);
            console.log(`Last Transaction: ${user.wallet?.lastTransaction}`);
        } else {
            console.log('User not found!');
        }

        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
