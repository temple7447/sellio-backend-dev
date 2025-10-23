const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    // Optional for guests; present for registered customers
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketUser',
        required: false
    },

    // For guest checkouts
    guestEmail: {
        type: String,
        trim: true
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
            default: 'paystack'
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'refunded', 'processing'],
            default: 'pending'
        },
        transactionId: String,
        metadata: {}
    },
    shipping: {
        address: {
            fullName: String,
            phoneNumber: String,
            email: String, // optional, useful for guests
            street: String,
            city: String,
            state: String,
            zipCode: String,
            country: String
        },
        method: { type: String, default: 'standard' },
        tracking: {
            number: String,
            url: String
        },
        estimatedDelivery: Date,
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
    timestamps: true,
    strict: true
});

// Indexes
orderSchema.index({ guestEmail: 1 });
orderSchema.index({ 'items.sellerId': 1 });

module.exports = mongoose.model('MarketOrder', orderSchema);
