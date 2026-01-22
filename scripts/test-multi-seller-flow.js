const mongoose = require('mongoose');
const chalk = require('chalk');
const config = require('../src/config/config');
const MarketProduct = require('../src/models/MarketProduct');
const MarketCategory = require('../src/models/MarketCategory');
const MarketOrder = require('../src/models/MarketOrder');
const MarketOrderItem = require('../src/models/MarketOrderItem');
const { MarketCustomer, MarketSeller } = require('../src/models/MarketUser');
const MarketWallet = require('../src/models/MarketWallet');
const walletService = require('../src/services/wallet.service');
const orderService = require('../src/services/order.service');

async function testMultiSeller() {
    try {
        console.log(chalk.blue('Connecting to MongoDB for Multi-Seller Test...'));
        await mongoose.connect(process.env.MONGODB_URI || config.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        // 1. Setup Phase
        console.log(chalk.blue('\n--- Phase 1: Setup ---'));

        const timestamp = Date.now();
        const category = await MarketCategory.findOne({}) || await MarketCategory.create({
            name: 'General',
            description: 'General Category'
        });

        // Seller A
        const sellerA = await MarketSeller.create({
            email: `seller_a_${timestamp}@example.com`,
            password: 'password123',
            fullName: 'Seller Alice',
            phoneNumber: `081000${timestamp.toString().slice(-5)}`,
            businessName: `Alice Shop ${timestamp}`,
            businessAddress: '123 Alice St',
            governmentId: `ID-ALICE-${timestamp}`,
            isVerified: true,
            adminVerified: true
        });

        // Seller B
        const sellerB = await MarketSeller.create({
            email: `seller_b_${timestamp}@example.com`,
            password: 'password123',
            fullName: 'Seller Bob',
            phoneNumber: `081000${(timestamp + 1).toString().slice(-5)}`,
            businessName: `Bob Store ${timestamp}`,
            businessAddress: '456 Bob Lane',
            governmentId: `ID-BOB-${timestamp}`,
            isVerified: true,
            adminVerified: true
        });

        // Buyer
        const buyer = await MarketCustomer.create({
            email: `buyer_multi_${timestamp}@example.com`,
            password: 'password123',
            fullName: 'Multi Buyer',
            phoneNumber: `081888${timestamp.toString().slice(-5)}`
        });

        // Products with UNIQUE names for UNIQUE slugs
        const productA = await MarketProduct.create({
            sellerId: sellerA._id,
            name: `Alice Product ${timestamp}`,
            description: 'Product from Alice',
            price: { current: 3000 },
            inventory: { quantity: 10 },
            category: category._id,
            status: 'active'
        });

        const productB = await MarketProduct.create({
            sellerId: sellerB._id,
            name: `Bob Product ${timestamp}`,
            description: 'Product from Bob',
            price: { current: 7000 },
            inventory: { quantity: 10 },
            category: category._id,
            status: 'active'
        });

        console.log(chalk.green(`✓ Created Seller A, Seller B, and Buyer`));
        console.log(chalk.green(`✓ Product A (₦3000), Product B (₦7000)`));

        // 2. Create Order
        console.log(chalk.blue('\n--- Phase 2: Create Multi-Seller Order ---'));
        const orderData = {
            items: [
                { productId: productA._id.toString(), quantity: 1 },
                { productId: productB._id.toString(), quantity: 1 }
            ],
            shippingDetails: {
                fullName: 'Multi Buyer',
                phoneNumber: '08188888888',
                address: { street: '789 Trade Rd', city: 'Lagos', state: 'Lagos', country: 'Nigeria' }
            }
        };

        const order = await orderService.createCustomerOrder(buyer._id, orderData);
        console.log(chalk.green(`✓ Order Created: ${order._id}`));

        // 3. Payment & Split Verification
        console.log(chalk.blue('\n--- Phase 3: Verify Fulfillment & Split ---'));

        // Confirm payment
        await MarketOrder.findByIdAndUpdate(order._id, { status: 'confirmed', 'payment.status': 'completed' });
        await MarketOrderItem.updateMany({ orderId: order._id }, { status: 'confirmed' });

        // Find items in the created order (note: productId is populated in the response)
        const itemA = order.items.find(i => i.productId._id.toString() === productA._id.toString());
        const itemB = order.items.find(i => i.productId._id.toString() === productB._id.toString());

        // Seller A fulfills
        await orderService.uploadFulfillmentProof(sellerA._id, itemA._id, 'http://alice-proof.jpg');
        console.log(chalk.green(`✓ Seller A uploaded fulfillment proof`));

        // Seller B fulfills
        await orderService.uploadFulfillmentProof(sellerB._id, itemB._id, 'http://bob-proof.jpg');
        console.log(chalk.green(`✓ Seller B uploaded fulfillment proof`));

        // Buyer confirms BOTH
        const itemProofs = {};
        itemProofs[itemA._id.toString()] = 'http://buyer-receipt-a.jpg';
        itemProofs[itemB._id.toString()] = 'http://buyer-receipt-b.jpg';

        await orderService.confirmReceipt(buyer._id, order._id, itemProofs);
        console.log(chalk.green(`✓ Buyer confirmed receipt of both items`));

        // Check Balances
        const balanceA = await walletService.getBalance(sellerA._id);
        const balanceB = await walletService.getBalance(sellerB._id);

        console.log(chalk.blue(`\nFinal Balances:`));
        console.log(chalk.blue(`Seller A Balance: ₦${balanceA.balance} (Expected ₦3000)`));
        console.log(chalk.blue(`Seller B Balance: ₦${balanceB.balance} (Expected ₦7000)`));

        if (balanceA.balance === 3000 && balanceB.balance === 7000) {
            console.log(chalk.green('\n✓ Multi-Seller Split Test SUCCESSFUL!'));
        } else {
            console.log(chalk.red('\n✗ Multi-Seller Split Test FAILED: Balance mismatch.'));
        }

        process.exit(0);
    } catch (error) {
        console.error(chalk.red('✗ Multi-Seller Test Failed:'), error.message);
        process.exit(1);
    }
}

testMultiSeller();
