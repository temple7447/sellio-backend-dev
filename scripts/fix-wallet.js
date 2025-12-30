const mongoose = require('mongoose');
const config = require('../src/config/config');

mongoose.connect(config.MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');

        const { MarketUser } = require('../src/models/MarketUser');

        // Fix the user's wallet balance manually
        const userId = '68a24631e001213ad86881c5';
        const user = await MarketUser.findById(userId);

        if (user) {
            console.log(`\nBefore fix:`);
            console.log(`Email: ${user.email}`);
            console.log(`Current Balance: ₦${user.wallet?.balance || 0}`);

            // They have 3 referral bonuses of ₦500 each = ₦1500
            if (!user.wallet) {
                user.wallet = {
                    balance: 0,
                    currency: 'NGN',
                    lastTransaction: null
                };
            }

            user.wallet.balance = 1500; // 3 referrals × ₦500
            user.wallet.lastTransaction = new Date();
            await user.save();

            console.log(`\nAfter fix:`);
            console.log(`New Balance: ₦${user.wallet.balance}`);
            console.log(`✓ Wallet balance fixed!`);
        } else {
            console.log('User not found!');
        }

        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
