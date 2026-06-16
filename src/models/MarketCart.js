const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
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
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketUser',
        required: true,
        index: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1
    },
    price: {
        type: Number,
        required: true
    },
    // Selected product variant (optional). References an embedded
    // product.variants subdocument by its _id; label is denormalised for display.
    variantId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    variantLabel: {
        type: String,
        default: null
    },
    variantImage: {
        type: String,
        default: null
    },
    addedAt: {
        type: Date,
        default: Date.now
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    }
}, {
    timestamps: true
});

// Create index for user cart
cartItemSchema.index({ userId: 1, isDeleted: 1 });
cartItemSchema.index({ userId: 1, productId: 1 });

const MarketCart = mongoose.model('MarketCart', cartItemSchema);

module.exports = MarketCart;
