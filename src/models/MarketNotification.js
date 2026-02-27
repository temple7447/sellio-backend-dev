const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketUser',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: [
            // Customer notifications
            'order_created',
            'payment_successful',
            'order_shipped',
            'order_delivered',
            'order_cancelled',
            'complaint_resolved',
            'review_request',
            'wallet_credited',
            'wallet_debited',
            'withdrawal_approved',
            'withdrawal_rejected',
            'withdrawal_completed',
            'product_back_in_stock',
            'price_drop_alert',
            'email_verification',
            'password_reset',
            
            // Seller notifications
            'new_order_received',
            'payment_confirmed',
            'buyer_confirmed_receipt',
            'order_item_cancelled',
            'new_review_received',
            'low_stock_alert',
            'seller_verification_status',
            'seller_payment_deposited',
            'seller_withdrawal_request_status',
            'complaint_filed_on_item',
            
            // Admin notifications
            'complaint_filed',
            'new_seller_verification_request',
            'high_value_order_issue',
            'seller_dispute_reported',
            'large_withdrawal_request',
            'payment_reconciliation_issue',
            'system_error'
        ],
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    data: {
        orderId: mongoose.Schema.Types.ObjectId,
        orderItemId: mongoose.Schema.Types.ObjectId,
        productId: mongoose.Schema.Types.ObjectId,
        sellerId: mongoose.Schema.Types.ObjectId,
        complaintId: mongoose.Schema.Types.ObjectId,
        amount: Number,
        reference: String,
        status: String,
        reason: String,
        link: String
    },
    channels: {
        inApp: {
            sent: Boolean,
            sentAt: Date
        },
        email: {
            sent: Boolean,
            sentAt: Date,
            read: { type: Boolean, default: false }
        },
        sms: {
            sent: Boolean,
            sentAt: Date,
            phoneNumber: String
        }
    },
    read: {
        type: Boolean,
        default: false,
        index: true
    },
    readAt: Date,
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
        default: 'pending'
    },
    retryCount: {
        type: Number,
        default: 0
    },
    lastRetryAt: Date,
    failureReason: String
}, {
    timestamps: true,
    indexes: [
        { userId: 1, read: 1 },
        { userId: 1, createdAt: -1 },
        { type: 1, status: 1 },
        { userId: 1, type: 1 }
    ]
});

// Mark as read
notificationSchema.methods.markAsRead = function() {
    this.read = true;
    this.readAt = new Date();
    this.channels.email.read = true;
    return this.save();
};

// Mark email as sent
notificationSchema.methods.markEmailSent = function(error = null) {
    this.channels.email.sent = !error;
    this.channels.email.sentAt = new Date();
    if (error) {
        this.failureReason = error;
        this.retryCount += 1;
    }
    return this.save();
};

module.exports = mongoose.model('MarketNotification', notificationSchema);
