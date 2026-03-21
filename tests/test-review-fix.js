const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const reviewService = require('../src/services/review.service');
const { MarketUser, MarketCustomer } = require('../src/models/MarketUser');
const MarketOrder = require('../src/models/MarketOrder');
const MarketOrderItem = require('../src/models/MarketOrderItem');
const MarketProduct = require('../src/models/MarketProduct');

async function testReviewFix() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.blue('Connected to MongoDB'));

        // 1. Find a customer
        const customer = await MarketCustomer.findOne({ email: 'customer1@example.com' });
        if (!customer) throw new Error('Customer not found');

        // 2. Find a delivered order for this customer
        let order = await MarketOrder.findOne({ customerId: customer._id, status: 'delivered' });

        if (!order) {
            console.log(chalk.yellow('No delivered order found. Creating a mock delivered order...'));
            // Create a mock product and order if none exists
            const product = await MarketProduct.findOne();
            order = new MarketOrder({
                customerId: customer._id,
                status: 'delivered',
                payment: { status: 'completed' },
                totals: { final: 1000 }
            });
            await order.save();

            const orderItem = new MarketOrderItem({
                orderId: order._id,
                productId: product._id,
                sellerId: product.sellerId,
                quantity: 1,
                price: product.price.current,
                status: 'delivered'
            });
            await orderItem.save();
            console.log(chalk.green('✓ Mock order and item created'));
        }

        // 3. Attempt to submit a review
        console.log(chalk.blue('\nAttempting to submit review...'));
        const reviewData = {
            orderId: order._id.toString(),
            rating: 5,
            comment: 'Testing the fix!'
        };

        const result = await reviewService.createCustomerReview(customer._id, reviewData);
        console.log(chalk.green('✓ Review submission successful!'));
        console.log(result);

    } catch (error) {
        console.error(chalk.red('✗ Test failed:'), error.message || error);
        if (error.stack) console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

testReviewFix();
