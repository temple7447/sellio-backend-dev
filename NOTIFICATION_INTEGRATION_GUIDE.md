# Notification System Integration Guide

This guide shows how to integrate the notification system into existing order, wallet, and complaint services.

---

## 1. Order Service Integration

### Notify Order Confirmation (When order is created)

**File:** `src/services/order.service.js`

```javascript
const notificationService = require('./notification.service');

async createOrder(customerId, items, shippingDetails, paymentMethod) {
    // ... existing order creation logic ...
    
    const newOrder = await MarketOrder.create({
        customerId,
        items: orderItems,
        shippingDetails,
        paymentMethod,
        status: 'pending'
    });

    // ✅ Send notification to customer
    const customer = await MarketUser.findById(customerId);
    await notificationService.notifyOrderConfirmation(
        customer,
        newOrder._id,
        items, // with product names
        newOrder.totals.final
    );

    return newOrder;
}
```

### Notify Payment Successful (When payment is verified)

```javascript
async verifyPayment(orderId, reference, amount) {
    const order = await MarketOrder.findById(orderId);
    
    // ... verify with Paystack ...
    
    order.payment.status = 'completed';
    order.status = 'confirmed';
    await order.save();

    // ✅ Send notification to customer
    const customer = await MarketUser.findById(order.customerId);
    await notificationService.notifyPaymentSuccessful(
        customer,
        orderId,
        amount,
        reference
    );

    return order;
}
```

### Notify Order Shipped (When seller uploads fulfillment proof)

```javascript
async uploadFulfillmentProof(orderItemId, proofUrl) {
    const orderItem = await MarketOrderItem.findById(orderItemId)
        .populate('orderId')
        .populate('productId');
    
    orderItem.status = 'shipped';
    orderItem.fulfillmentProof = proofUrl;
    orderItem.fulfillmentDate = new Date();
    await orderItem.save();

    // ✅ Send notification to customer
    const order = orderItem.orderId;
    const customer = await MarketUser.findById(order.customerId);
    
    await notificationService.notifyOrderShipped(
        customer,
        order._id,
        [{ productName: orderItem.productId.name, quantity: orderItem.quantity }],
        orderItem.trackingNumber || null
    );

    return orderItem;
}
```

### Notify Order Delivered (When customer confirms receipt)

```javascript
async confirmReceipt(orderId, itemIds, itemProofs) {
    const order = await MarketOrder.findById(orderId);
    
    // Update items to delivered
    await MarketOrderItem.updateMany(
        { _id: { $in: itemIds }, orderId },
        { status: 'delivered', buyerConfirmationDate: new Date() }
    );

    // ✅ Send notification to customer
    const customer = await MarketUser.findById(order.customerId);
    const items = await MarketOrderItem.find({ _id: { $in: itemIds } })
        .populate('productId', 'name')
        .populate('sellerId', 'businessName');
    
    await notificationService.notifyOrderDelivered(
        customer,
        orderId,
        items.map(item => ({
            productName: item.productId.name,
            quantity: item.quantity,
            sellerName: item.sellerId.businessName
        }))
    );

    return { message: 'Receipt confirmed' };
}
```

### Notify Order Cancelled (When customer or seller cancels)

```javascript
async cancelOrder(orderId, reason, refundAmount, cancelledBy) {
    const order = await MarketOrder.findById(orderId);
    
    order.status = 'cancelled';
    order.cancellationReason = reason;
    order.cancelledBy = cancelledBy;
    order.cancelledAt = new Date();
    await order.save();

    // ✅ Send notification to customer
    const customer = await MarketUser.findById(order.customerId);
    await notificationService.notifyOrderCancelled(
        customer,
        orderId,
        reason,
        refundAmount || order.totals.final
    );

    return order;
}
```

### Notify Sellers About New Orders

```javascript
async createOrder(customerId, items, shippingDetails, paymentMethod) {
    // ... create order ...

    // ✅ Notify each seller about their items
    const sellerOrders = {};
    
    items.forEach(item => {
        if (!sellerOrders[item.sellerId]) {
            sellerOrders[item.sellerId] = [];
        }
        sellerOrders[item.sellerId].push(item);
    });

    for (const [sellerId, sellerItems] of Object.entries(sellerOrders)) {
        const seller = await MarketUser.findById(sellerId);
        const customer = await MarketUser.findById(customerId);
        
        const totalAmount = sellerItems.reduce((sum, item) => 
            sum + (item.price * item.quantity), 0
        );
        
        await notificationService.notifySellerNewOrder(
            seller,
            newOrder._id,
            sellerItems,
            totalAmount,
            customer.fullName
        );
    }

    return newOrder;
}
```

---

## 2. Wallet Service Integration

### Notify Wallet Credited (For refunds, rewards, referrals)

**File:** `src/services/wallet.service.js`

