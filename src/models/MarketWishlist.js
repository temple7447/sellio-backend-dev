const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
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
    }
}, {
    timestamps: true
});

// Unique index to prevent duplicate entries for the same user and product
wishlistSchema.index({ userId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model('MarketWishlist', wishlistSchema);
