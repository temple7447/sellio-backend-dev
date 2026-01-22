const mongoose = require('mongoose');
const chalk = require('chalk');
const config = require('../src/config/config');
const { MarketUser, MarketSeller, MarketCustomer } = require('../src/models/MarketUser');
const MarketProduct = require('../src/models/MarketProduct');
const MarketCategory = require('../src/models/MarketCategory');
const MarketOrder = require('../src/models/MarketOrder');
const MarketOrderItem = require('../src/models/MarketOrderItem');
const MarketWallet = require('../src/models/MarketWallet');
const WalletTransaction = require('../src/models/WalletTransaction');
const orderService = require('../src/services/order.service');
const walletService = require('../src/services/wallet.service');

async function runTest() {
    let sellerId, buyerId, productId, categoryId, orderId, orderItemId;

    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(config.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        // 1. Setup Phase
        console.log(chalk.blue('\n--- Phase 1: Setup ---'));

        // Create Category
        console.log(chalk.blue('Ensuring test category exists...'));
        let category = await MarketCategory.findOne({ name: 'Test Category' });
        if (!category) {
            category = await MarketCategory.create({
                name: 'Test Category',
                description: 'For end-to-end testing'
            });
        }
        categoryId = category._id;
        console.log(chalk.green(`✓ Category: ${category.name} (${categoryId})`));

        // Create Seller
        console.log(chalk.blue('Registering test seller...'));
        const sellerEmail = `test_seller_${Date.now()}@example.com`;
        const seller = await MarketSeller.create({
            email: sellerEmail,
            password: 'password123',
            fullName: 'Test Seller',
            phoneNumber: '08012345678',
            businessName: 'Test Business',
            businessAddress: '123 Seller St',
            governmentId: 'ID12345',
            isVerified: true,
            adminVerified: true,
            role: 'seller'
        });
        sellerId = seller._id;
        console.log(chalk.green(`✓ Seller: ${sellerEmail} (${sellerId})`));

        // Create Buyer
        console.log(chalk.blue('Registering test buyer...'));
        const buyerEmail = `test_buyer_${Date.now()}@example.com`;
        const buyer = await MarketCustomer.create({
            email: buyerEmail,
            password: 'password123',
            fullName: 'Test Buyer',
            phoneNumber: '08087654321',
            isVerified: true,
            role: 'customer'
        });
        buyerId = buyer._id;
        console.log(chalk.green(`✓ Buyer: ${buyerEmail} (${buyerId})`));

        // Create Product
        console.log(chalk.blue('Creating test product...'));
        const product = await MarketProduct.create({
            sellerId: sellerId,
            name: 'Test Product',
            description: 'A product for testing E2E flow',
            price: { current: 5000 },
            category: categoryId,
            inventory: { quantity: 10 },
            status: 'active'
        });
        productId = product._id;
        console.log(chalk.green(`✓ Product: ${product.name} (₦${product.price.current})`));

        // Create Order
        console.log(chalk.blue('Creating test order...'));
        const orderData = {
            items: [{ productId: productId.toString(), quantity: 1 }],
            shippingDetails: {
                fullName: 'Test Buyer',
                phoneNumber: '08087654321',
                address: {
                    street: '456 Buyer Lane',
                    city: 'Lagos',
                    state: 'Lagos',
                    country: 'Nigeria'
                }
            }
        };

        const orderResult = await orderService.createCustomerOrder(buyerId, orderData);
        orderId = orderResult._id;
        orderItemId = orderResult.items[0]._id;
        console.log(chalk.green(`✓ Order Created: ${orderId}`));
        console.log(chalk.green(`✓ Order Item: ${orderItemId}`));

        // 2. Payment Phase
        console.log(chalk.blue('\n--- Phase 2: Simulating Payment ---'));

        // Manually confirm payment to avoid Paystack API calls in script
        const order = await MarketOrder.findById(orderId);
        order.status = 'confirmed';
        order.payment.status = 'completed';
        order.payment.transactionId = 'TRANS-MOCK-' + Date.now();
        await order.save();

        const orderItem = await MarketOrderItem.findById(orderItemId);
        orderItem.status = 'confirmed';
        await orderItem.save();

        console.log(chalk.green('✓ Order and Item status updated to: CONFIRMED'));

        // 3. Seller Shipping Phase
        console.log(chalk.blue('\n--- Phase 3: Seller Fulfillment (Shipping) ---'));

        const fulfillmentProof = 'https://cloudinary.com/proof-of-shipping.jpg';
        await orderService.uploadFulfillmentProof(sellerId, orderItemId, fulfillmentProof);

        const itemAfterShip = await MarketOrderItem.findById(orderItemId);
        console.log(chalk.green(`✓ Item Status: ${itemAfterShip.status}`));
        console.log(chalk.green(`✓ Fulfillment Proof: ${itemAfterShip.fulfillmentProof}`));

        if (itemAfterShip.status !== 'shipped') {
            throw new Error('Item status should be "shipped" after fulfillment proof upload');
        }

        // 4. Buyer Confirmation Phase
        console.log(chalk.blue('\n--- Phase 4: Buyer Confirmation & Fund Release ---'));

        const sellerWalletBefore = await walletService.getBalance(sellerId);
        console.log(chalk.blue(`Seller Balance Before: ₦${sellerWalletBefore.balance}`));

        const buyerProof = 'https://cloudinary.com/proof-of-receipt.jpg';
        const itemProofs = {};
        itemProofs[orderItemId.toString()] = buyerProof;

        await orderService.confirmReceipt(buyerId, orderId, itemProofs);

        const itemAfterConfirm = await MarketOrderItem.findById(orderItemId);
        const orderAfterConfirm = await MarketOrder.findById(orderId);
        const sellerWalletAfter = await walletService.getBalance(sellerId);

        console.log(chalk.green(`✓ Item Status: ${itemAfterConfirm.status}`));
        console.log(chalk.green(`✓ Buyer Proof: ${itemAfterConfirm.buyerProof}`));
        console.log(chalk.green(`✓ Order Status: ${orderAfterConfirm.status}`));
        console.log(chalk.green(`✓ Seller Balance After: ₦${sellerWalletAfter.balance}`));

        if (itemAfterConfirm.status !== 'delivered') {
            throw new Error('Item status should be "delivered" after buyer confirmation');
        }

        if (orderAfterConfirm.status !== 'delivered') {
            throw new Error('Order status should be "delivered" if all items are confirmed');
        }

        const expectedBalance = sellerWalletBefore.balance + itemAfterConfirm.totalPrice;
        if (sellerWalletAfter.balance !== expectedBalance) {
            console.log(chalk.red(`✗ Balance Mismatch! Expected: ₦${expectedBalance}, Got: ₦${sellerWalletAfter.balance}`));
        } else {
            console.log(chalk.green(`✓ Fund Release Verified: Seller credited with ₦${itemAfterConfirm.totalPrice}`));
        }

        console.log(chalk.green('\n--- END-TO-END TEST SUCCESSFUL ---'));

        // Cleanup (Optional: remove the test data or just exit)
        // await mongoose.connection.close();
        process.exit(0);

    } catch (error) {
        console.error(chalk.red('\n✗ Test Failed:'), error.message || error);
        if (error.stack) console.error(chalk.red(error.stack));
        process.exit(1);
    }
}

runTest();
