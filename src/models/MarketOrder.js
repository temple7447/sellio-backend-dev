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

    // We no longer store items array directly here. 
    // Data is stored in MarketOrderItem collection for better scalability.
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'disputed'],
        default: 'pending'
    },
    payment: {
        method: {
            type: String,
            default: 'paystack'
        },
        status: {
            type: String,
            enum: ['pending', 'pending_verification', 'completed', 'failed', 'refunded', 'processing'],
            default: 'pending'
        },
        transactionId: String,
        proofUrl: String,
        transferredAmount: Number,
        receivedAmount: Number,
        refundedAmount: Number,
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
        escrowProtection: Number,
        service: Number,
        shipping: Number,
        discount: Number,
        final: Number
    },
    cancellationReason: {
        type: String,
        default: null
    },
    cancelledBy: {
        type: String,
        enum: ['customer', 'seller', 'admin', 'system', null],
        default: null
    }
}, {
    timestamps: true,
    strict: true
});

// Indexes
orderSchema.index({ guestEmail: 1 });
orderSchema.index({ 'items.sellerId': 1 });

module.exports = mongoose.model('MarketOrder', orderSchema);
