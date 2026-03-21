require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const MarketOrder = require('../src/models/MarketOrder');
    const MarketOrderItem = require('../src/models/MarketOrderItem');
    const { MarketUser } = require('../src/models/MarketUser');
    const MarketProduct = require('../src/models/MarketProduct');
    const RewardSettings = require('../src/models/RewardSettings');
    
    const buyer = await MarketUser.findOne({ email: 'buyer@test.com' });
    const seller = await MarketUser.findOne({ email: 'seller@test.com' });
    
    const product = await MarketProduct.findOne({ sellerId: seller._id, status: 'active', name: 'Samsung Galaxy S23' });
    
    const subtotal = product.price.current * 1;
    const settings = await RewardSettings.getSettings();
    const tax = settings.checkoutFees?.tax || 250;
    const escrowProtection = subtotal * (settings.checkoutFees?.escrowProtectionRate || 0.025);
    const service = settings.checkoutFees?.serviceFee || 50;
    const final = subtotal + tax + escrowProtection + service;
    
    const order = new MarketOrder({
        customerId: buyer._id,
        status: 'pending',
        payment: { method: 'paystack', status: 'pending' },
        shipping: {
            address: { fullName: buyer.fullName, phoneNumber: buyer.phoneNumber, street: '123 Test', city: 'Lagos', state: 'Lagos', country: 'Nigeria' },
            method: 'standard'
        },
        totals: { subtotal, tax, escrowProtection, service, final }
    });
    await order.save();
    
    const item = new MarketOrderItem({
        orderId: order._id,
        productId: product._id,
        sellerId: seller._id,
        quantity: 1,
        price: product.price.current,
        status: 'processing'
    });
    await item.save();
    
    order.payment.status = 'completed';
    order.status = 'processing';
    await order.save();
    
    const generateTrackingNumber = () => {
        const timestamp = Date.now().toString(36).toUpperCase();
        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
        return 'SELLIO-' + timestamp + '-' + randomPart;
    };
    
    const trackingNumber = generateTrackingNumber();
    item.status = 'shipped';
    item.fulfillmentProof = 'https://via.placeholder.com/300';
    item.fulfillmentDate = new Date();
    await item.save();
    
    order.shipping.tracking = { number: trackingNumber, url: null };
    await order.save();
    
    console.log('=== FULL ORDER RESPONSE ===');
    console.log(JSON.stringify(order, null, 2));
    console.log('\n=== FULL ORDER ITEM RESPONSE ===');
    console.log(JSON.stringify(item, null, 2));
    
    await mongoose.connection.close();
});
