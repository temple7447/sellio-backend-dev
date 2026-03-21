const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();

const walletService = require('../src/services/wallet.service');
const { MarketUser, MarketCustomer, MarketSeller } = require('../src/models/MarketUser');
const RewardSettings = require('../src/models/RewardSettings');
const MarketOrder = require('../src/models/MarketOrder');
const MarketReferral = require('../src/models/MarketReferral');

async function testRoleReferrals() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        const settings = await RewardSettings.getSettings();
        const minPurchase = settings.referralBonus.minPurchase;
        const bonusAmount = settings.referralBonus.amount;

        console.log(chalk.blue(`\nSettings: Bonus = ₦${bonusAmount}, Min Purchase = ₦${minPurchase}`));

        // --- Helper Function to Simulate Order Confirmation ---
        async function completeOrder(orderId) {
            const order = await MarketOrder.findById(orderId);
            order.status = 'confirmed';
            order.payment.status = 'completed';
            await order.save();

            // Execute the bonus logic (mimicking order.service.js)
            if (order.customerId) {
                const customer = await MarketUser.findById(order.customerId);
                if (customer && customer.referredBy && settings.referralBonus.enabled) {
                    const referral = await MarketReferral.findOne({ referredUserId: customer._id, status: 'signed_up' });
                    if (referral && order.totals.subtotal >= minPurchase) {
                        const referrer = await MarketUser.findById(customer.referredBy);
                        const isEligible = referrer && (
                            referrer.role !== 'seller' ||
                            (referrer.isVerified && referrer.adminVerified)
                        );

                        if (isEligible) {
                            await walletService.credit(customer.referredBy, bonusAmount, 'Referral Bonus');
                            referral.status = 'bonus_paid';
                            await referral.save();
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        // --- SCENARIO 1: CUSTOMER REFFERS CUSTOMER ---
        console.log(chalk.blue('\n--- Scenario 1: Customer referring Customer ---'));
        const customerReferrer = new MarketCustomer({
            email: `cust_ref_${Date.now()}@test.com`,
            password: 'password123',
            fullName: 'Customer Referrer',
            phoneNumber: '08011111111',
            isVerified: true
        });
        await customerReferrer.save();
        const initialCustBal = (await walletService.getBalance(customerReferrer._id)).balance;

        const customerReferee = new MarketCustomer({
            email: `cust_ree_${Date.now()}@test.com`,
            password: 'password123',
            fullName: 'Customer Referee',
            phoneNumber: '08022222222',
            referredBy: customerReferrer._id,
            isVerified: true
        });
        await customerReferee.save();
        await MarketReferral.create({ referrerId: customerReferrer._id, referredUserId: customerReferee._id, status: 'signed_up' });

        const order1 = new MarketOrder({
            customerId: customerReferee._id,
            totals: { subtotal: minPurchase + 1000, final: minPurchase + 1500 },
            payment: { status: 'pending' },
            shipping: { address: { street: 'Main St' } }
        });
        await order1.save();

        console.log(chalk.yellow('Completing qualifying order for Customer Referee...'));
        await completeOrder(order1._id);

        const finalCustBal = (await walletService.getBalance(customerReferrer._id)).balance;
        if (finalCustBal === initialCustBal + bonusAmount) {
            console.log(chalk.green('✓ SUCCESS: Customer referrer received bonus!'));
        } else {
            console.log(chalk.red('✗ FAILURE: Customer referrer DID NOT receive bonus'));
        }

        // --- SCENARIO 2: VERIFIED SELLER REFFERS CUSTOMER ---
        console.log(chalk.blue('\n--- Scenario 2: Verified Seller referring Customer ---'));
        const sellerReferrer = new MarketSeller({
            email: `seller_ref_${Date.now()}@test.com`,
            password: 'password123',
            fullName: 'Seller Referrer',
            phoneNumber: '08033333333',
            businessName: 'Top Seller',
            businessAddress: 'Seller St',
            governmentId: 'GOV-123',
            isVerified: true,
            adminVerified: true
        });
        await sellerReferrer.save();
        const initialSellerBal = (await walletService.getBalance(sellerReferrer._id)).balance;

        const sellerReferee = new MarketCustomer({
            email: `sell_ree_${Date.now()}@test.com`,
            password: 'password123',
            fullName: 'Seller Referee',
            phoneNumber: '08044444444',
            referredBy: sellerReferrer._id,
            isVerified: true
        });
        await sellerReferee.save();
        await MarketReferral.create({ referrerId: sellerReferrer._id, referredUserId: sellerReferee._id, status: 'signed_up' });

        const order2 = new MarketOrder({
            customerId: sellerReferee._id,
            totals: { subtotal: minPurchase + 2000, final: minPurchase + 2500 },
            payment: { status: 'pending' },
            shipping: { address: { street: 'Market St' } }
        });
        await order2.save();

        console.log(chalk.yellow('Completing qualifying order for Seller Referee...'));
        await completeOrder(order2._id);

        const finalSellerBal = (await walletService.getBalance(sellerReferrer._id)).balance;
        if (finalSellerBal === initialSellerBal + bonusAmount) {
            console.log(chalk.green('✓ SUCCESS: Verified Seller received bonus!'));
        } else {
            console.log(chalk.red('✗ FAILURE: Verified Seller DID NOT receive bonus'));
        }

        console.log(chalk.blue('\n--- Test Completed ---'));

    } catch (error) {
        console.error(chalk.red('\n✗ Test Failed:'), error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

testRoleReferrals();
