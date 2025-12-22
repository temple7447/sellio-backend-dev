const mongoose = require('mongoose');
const config = require('./src/config/config');

mongoose.connect(config.MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB\n');

        const RewardSettings = require('./src/models/RewardSettings');

        // Get current settings
        const settings = await RewardSettings.getSettings();

        console.log('=== Current Reward Settings ===\n');

        console.log('📌 Referral Bonus:');
        console.log(`   Enabled: ${settings.referralBonus.enabled ? '✅ Yes' : '❌ No'}`);
        console.log(`   Amount: ₦${settings.referralBonus.amount.toLocaleString()}`);

        console.log('\n💰 Cashback:');
        console.log(`   Enabled: ${settings.cashback.enabled ? '✅ Yes' : '❌ No'}`);
        console.log(`   Amount: ₦${settings.cashback.amount.toLocaleString()} per product`);
        console.log(`   Minimum Purchase: ₦${settings.cashback.minimumPurchase.toLocaleString()}`);

        if (settings.lastUpdatedBy) {
            console.log(`\n📝 Last Updated By: ${settings.lastUpdatedBy}`);
            console.log(`📅 Updated At: ${settings.updatedAt}`);
        }

        console.log('\n=== Summary ===');
        console.log(`When someone uses your referral link and verifies email:`);
        console.log(`  → You get: ₦${settings.referralBonus.amount.toLocaleString()}`);
        console.log(`\nWhen customer buys product ≥ ₦${settings.cashback.minimumPurchase.toLocaleString()}:`);
        console.log(`  → They get: ₦${settings.cashback.amount.toLocaleString()} cashback per product\n`);

        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
