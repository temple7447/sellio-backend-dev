const mongoose = require('mongoose');
const chalk = require('chalk');
const config = require('../src/config/config');

// Load models
const { MarketUser } = require('../src/models/MarketUser');
const MarketProduct = require('../src/models/MarketProduct');
const MarketOrder = require('../src/models/MarketOrder');
const MarketOrderItem = require('../src/models/MarketOrderItem');
const MarketWallet = require('../src/models/MarketWallet');
const WalletTransaction = require('../src/models/WalletTransaction');
const MarketReferral = require('../src/models/MarketReferral');

async function cleanup() {
    try {
        console.log(chalk.blue('Connecting to MongoDB for Cleanup...'));
        await mongoose.connect(process.env.MONGODB_URI || config.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        // 1. Identify test users by email pattern
        const testUserPatterns = [
            /@example\.com$/,
            /^test_buyer_/,
            /^inv_/,
            /^referrer_/,
            /^buyer_/,
            /^seller_/,
            /ref_retry/
        ];

        const testUsers = await MarketUser.find({
            $or: testUserPatterns.map(p => ({ email: { $regex: p } }))
        });

        const testUserIds = testUsers.map(u => u._id);
        console.log(chalk.blue(`Found ${testUserIds.length} test users to remove.`));

        // 2. Identify orders by IDs matching 6972 pattern (since we can't regex on _id, we fetch and then delete)
        // Or simply delete orders associated with test users
        const ordersToDelete = await MarketOrder.find({
            $or: [
                { customerId: { $in: testUserIds } }
            ]
        });

        // Also manually add any orders matching the screenshot pattern if they weren't caught
        // The screenshot orders: 697263cb, 6972636f, 69726343, 69726308, 697262ec, 69726059
        // We can fetch all orders and filter manually in JS for safety
        const allOrders = await MarketOrder.find({});
        const screenshotOrderIds = allOrders
            .filter(o => o._id.toString().startsWith('6972'))
            .map(o => o._id);

        const combinedOrderIds = [...new Set([...ordersToDelete.map(o => o._id), ...screenshotOrderIds])];
        console.log(chalk.blue(`Found ${combinedOrderIds.length} orders to remove.`));

        // 3. Execution
        if (combinedOrderIds.length > 0) {
            const orderResults = await MarketOrder.deleteMany({ _id: { $in: combinedOrderIds } });
            console.log(chalk.green(`✓ Deleted ${orderResults.deletedCount} orders.`));

            const itemResults = await MarketOrderItem.deleteMany({ orderId: { $in: combinedOrderIds } });
            console.log(chalk.green(`✓ Deleted ${itemResults.deletedCount} order items.`));
        }

        if (testUserIds.length > 0) {
            // Delete associated items for safety
            await MarketOrderItem.deleteMany({ sellerId: { $in: testUserIds } });

            const walletResults = await MarketWallet.deleteMany({ userId: { $in: testUserIds } });
            console.log(chalk.green(`✓ Deleted ${walletResults.deletedCount} wallets.`));

            const txResults = await WalletTransaction.deleteMany({ userId: { $in: testUserIds } });
            console.log(chalk.green(`✓ Deleted ${txResults.deletedCount} transactions.`));

            const refResults = await MarketReferral.deleteMany({
                $or: [
                    { referrerId: { $in: testUserIds } },
                    { referredUserId: { $in: testUserIds } }
                ]
            });
            console.log(chalk.green(`✓ Deleted ${refResults.deletedCount} referral records.`));

            const productResults = await MarketProduct.deleteMany({ sellerId: { $in: testUserIds } });
            console.log(chalk.green(`✓ Deleted ${productResults.deletedCount} products.`));

            const userResults = await MarketUser.deleteMany({ _id: { $in: testUserIds } });
            console.log(chalk.green(`✓ Deleted ${userResults.deletedCount} test users.`));
        }

        console.log(chalk.blue('\n--- Cleanup Complete! ---'));
        process.exit(0);
    } catch (error) {
        console.error(chalk.red('❌ Cleanup Failed:'), error.message);
        process.exit(1);
    }
}

cleanup();
