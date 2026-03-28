const mongoose = require('mongoose');

const AD_PLACEMENTS = {
    home_page_banner: { label: 'Home Page Banner', dailyRate: 150, description: 'Prominent banner placement on the homepage — highest visibility' },
    product_page: { label: 'Product Page', dailyRate: 70, description: 'Recommended products section — highly targeted placements' },
    recommended_product: { label: 'Recommended Product', dailyRate: 100, description: 'Featured in recommended products across the platform' }
};

const adCampaignSchema = new mongoose.Schema({
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketUser',
        required: true,
        index: true
    },
    placement: {
        type: String,
        enum: Object.keys(AD_PLACEMENTS),
        required: true
    },
    totalBudget: {
        type: Number,
        required: true,
        min: 1000
    },
    dailyRate: {
        type: Number,
        required: true
    },
    durationDays: {
        type: Number,
        required: true,
        min: 1
    },
    startDate: {
        type: Date,
        default: null
    },
    endDate: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'paused', 'completed', 'cancelled'],
        default: 'pending',
        index: true
    },
    reference: {
        type: String,
        unique: true,
        required: true
    },
    walletTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WalletTransaction'
    },
    clicks: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

adCampaignSchema.index({ sellerId: 1, status: 1 });
adCampaignSchema.index({ placement: 1, status: 1 });
adCampaignSchema.index({ endDate: 1, status: 1 });

module.exports = { AdCampaign: mongoose.model('AdCampaign', adCampaignSchema), AD_PLACEMENTS };
