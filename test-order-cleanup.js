const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();

const orderService = require('./src/services/order.service');
const cleanupService = require('./src/services/cleanup.service');
const MarketOrder = require('./src/models/MarketOrder');
const MarketOrderItem = require('./src/models/MarketOrderItem');
const { MarketUser, MarketCustomer, MarketSeller } = require('./src/models/MarketUser');

async function testOrderCleanup() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        // 1. Setup Test Data
        console.log(chalk.blue('\n--- Setup Test Data ---'));

        const customer = await MarketUser.findOne({ role: 'customer' });
        if (!customer) throw new Error('No customer found in DB. Run populate-data.js first.');

        const seller = await MarketUser.findOne({ role: 'seller' });
        if (!seller) throw new Error('No seller found in DB.');

        // Create a PAID order
        const paidOrder = new MarketOrder({
            customerId: customer._id,
            status: 'confirmed',
            totals: { final: 5000, subtotal: 5000 },
            payment: { status: 'completed', method: 'card' },
            shipping: { address: { street: 'Paid St' } }
        });
        await paidOrder.save();
        await MarketOrderItem.create({
            orderId: paidOrder._id,
            sellerId: seller._id,
            productId: new mongoose.Types.ObjectId(),
            quantity: 1,
            price: 5000
        });

        // Create an UNPAID order (Recent)
        const recentUnpaidOrder = new MarketOrder({
            customerId: customer._id,
            status: 'pending',
            totals: { final: 3000, subtotal: 3000 },
            payment: { status: 'pending' },
            shipping: { address: { street: 'Unpaid St' } }
        });
        await recentUnpaidOrder.save();
        await MarketOrderItem.create({
            orderId: recentUnpaidOrder._id,
            sellerId: seller._id,
            productId: new mongoose.Types.ObjectId(),
            quantity: 1,
            price: 3000
        });

        // Create an UNPAID order (Old - 48 hours ago)
        const oldUnpaidOrder = new MarketOrder({
            customerId: customer._id,
            status: 'pending',
            totals: { final: 2000, subtotal: 2000 },
            payment: { status: 'pending' },
            shipping: { address: { street: 'Old St' } },
            createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000)
        });
        await oldUnpaidOrder.save();
        await MarketOrderItem.create({
            orderId: oldUnpaidOrder._id,
            sellerId: seller._id,
            productId: new mongoose.Types.ObjectId(),
            quantity: 1,
            price: 2000
        });

        console.log(chalk.green('✓ Created 1 paid order, 1 recent unpaid order, and 1 old unpaid order.'));

        // 2. Test Visibility
        console.log(chalk.blue('\n--- Test 1: Visibility Filtering ---'));

        const customerOrders = await orderService.getCustomerOrders(customer._id);
        const hasUnpaid = customerOrders.orders.some(o => o.payment.status === 'pending');
        const hasPaid = customerOrders.orders.some(o => o.payment.status === 'completed');

        if (!hasUnpaid && hasPaid) {
            console.log(chalk.green('✓ SUCCESS: Unpaid orders are hidden from Customer dashboard. Only paid orders show.'));
        } else {
            console.log(chalk.red(`✗ FAILURE: Visibility check failed. hasUnpaid=${hasUnpaid}, hasPaid=${hasPaid}`));
        }

        const sellerOrders = await orderService.getSellerOrders(seller._id);
        const sellerHasUnpaid = sellerOrders.orders.some(o => o.payment.status === 'pending');
        if (!sellerHasUnpaid) {
            console.log(chalk.green('✓ SUCCESS: Unpaid orders are hidden from Seller dashboard.'));
        } else {
            console.log(chalk.red('✗ FAILURE: Unpaid orders still visible to Seller.'));
        }

        // 3. Test Cleanup
        console.log(chalk.blue('\n--- Test 2: Cleanup Service ---'));
        console.log('Running cleanup logic manually...');
        await cleanupService.cleanupUnpaidOrders();

        const remainingOld = await MarketOrder.findById(oldUnpaidOrder._id);
        const remainingRecent = await MarketOrder.findById(recentUnpaidOrder._id);
        const remainingPaid = await MarketOrder.findById(paidOrder._id);

        if (!remainingOld) {
            console.log(chalk.green('✓ SUCCESS: Old unpaid order (48h) was deleted.'));
        } else {
            console.log(chalk.red('✗ FAILURE: Old unpaid order was NOT deleted.'));
        }

        if (remainingRecent) {
            console.log(chalk.green('✓ SUCCESS: Recent unpaid order was preserved.'));
        } else {
            console.log(chalk.red('✗ FAILURE: Recent unpaid order was incorrectly deleted.'));
        }

        if (remainingPaid) {
            console.log(chalk.green('✓ SUCCESS: Paid order was preserved.'));
        } else {
            console.log(chalk.red('✗ FAILURE: Paid order was incorrectly deleted.'));
        }

        console.log(chalk.blue('\n--- Cleanup Test Completed ---'));

    } catch (error) {
        console.error(chalk.red('\n✗ Test Failed:'), error);
    } finally {
        // Cleanup all test data
        await MarketOrder.deleteMany({ 'shipping.address.street': { $in: ['Paid St', 'Unpaid St', 'Old St'] } });
        await mongoose.connection.close();
        process.exit();
    }
}

testOrderCleanup();
