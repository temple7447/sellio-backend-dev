const mongoose = require('mongoose');
require('dotenv').config();
const { MarketUser } = require('../src/models/MarketUser');
const MarketProduct = require('../src/models/MarketProduct');
const MarketOrder = require('../src/models/MarketOrder');
const MarketOrderItem = require('../src/models/MarketOrderItem');
const RewardSettings = require('../src/models/RewardSettings');

async function createOrderAndPay() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ Connected to MongoDB\n');

        // Get buyer
        const buyer = await MarketUser.findOne({ email: 'buyer@test.com' });
        if (!buyer) {
            console.log('Buyer not found. Run create-test-data.js first.');
            return;
        }
        console.log(`✓ Buyer: ${buyer.email}`);

        // Get a product from seller
        const product = await MarketProduct.findOne({ 
            sellerId: buyer._id,  // Wait, the seller is the one who created the products
            status: 'active' 
        });
        
        // Get the actual seller
        const seller = await MarketUser.findOne({ email: 'seller@test.com' });
        const sellerProduct = await MarketProduct.findOne({ 
            sellerId: seller._id,
            status: 'active' 
        });

        if (!sellerProduct) {
            console.log('No seller product found');
            return;
        }
        console.log(`✓ Product: ${sellerProduct.name} - ₦${sellerProduct.price.current}`);

        // Calculate totals (same logic as order service)
        const subtotal = sellerProduct.price.current * 1; // 1 quantity
        const settings = await RewardSettings.getSettings();
        const tax = settings.checkoutFees?.tax || 250;
        const escrowProtection = subtotal * (settings.checkoutFees?.escrowProtectionRate || 0.025);
        const service = settings.checkoutFees?.serviceFee || 50;
        const final = subtotal + tax + escrowProtection + service;

        console.log(`\n📋 Order Details:`);
        console.log(`   Subtotal: ₦${subtotal}`);
        console.log(`   Tax: ₦${tax}`);
        console.log(`   Escrow: ₦${escrowProtection.toFixed(2)}`);
        console.log(`   Service: ₦${service}`);
        console.log(`   Total: ₦${final.toFixed(2)}`);

        // Create order
        const order = new MarketOrder({
            customerId: buyer._id,
            status: 'pending',
            payment: {
                method: 'paystack',
                status: 'pending',
                reference: `TEST-${Date.now()}`
            },
            shipping: {
                address: {
                    fullName: buyer.fullName,
                    phoneNumber: buyer.phoneNumber,
                    street: '123 Test Street',
                    city: 'Lagos',
                    state: 'Lagos',
                    country: 'Nigeria'
                },
                method: 'standard'
            },
            totals: {
                subtotal,
                tax,
                escrowProtection,
                service,
                final
            }
        });
        await order.save();
        console.log(`\n✓ Order created: ${order._id}`);

        // Create order item
        const orderItem = new MarketOrderItem({
            orderId: order._id,
            productId: sellerProduct._id,
            sellerId: sellerProduct.sellerId,
            quantity: 1,
            price: sellerProduct.price.current,
            status: 'pending'
        });
        await orderItem.save();
        console.log('✓ Order item created');

        // Simulate payment - update order to paid
        order.payment.status = 'completed';
        order.status = 'processing';
        await order.save();
        
        // Update order item status
        orderItem.status = 'processing';
        await orderItem.save();

        // Reduce inventory
        sellerProduct.inventory.quantity -= 1;
        await sellerProduct.save();

        console.log('\n✅ PAYMENT SIMULATED SUCCESSFULLY!');
        console.log('='.repeat(40));
        console.log(`Order ID: ${order._id}`);
        console.log(`Amount Paid: ₦${final.toFixed(2)}`);
        console.log(`Status: Paid & Processing`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

createOrderAndPay();
