const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();

const orderService = require('../src/services/order.service');
const walletService = require('../src/services/wallet.service');
const paystackService = require('../src/utils/paystack');
const MarketOrder = require('../src/models/MarketOrder');
const MarketOrderItem = require('../src/models/MarketOrderItem');
const MarketProduct = require('../src/models/MarketProduct');
const { MarketUser } = require('../src/models/MarketUser');
const MarketReferral = require('../src/models/MarketReferral');

// Monkey-patch Paystack service to mock success
paystackService.verifyTransaction = async (reference) => {
    console.log(chalk.gray(`[MOCK] Verifying Paystack reference: ${reference}`));
    return {
        status: 'success',
        reference: reference,
        amount: 500000, // 5000 Naira in kobo
        channel: 'card',
        paid_at: new Date().toISOString()
    };
};

async function runFullLifecycleTest() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        // --- SETUP ---
        const customer = await MarketUser.findOne({ email: 'customer1@example.com' });
        const seller = await MarketUser.findOne({ email: 'test_seller1@example.com' });
        const product = await MarketProduct.findOne({ sellerId: seller._id, status: 'active' });

        if (!customer || !seller || !product) {
            throw new Error('Required test data missing. Run populate-data.js first.');
        }

        const initialInventory = product.inventory.quantity;
        const initialSellerBal = (await walletService.getBalance(seller._id)).balance;
        const initialCustomerBal = (await walletService.getBalance(customer._id)).balance;

        console.log(chalk.cyan(`\nStarting Full Lifecycle Test for ${customer.email}`));
        console.log(`Initial Inventory: ${initialInventory}`);
        console.log(`Initial Seller Balance: ₦${initialSellerBal}`);
        console.log(`Initial Customer Balance: ₦${initialCustomerBal}`);

        // --- STAGE 1: CHECKOUT ---
        console.log(chalk.yellow('\n--- STAGE 1: Checkout ---'));
        const orderData = {
            items: [{
                productId: product._id,
                quantity: 2
            }],
            shippingDetails: {
                fullName: customer.fullName,
                phoneNumber: customer.phoneNumber,
                address: {
                    street: '123 Lifecycle Ave',
                    city: 'Lagos',
                    state: 'Lagos',
                    country: 'Nigeria'
                }
            }
        };

        const order = await orderService.createCustomerOrder(customer._id, orderData);
        console.log(chalk.green(`✓ Order Created: ID ${order._id}`));

        const pendingOrder = await MarketOrder.findById(order._id);
        if (pendingOrder.status === 'pending') {
            console.log(chalk.green('✓ SUCCESS: Order status is "pending" after checkout.'));
        }

        // --- STAGE 2: PAYMENT VERIFICATION ---
        console.log(chalk.yellow('\n--- STAGE 2: Payment Verification ---'));
        const reference = `ORD-${order._id}`;
        const verifyResult = await orderService.verifyPayment(reference);

        console.log(chalk.green(`✓ Payment Verified: ${verifyResult.transaction.status}`));

        const confirmedOrder = await MarketOrder.findById(order._id);
        const updatedProduct = await MarketProduct.findById(product._id);
        const postPaymentCustomerBal = (await walletService.getBalance(customer._id)).balance;

        if (confirmedOrder.status === 'confirmed') {
            console.log(chalk.green('✓ SUCCESS: Order status updated to "confirmed".'));
        }

        if (updatedProduct.inventory.quantity === initialInventory - 2) {
            console.log(chalk.green(`✓ SUCCESS: Inventory decreased from ${initialInventory} to ${updatedProduct.inventory.quantity}.`));
        } else {
            console.log(chalk.red(`✗ FAILURE: Inventory mismatch. Expected ${initialInventory - 2}, got ${updatedProduct.inventory.quantity}`));
        }

        if (postPaymentCustomerBal > initialCustomerBal) {
            console.log(chalk.green(`✓ SUCCESS: Customer received cashback reward. New Balance: ₦${postPaymentCustomerBal}`));
        }

        // --- STAGE 3: CONFIRM RECEIPT ---
        console.log(chalk.yellow('\n--- STAGE 3: Confirm Receipt ---'));
        const receiptResult = await orderService.confirmReceipt(customer._id, order._id);
        console.log(chalk.green(`✓ Receipt Confirmed: ${receiptResult.message}`));

        const deliveredOrder = await MarketOrder.findById(order._id);
        const finalSellerBal = (await walletService.getBalance(seller._id)).balance;
        const totalPrice = order.totals.subtotal; // Subtotal for the items

        if (deliveredOrder.status === 'delivered') {
            console.log(chalk.green('✓ SUCCESS: Order status updated to "delivered".'));
        }

        if (finalSellerBal === initialSellerBal + (product.price.current * 2)) {
            console.log(chalk.green(`✓ SUCCESS: Seller wallet credited with ₦${product.price.current * 2}. New Balance: ₦${finalSellerBal}`));
        } else {
            console.log(chalk.red(`✗ FAILURE: Seller balance mismatch. Expected ₦${initialSellerBal + (product.price.current * 2)}, got ₦${finalSellerBal}`));
        }

        console.log(chalk.blue('\n--- FULL LIFECYCLE TEST COMPLETED SUCCESSFULLY ---'));

    } catch (error) {
        console.error(chalk.red('\n✗ Test Failed:'), error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

runFullLifecycleTest();
