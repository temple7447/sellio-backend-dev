const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketOrder',
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
        min: 1
    },
    price: {
        type: Number,
        required: true
    },
    totalPrice: {
        type: Number
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
        default: 'pending',
        index: true
    },
    fulfillmentProof: {
        type: String,
        default: null
    },
    fulfillmentDate: {
        type: Date,
        default: null
    },
    buyerProof: {
        type: String,
        default: null
    },
    buyerConfirmationDate: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Calculate totalPrice before saving
orderItemSchema.pre('save', function (next) {
    this.totalPrice = this.price * this.quantity;
    next();
});

// Index for seller sales analytics
orderItemSchema.index({ sellerId: 1, createdAt: -1 });
orderItemSchema.index({ productId: 1, createdAt: -1 });

module.exports = mongoose.model('MarketOrderItem', orderItemSchema);
