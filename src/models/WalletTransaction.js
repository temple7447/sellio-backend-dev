const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketUser',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: [
            'deposit',         // Customer adds funds
            'withdrawal',      // Seller withdraws to bank
            'payment',         // Customer pays for order
            'refund',          // Refund to customer
            'earning',         // Seller receives payment
            'transfer',        // Transfer between users
            'referral_bonus',  // Referral reward (₦500)
            'cashback',        // Cashback reward (₦1,000)
            'ad_spend'         // Ad campaign payment
        ],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    balanceBefore: {
        type: Number,
        required: true
    },
    balanceAfter: {
        type: Number,
        required: true
    },
    reference: {
        type: String,
        unique: true,
        required: true,
        index: true
    },
    relatedOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketOrder',
        default: null
    },
    paymentGateway: {
        type: String,
        enum: ['paystack', 'korapay', 'manual', 'system', 'wallet'],
        default: 'system'
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'reversed'],
        default: 'completed'
    },
    description: {
        type: String,
        required: true
    },
    metadata: {
        type: Object,
        default: {}
    }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index({ reference: 1 });
walletTransactionSchema.index({ type: 1, status: 1 });
walletTransactionSchema.index({ userId: 1, type: 1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
