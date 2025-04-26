const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketUser',
        required: true
    },
    items: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'MarketProduct',
            required: true
        },
        sellerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'MarketUser',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true
        }
    }],
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
        default: 'pending'
    },
    payment: {
        method: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'refunded'],
            default: 'pending'
        },
        transactionId: String
    },
    shipping: {
        address: {
            street: String,
            city: String,
            state: String,
            zipCode: String,
            country: String
        },
        tracking: {
            number: String,
            url: String
        },
        cost: Number
    },
    totals: {
        subtotal: Number,
        tax: Number,
        shipping: Number,
        discount: Number,
        final: Number
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('MarketOrder', orderSchema);