```javascript
const notificationService = require('./notification.service');

async creditWallet(userId, amount, reason, reference, source = 'manual') {
    const wallet = await MarketWallet.findOne({ userId });
    
    // Create transaction
    const transaction = new WalletTransaction({
        wallet: wallet._id,
        type: 'credit',
        amount,
        reason,
        reference,
        source,
        balance_after: wallet.balance + amount
    });
    await transaction.save();

    // Update wallet
    wallet.balance += amount;
    await wallet.save();

    // ✅ Send notification
    const user = await MarketUser.findById(userId);
    await notificationService.notifyWalletCredited(
        user,
        amount,
        reason,
        reference
    );

    return { wallet, transaction };
}

async debitWallet(userId, amount, reason, reference) {
    const wallet = await MarketWallet.findOne({ userId });
    
    if (wallet.balance < amount) {
        throw { status: 400, message: 'Insufficient wallet balance' };
    }

    // Create transaction
    const transaction = new WalletTransaction({
        wallet: wallet._id,
        type: 'debit',
        amount,
        reason,
        reference,
        balance_after: wallet.balance - amount
    });
    await transaction.save();

    // Update wallet
    wallet.balance -= amount;
    await wallet.save();

    return { wallet, transaction };
}
```

### Notify Withdrawal Requests

```javascript
async requestWithdrawal(userId, amount, bankDetails) {
    const wallet = await MarketWallet.findOne({ userId });
    
    if (wallet.balance < amount) {
        throw { status: 400, message: 'Insufficient balance' };
    }

    const withdrawal = new WithdrawalRequest({
        userId,
        wallet: wallet._id,
        amount,
        bankDetails,
        status: 'pending'
    });
    await withdrawal.save();

    // ✅ Send in-app notification (no email yet)
    const user = await MarketUser.findById(userId);
    await notificationService.createNotification(
        user._id,
        'withdrawal_request_pending',
        'Withdrawal Request Submitted',
        `Your withdrawal request for ₦${amount.toLocaleString()} has been submitted`,
        { amount, reference: withdrawal._id }
    );

    return withdrawal;
}

async approveWithdrawal(withdrawalId) {
    const withdrawal = await WithdrawalRequest.findById(withdrawalId);
    
    withdrawal.status = 'approved';
    withdrawal.approvedAt = new Date();
    await withdrawal.save();

    // ✅ Send notification
    const user = await MarketUser.findById(withdrawal.userId);
    await notificationService.notifyWithdrawalStatus(
        user,
        withdrawal.amount,
        'approved'
    );

    return withdrawal;
}

async rejectWithdrawal(withdrawalId, reason) {
    const withdrawal = await WithdrawalRequest.findById(withdrawalId);
    
    withdrawal.status = 'rejected';
    withdrawal.rejectionReason = reason;
    withdrawal.rejectedAt = new Date();
    await withdrawal.save();

    // Refund to wallet
    const wallet = await MarketWallet.findById(withdrawal.wallet);
    wallet.balance += withdrawal.amount;
    await wallet.save();

    // ✅ Send notification
    const user = await MarketUser.findById(withdrawal.userId);
    await notificationService.notifyWithdrawalStatus(
        user,
        withdrawal.amount,
        'rejected',
        reason
    );

    return withdrawal;
}

async completeWithdrawal(withdrawalId, bankReference) {
    const withdrawal = await WithdrawalRequest.findById(withdrawalId);
    
    withdrawal.status = 'completed';
    withdrawal.completedAt = new Date();
    withdrawal.bankReference = bankReference;
    await withdrawal.save();

    // ✅ Send notification
    const user = await MarketUser.findById(withdrawal.userId);
    await notificationService.notifyWithdrawalStatus(
        user,
        withdrawal.amount,
        'completed'
    );

    return withdrawal;
}
```

---

## 3. Complaint Service Integration

### Notify Complaint Resolution

**File:** `src/services/complaint.service.js` (or in order controller)

```javascript
const notificationService = require('./notification.service');

async resolveComplaint(complaintId, decision, resolution) {
    const complaint = await MarketOrderComplain.findById(complaintId)
        .populate('userId')
        .populate('sellerId');
    
    complaint.status = decision; // 'resolved', 'dismissed', etc.
    complaint.resolution = resolution;
    complaint.resolvedAt = new Date();
    await complaint.save();

    // ✅ Notify customer
    await notificationService.notifyComplaintResolved(
        complaint.userId,
        complaintId,
        resolution,
        decision
    );

    // ✅ Notify seller
    await notificationService.createNotification(
        complaint.sellerId._id,
        'complaint_resolved',
        'Complaint Resolved',
        `Complaint on order ${complaint.orderId} has been resolved: ${decision}`,
        { complaintId, orderId: complaint.orderId, decision }
    );

    return complaint;
}

async fileComplaint(orderId, userId, subject, complaint, images) {
    const newComplaint = new MarketOrderComplain({
        orderId,
        userId,
        subject,
        complaint,
        images,
        status: 'pending'
    });
    await newComplaint.save();

    // ✅ Notify admin
    const admin = await MarketUser.findOne({ role: 'admin' });
    await notificationService.notifyAdminComplaintFiled(
        admin,
        newComplaint._id,
        orderId,
        userId,
        subject
    );

    // ✅ Notify seller
    const order = await MarketOrder.findById(orderId);
    const orderItems = await MarketOrderItem.find({ orderId });
    const seller = orderItems[0].sellerId;
    
    await notificationService.notifySellerComplaintFiled(
        seller,
        newComplaint._id,
        orderId,
        subject
    );

    return newComplaint;
}
```

