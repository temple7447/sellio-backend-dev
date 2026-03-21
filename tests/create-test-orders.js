const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();

const MarketOrder = require('../src/models/MarketOrder');
const MarketOrderItem = require('../src/models/MarketOrderItem');
const MarketProduct = require('../src/models/MarketProduct');
const { MarketUser } = require('../src/models/MarketUser');

async function createTestOrders() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        // 1. Get a customer
        const customer = await MarketUser.findOne({ role: 'customer' });
        if (!customer) throw new Error('No customer found. Run populate-data.js first.');

        // 2. Get some products
        const products = await MarketProduct.find({ status: 'active' }).limit(3);
        if (products.length < 3) throw new Error('Need at least 3 active products. Run populate-data.js first.');

        console.log(chalk.yellow(`Creating 3 paid orders for ${customer.email}...`));

        for (let i = 0; i < 3; i++) {
            const product = products[i];
            const price = product.price.current;

            // Create Order
            const order = new MarketOrder({
                customerId: customer._id,
                status: 'pending',
                totals: {
                    subtotal: price,
                    shipping: 500,
                    service: 200,
                    tax: price * 0.05,
                    final: price + 700 + (price * 0.05)
                },
                payment: {
                    status: 'completed',
                    method: 'card',
                    reference: `TEST-REF-${Date.now()}-${i}`,
                    paidAt: new Date()
                },
                shipping: {
                    address: {
                        fullName: customer.fullName,
                        street: `${100 + i} Test Lane`,
                        city: 'Lagos',
                        state: 'Lagos',
                        country: 'Nigeria',
                        phoneNumber: customer.phoneNumber
                    },
                    method: 'standard',
                    cost: 500
                }
            });

            await order.save();

            // Create Order Item
            await MarketOrderItem.create({
                orderId: order._id,
                productId: product._id,
                sellerId: product.sellerId,
                quantity: 1,
                price: price,
                totalPrice: price,
                status: 'pending'
            });

            console.log(chalk.green(`✓ Created Order ${i + 1}: ID ${order._id}, Amount: ₦${order.totals.final.toFixed(2)}`));
        }

        console.log(chalk.blue('\n--- Successfully created 3 paid orders ---'));

    } catch (error) {
        console.error(chalk.red('\n✗ Failed to create test orders:'), error.message);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

createTestOrders();
