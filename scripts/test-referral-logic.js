const mongoose = require('mongoose');
const chalk = require('chalk');
const config = require('../src/config/config');
const MarketProduct = require('../src/models/MarketProduct');
const MarketCategory = require('../src/models/MarketCategory');
const MarketOrder = require('../src/models/MarketOrder');
const MarketOrderItem = require('../src/models/MarketOrderItem');
const { MarketCustomer, MarketSeller, MarketUser } = require('../src/models/MarketUser');
const MarketReferral = require('../src/models/MarketReferral'); // FIXED PATH
const RewardSettings = require('../src/models/RewardSettings');
const walletService = require('../src/services/wallet.service');
const orderService = require('../src/services/order.service');

async function testReferralAndCashback() {
    try {
        console.log(chalk.blue('Connecting to MongoDB for Referral/Cashback Test...'));
        await mongoose.connect(process.env.MONGODB_URI || config.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        const timestamp = Date.now();
        const category = await MarketCategory.findOne({}) || await MarketCategory.create({
            name: 'Rewards Category',
            description: 'Category for testing rewards'
        });

        // 1. Setup Reward Settings
        console.log(chalk.blue('\n--- Phase 1: Setup Reward Settings ---'));
        const settings = await RewardSettings.getSettings();
        settings.referralBonus = { enabled: true, amount: 500, minPurchase: 1000 };
        settings.cashback = { enabled: true, amount: 1000, minimumPurchase: 2000 };
        await settings.save();
        console.log(chalk.green(`✓ Settings: Referral Bonus=₦500 (min ₦1000), Cashback=₦1000 (min item ₦2000)`));

        // 2. Setup Users
        console.log(chalk.blue('\n--- Phase 2: Setup Users ---'));
        const referrer = await MarketSeller.create({
            email: `referrer_v2_${timestamp}@example.com`,
            password: 'password123',
            fullName: 'The Referrer',
            phoneNumber: `081111${timestamp.toString().slice(-5)}`,
            businessName: `Ref Business ${timestamp}`,
            businessAddress: '123 Ref St',
            governmentId: `ID-REF-${timestamp}`,
            isVerified: true,
            adminVerified: true
        });

        const buyer = await MarketCustomer.create({
            email: `buyer_ref_r2_${timestamp}@example.com`,
            password: 'password123',
            fullName: 'The Buyer',
            phoneNumber: `082222${timestamp.toString().slice(-5)}`,
            referredBy: referrer._id
        });

        // Create Referral record
        await MarketReferral.create({
            referrerId: referrer._id,
            referredUserId: buyer._id,
            status: 'signed_up'
        });

        const seller = await MarketSeller.create({
            email: `seller_rew2_${timestamp}@example.com`,
            password: 'password123',
            fullName: 'The Seller',
            phoneNumber: `083333${timestamp.toString().slice(-5)}`,
            businessName: `Reward Shop ${timestamp}`,
            businessAddress: '123 Reward St',
            governmentId: `ID-REWARD-${timestamp}`,
            isVerified: true,
            adminVerified: true
        });

        const product = await MarketProduct.create({
            sellerId: seller._id,
            name: `Reward Product ${timestamp}`,
            description: 'Product for testing rewards',
            price: { current: 5000 },
            inventory: { quantity: 10 },
            category: category._id,
            status: 'active'
        });

        console.log(chalk.green(`✓ Referrer: ${referrer.email}`));
        console.log(chalk.green(`✓ Buyer (referred by referrer): ${buyer.email}`));
        console.log(chalk.green(`✓ Referral record created: status=signed_up`));

        // 3. Create and Verify Order
        console.log(chalk.blue('\n--- Phase 3: Create Order and Verify Rewards ---'));
        const orderData = {
            items: [{ productId: product._id.toString(), quantity: 1 }],
            shippingDetails: {
                fullName: 'The Buyer',
                phoneNumber: '082222...',
                address: { street: 'Reward Lane', city: 'Lagos', state: 'Lagos', country: 'Nigeria' }
            }
        };

        const order = await orderService.createCustomerOrder(buyer._id, orderData);
        console.log(chalk.green(`✓ Order Created: ${order._id}`));

        console.log(chalk.blue('\nSimulating Payment Verification Effects...'));
        const paystackService = require('../src/utils/paystack');
        const originalVerify = paystackService.verifyTransaction;
        paystackService.verifyTransaction = async () => ({
            data: {
                status: 'success',
                reference: 'MOCK-REF-' + timestamp,
                amount: order.totals.final * 100,
                customer: { email: buyer.email },
                paid_at: new Date()
            }
        });

        await orderService.verifyPayment(`ORD-${order._id}`);
        console.log(chalk.green(`✓ verifyPayment called with successful mock result.`));

        // 4. Verify Wallets
        console.log(chalk.blue('\n--- Phase 4: Checking Wallet Bonuses ---'));
        const referrerWallet = await walletService.getBalance(referrer._id);
        const buyerWallet = await walletService.getBalance(buyer._id);

        console.log(chalk.blue(`Referrer Balance: ₦${referrerWallet.balance} (Expected ₦500 referral bonus)`));
        console.log(chalk.blue(`Buyer Balance: ₦${buyerWallet.balance} (Expected ₦1000 cashback)`));

        let success = true;
        if (referrerWallet.balance !== 500) {
            console.log(chalk.red('✗ Referral Bonus NOT credited or incorrect.'));
            success = false;
        } else {
            console.log(chalk.green('✓ Referral Bonus Verified!'));
        }

        if (buyerWallet.balance !== 1000) {
            console.log(chalk.red('✗ Cashback NOT credited or incorrect.'));
            success = false;
        } else {
            console.log(chalk.green('✓ Cashback Verified!'));
        }

        paystackService.verifyTransaction = originalVerify;

        if (success) {
            console.log(chalk.green('\n✓ Referral & Cashback Test SUCCESSFUL!'));
        } else {
            console.log(chalk.red('\n✗ Referral & Cashback Test FAILED.'));
        }

        process.exit(0);
    } catch (error) {
        console.error(chalk.red('✗ Referral Test Failed:'), error.message);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    }
}

testReferralAndCashback();
