const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const orderService = require('../src/services/order.service');
const RewardSettings = require('../src/models/RewardSettings');
const MarketProduct = require('../src/models/MarketProduct');

async function testCheckoutCharges() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.blue('Connected to MongoDB'));

        // 1. Set specific settings for testing
        const settings = await RewardSettings.getSettings();
        settings.checkoutFees = {
            tax: 250,
            escrowProtectionRate: 0.025,
            serviceFee: 50
        };
        await settings.save();
        console.log(chalk.green('✓ Test settings applied: Tax=250, EP=2.5%, Service=50'));

        // 2. Find a product for the test
        const product = await MarketProduct.findOne({ status: 'active' });
        if (!product) throw new Error('No active products found for test');

        // Mock 400 subtotal if possible by creating a dummy product or just using existing and checking math
        const mockSubtotal = 400;
        // To get exactly 400, we'll just check the math in a mock-like way or create a temp product
        console.log(chalk.blue(`\nTesting with product: ${product.name} (Price: ₦${product.price.current})`));

        // Create a guest order
        const guestOrderDetails = {
            items: [{ productId: product._id.toString(), quantity: 1 }],
            guestEmail: 'test_guest@example.com',
            shippingAddress: {
                fullName: 'Test Guest',
                phoneNumber: '08012345678',
                street: '123 Test St',
                city: 'Test City',
                state: 'Test State',
                country: 'Nigeria'
            }
        };

        const order = await orderService.createOrder(guestOrderDetails);
        const subtotal = order.totals.subtotal;
        const expectedEP = subtotal * 0.025;
        const expectedTotal = subtotal + 250 + expectedEP + 50;

        console.log(chalk.blue('\n--- Order Totals Check ---'));
        console.log(`Subtotal: ₦${subtotal}`);
        console.log(`Tax: ₦${order.totals.tax} (Expected: 250)`);
        console.log(`E.P (2.5%): ₦${order.totals.escrowProtection} (Expected: ${expectedEP})`);
        console.log(`Service: ₦${order.totals.service} (Expected: 50)`);
        console.log(`Total: ₦${order.totals.final} (Expected: ${expectedTotal})`);

        if (order.totals.final === expectedTotal) {
            console.log(chalk.green('✓ Checkout charges calculated correctly!'));
        } else {
            console.log(chalk.red('✗ Checkout charges calculation mismatch!'));
        }

    } catch (error) {
        console.error(chalk.red('✗ Test failed:'), error.message || error);
        if (error.stack) console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

testCheckoutCharges();
