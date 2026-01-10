const mongoose = require('mongoose');

const orderComplainSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketOrder',
        required: true,
        index: true
    },
    orderItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketOrderItem',
        required: false,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketUser',
        required: true,
        index: true
    },
    role: {
        type: String,
        enum: ['customer', 'seller', 'admin'],
        required: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    complaint: {
        type: String,
        required: true,
        trim: true
    },
    images: [{
        type: String // Cloudinary URLs
    }],
    status: {
        type: String,
        enum: ['pending', 'in-review', 'resolved', 'dismissed'],
        default: 'pending',
        index: true
    },
    resolution: {
        type: String,
        default: null
    },
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketUser',
        default: null
    },
    resolvedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Index for reporting
orderComplainSchema.index({ createdAt: -1 });

module.exports = mongoose.model('MarketOrderComplain', orderComplainSchema);
