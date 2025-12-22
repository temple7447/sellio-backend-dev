const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
    referrerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketUser',
        required: true,
        index: true
    },
    referredUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketUser',
        required: true,
        unique: true,
        index: true
    },
    status: {
        type: String,
        enum: ['signed_up', 'verified', 'bonus_paid', 'failed'],
        default: 'signed_up',
        index: true
    },
    bonusAmount: {
        type: Number,
        default: 0
    },
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WalletTransaction',
        default: null
    },
    signupDate: {
        type: Date,
        default: Date.now
    },
    completionDate: {
        type: Date,
        default: null
    },
    metadata: {
        type: Object,
        default: {}
    }
}, {
    timestamps: true
});

// Compound index for finding all referrals by a specific referrer
referralSchema.index({ referrerId: 1, createdAt: -1 });

module.exports = mongoose.model('MarketReferral', referralSchema);
