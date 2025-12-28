const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();

const orderService = require('./src/services/order.service');
const walletService = require('./src/services/wallet.service');
const MarketOrder = require('./src/models/MarketOrder');
const MarketOrderItem = require('./src/models/MarketOrderItem');
const { MarketUser } = require('./src/models/MarketUser');

async function testConfirmReceipt() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        // 1. Setup Test Data
        console.log(chalk.blue('\n--- Setup Test Data ---'));

        const customer = await MarketUser.findOne({ role: 'customer' });
        if (!customer) throw new Error('No customer found. Run populate-data.js first.');

        const seller = await MarketUser.findOne({ role: 'seller' });
        if (!seller) throw new Error('No seller found.');

        // Get initial seller balance
        const initialSellerBal = (await walletService.getBalance(seller._id)).balance;
        console.log(`Initial Seller Balance: ₦${initialSellerBal}`);

        // Create a PAID order
        const paidOrder = new MarketOrder({
            customerId: customer._id,
            status: 'confirmed',
            totals: { final: 5000, subtotal: 5000 },
            payment: { status: 'completed', method: 'card' },
            shipping: { address: { street: 'Escrow St' } }
        });
        await paidOrder.save();

        const item = await MarketOrderItem.create({
            orderId: paidOrder._id,
            sellerId: seller._id,
            productId: new mongoose.Types.ObjectId(),
            quantity: 1,
            price: 5000,
            totalPrice: 5000,
            status: 'confirmed'
        });

        console.log(chalk.green(`✓ Created paid order ${paidOrder._id} (Item: ${item._id}, Amount: ₦5000)`));

        // 2. Test Confirmation and Payout
        console.log(chalk.blue('\n--- Test: Confirm Receipt and Fund Release ---'));

        const result = await orderService.confirmReceipt(customer._id, paidOrder._id);
        console.log(chalk.green(`✓ Result from service: ${result.message}`));

        // 3. Verify Database Updates
        const updatedOrder = await MarketOrder.findById(paidOrder._id);
        const updatedItem = await MarketOrderItem.findById(item._id);
        const finalSellerBal = (await walletService.getBalance(seller._id)).balance;

        console.log(`Final Seller Balance: ₦${finalSellerBal}`);

        if (updatedOrder.status === 'delivered') {
            console.log(chalk.green('✓ SUCCESS: Order status updated to delivered.'));
        } else {
            console.log(chalk.red(`✗ FAILURE: Order status is ${updatedOrder.status}`));
        }

        if (updatedItem.status === 'delivered') {
            console.log(chalk.green('✓ SUCCESS: Order Item status updated to delivered.'));
        } else {
            console.log(chalk.red(`✗ FAILURE: Order Item status is ${updatedItem.status}`));
        }

        if (finalSellerBal === initialSellerBal + 5000) {
            console.log(chalk.green('✓ SUCCESS: Seller wallet credited with ₦5000.'));
        } else {
            console.log(chalk.red(`✗ FAILURE: Seller wallet balance mismatch. Expected ₦${initialSellerBal + 5000}, got ₦${finalSellerBal}`));
        }

        console.log(chalk.blue('\n--- Test Completed ---'));

    } catch (error) {
        console.error(chalk.red('\n✗ Test Failed:'), error);
    } finally {
        // Cleanup test data
        await MarketOrder.deleteMany({ 'shipping.address.street': 'Escrow St' });
        // NOTE: We don't cleanup the wallet credit in this script to keep it simple, 
        // but it's fine for testing.
        await mongoose.connection.close();
        process.exit();
    }
}

testConfirmReceipt();
