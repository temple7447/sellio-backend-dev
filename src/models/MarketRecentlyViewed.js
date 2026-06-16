const mongoose = require('mongoose');

/**
 * One row per (user, product) — upserted each time a signed-in user opens a
 * product. Powers the "Recently viewed" rail and seeds the "For You" feed.
 */
const recentlyViewedSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketUser',
        required: true,
        index: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketProduct',
        required: true,
        index: true
    },
    viewedAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

// One entry per product per user (we bump viewedAt on re-view).
recentlyViewedSchema.index({ userId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model('MarketRecentlyViewed', recentlyViewedSchema);