---

## 4. Seller Inventory Integration

### Notify Low Stock

**File:** `src/services/product.service.js`

```javascript
const notificationService = require('./notification.service');

async updateProductStock(productId, newQuantity) {
    const product = await MarketProduct.findById(productId);
    const previousQuantity = product.inventory.quantity;
    
    product.inventory.quantity = newQuantity;
    await product.save();

    // Check if stock is low
    if (newQuantity > 0 && 
        newQuantity <= product.inventory.lowStockAlert && 
        previousQuantity > product.inventory.lowStockAlert) {
        
        // ✅ Send low stock alert to seller
        const seller = await MarketUser.findById(product.sellerId);
        await notificationService.notifySellerLowStock(
            seller,
            product.name,
            newQuantity,
            product.inventory.lowStockAlert
        );
    }

    return product;
}
```

---

## 5. Authentication Service Integration

### Notify OTP and Password Reset

**File:** `src/services/auth.service.js`

```javascript
const notificationService = require('./notification.service');

async sendOTP(email, userId, purpose = 'verification') {
    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit
    
    // Store OTP in database
    const otpRecord = new MarketOTP({
        user: userId,
        code: otp,
        purpose,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });
    await otpRecord.save();

    // ✅ Send OTP notification
    const user = await MarketUser.findById(userId);
    await notificationService.notifyOTP(user, otp, purpose);

    return { message: 'OTP sent' };
}

async initiatePasswordReset(email) {
    const user = await MarketUser.findOne({ email });
    
    if (!user) {
        throw { status: 404, message: 'User not found' };
    }

    // Generate reset token
    const resetToken = generateToken(); // Generate random token
    const resetCode = Math.floor(100000 + Math.random() * 900000);
    
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // ✅ Send password reset notification
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    // Using email service directly or through notification
    await notificationService.createNotification(
        user._id,
        'password_reset',
        'Password Reset Request',
        'A password reset request has been made for your account',
        { link: resetUrl }
    );

    return { message: 'Password reset link sent' };
}
```

---

## Integration Checklist

- [ ] Import `notificationService` in each service file
- [ ] Add notification calls after successful operations
- [ ] Test each notification type
- [ ] Configure Mailtrap credentials in `.env`
- [ ] Set up email templates (already done)
- [ ] Add frontend notification center UI
- [ ] Implement WebSocket for real-time updates (optional)
- [ ] Create testing script for all notification types

---

## Testing Integration

### Test Script Example

```javascript
// scripts/test-notifications.js
const notificationService = require('../src/services/notification.service');
const MarketUser = require('../src/models/MarketUser');
const mongoose = require('mongoose');

async function testNotifications() {
    // Connect to DB
    await mongoose.connect(process.env.MONGODB_URI);

    // Find test user
    const user = await MarketUser.findOne({ email: 'test@example.com' });

    // Test order confirmation
    console.log('Testing order confirmation...');
    await notificationService.notifyOrderConfirmation(
        user,
        '123456',
        [{ productName: 'Test Product', quantity: 2, price: 5000 }],
        10000
    );

    // Test wallet credit
    console.log('Testing wallet credit...');
    await notificationService.notifyWalletCredited(
        user,
        5000,
        'Refund',
        'REF-123'
    );

    // Test withdrawal
    console.log('Testing withdrawal status...');
    await notificationService.notifyWithdrawalStatus(
        user,
        25000,
        'approved'
    );

    console.log('✅ All tests completed. Check Mailtrap for emails!');
    process.exit(0);
}

testNotifications().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
```

Run with: `node scripts/test-notifications.js`

---

## Notes

1. **Email Failures**: In production, implement email retry mechanism (done in notification model with retryCount)
2. **SMS Integration**: SMS template methods exist in email service, connect to Twilio or similar
3. **Real-time**: Consider adding Socket.io for real-time in-app notifications
4. **Rate Limiting**: Consider adding rate limiting to prevent notification spam
5. **Preferences**: Notification preferences should be stored in user model or separate collection for user control

---

## Support

For issues or questions about notification integration, refer to `NOTIFICATION_SYSTEM.md` for complete API documentation.
