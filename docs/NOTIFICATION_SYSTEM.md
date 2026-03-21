# Notification System Documentation

## Overview
The Campus Trade notification system provides comprehensive multi-channel notifications (in-app, email, SMS) for all platform activities including orders, payments, wallet transactions, complaints, and more.

## Architecture

### Components
1. **MarketNotification Model** - Stores all notifications
2. **Email Service** - Handles email templates and sending via Mailtrap
3. **Notification Service** - Business logic for creating and managing notifications
4. **Notification Controller** - API endpoints for retrieving notifications
5. **Notification Routes** - RESTful API routes

---

## Notification Types

### CUSTOMER NOTIFICATIONS

#### Order Management
- **order_created** - Order placed and confirmed
- **payment_successful** - Payment received and verified
- **order_shipped** - Item shipped with tracking info
- **order_delivered** - Item delivered, awaiting receipt confirmation
- **order_cancelled** - Order/item cancelled with refund info

#### Wallet
- **wallet_credited** - Balance added (refund, reward, referral)
- **wallet_debited** - Balance deducted for payment
- **withdrawal_approved** - Withdrawal request approved
- **withdrawal_rejected** - Withdrawal request rejected
- **withdrawal_completed** - Funds transferred to bank

#### Complaints & Reviews
- **complaint_resolved** - Complaint reviewed and decision made
- **review_request** - Request to leave review after delivery
- **price_drop_alert** - Wishlist item price decreased

#### Account Security
- **email_verification** - OTP for email verification
- **password_reset** - Password reset link/OTP
- **otp_sent** - One-time password for any verification

---

### SELLER NOTIFICATIONS

#### Order Management
- **new_order_received** - New order from customer
- **payment_confirmed** - Payment confirmed for order
- **buyer_confirmed_receipt** - Customer confirmed receipt
- **complaint_filed_on_item** - Customer filed complaint
- **order_item_cancelled** - Item cancelled by customer/admin

#### Inventory
- **low_stock_alert** - Product stock below threshold
- **out_of_stock** - Product completely out of stock

#### Account & Financial
- **seller_verification_status** - Verification approved/rejected
- **seller_payment_deposited** - Payment deposited to wallet
- **seller_withdrawal_request_status** - Withdrawal request status

---

### ADMIN NOTIFICATIONS

#### Disputes & Complaints
- **complaint_filed** - New complaint filed on order
- **seller_dispute_reported** - Dispute reported against seller
- **high_value_order_issue** - High-value order has problems

#### Verification & Compliance
- **new_seller_verification_request** - New seller to verify
- **seller_document_expiration** - Seller verification doc expiring

#### Financial
- **large_withdrawal_request** - Withdrawal request over threshold
- **payment_reconciliation_issue** - Payment discrepancy detected

#### System
- **system_error** - Critical system error alert

---

## API Endpoints

### Base Path
```
/api/notifications
```

### Authentication
All endpoints require bearer token authentication (except public endpoints, if any).

---

## Endpoint List

### 1. Get All Notifications
**Endpoint:** `GET /api/notifications`

**Authentication:** Required

**Query Parameters (Optional):**
```
page    - Page number (default: 1)
limit   - Items per page (default: 20)
unreadOnly - Show only unread (default: false)
```

**Response (Success - 200):**
```json
{
  "success": true,
  "notifications": [
    {
      "_id": "notification_id",
      "userId": "user_id",
      "type": "order_shipped",
      "title": "Order Shipped",
      "message": "Your order #12345 has been shipped (Tracking: ABC123)",
      "data": {
        "orderId": "order_id",
        "reference": "ABC123"
      },
      "channels": {
        "inApp": {
          "sent": true,
          "sentAt": "2026-02-27T10:30:00.000Z"
        },
        "email": {
          "sent": true,
          "sentAt": "2026-02-27T10:31:00.000Z"
        }
      },
      "read": false,
      "priority": "high",
      "status": "delivered",
      "createdAt": "2026-02-27T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 15,
    "pages": 1,
    "currentPage": 1,
    "limit": 20
  }
}
```

---

### 2. Get Unread Count
**Endpoint:** `GET /api/notifications/count`

**Authentication:** Required

**Response (Success - 200):**
```json
{
  "success": true,
  "unreadCount": 3
}
```

---

### 3. Mark Notification as Read
**Endpoint:** `PATCH /api/notifications/:notificationId/read`

**Authentication:** Required

**URL Parameters:**
```
:notificationId - ID of notification to mark as read
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "_id": "notification_id",
    "read": true,
    "readAt": "2026-02-27T11:00:00.000Z"
  }
}
```

---

### 4. Mark All as Read
**Endpoint:** `PATCH /api/notifications/read-all`

**Authentication:** Required

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "All notifications marked as read",
  "markedCount": 5
}
```

---

### 5. Delete Notification
**Endpoint:** `DELETE /api/notifications/:notificationId`

**Authentication:** Required

**URL Parameters:**
```
:notificationId - ID of notification to delete
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Notification deleted"
}
```

---

### 6. Delete All Notifications
**Endpoint:** `DELETE /api/notifications`

**Authentication:** Required

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "All notifications deleted",
  "deletedCount": 10
}
```

---

### 7. Get Notification Preferences
**Endpoint:** `GET /api/notifications/preferences`

**Authentication:** Required

**Response (Success - 200):**
```json
{
  "success": true,
  "preferences": {
    "email": {
      "orders": true,
      "payments": true,
      "complaints": true,
      "wallet": true,
      "reviews": true,
      "security": true
    },
    "inApp": {
      "orders": true,
      "payments": true,
      "complaints": true,
      "wallet": true,
      "reviews": true,
      "marketing": false
    },
    "sms": {
      "payments": true,
      "emergencies": true
    }
  }
}
```

---

### 8. Update Notification Preferences
**Endpoint:** `PATCH /api/notifications/preferences`

**Authentication:** Required

**Request Body:**
```json
{
  "preferences": {
    "email": {
      "orders": true,
      "payments": true,
      "complaints": true,
      "wallet": true,
      "reviews": false,
      "security": true
    },
    "inApp": {
      "orders": true,
      "payments": true,
      "complaints": true,
      "wallet": true,
      "reviews": true,
      "marketing": false
    },
    "sms": {
      "payments": true,
      "emergencies": true
    }
  }
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Preferences updated successfully",
  "preferences": {
    "email": {...},
    "inApp": {...},
    "sms": {...}
  }
}
```

---

## cURL Examples

### Get Notifications
```bash
curl -X GET "http://localhost:3000/api/notifications?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Unread Count
```bash
curl -X GET http://localhost:3000/api/notifications/count \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Mark as Read
```bash
curl -X PATCH http://localhost:3000/api/notifications/notification_id/read \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Mark All as Read
```bash
curl -X PATCH http://localhost:3000/api/notifications/read-all \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Delete Notification
```bash
curl -X DELETE http://localhost:3000/api/notifications/notification_id \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Preferences
```bash
curl -X GET http://localhost:3000/api/notifications/preferences \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Preferences
```bash
curl -X PATCH http://localhost:3000/api/notifications/preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "preferences": {
      "email": {"orders": true, "payments": true},
      "inApp": {"orders": true, "payments": true},
      "sms": {"payments": true}
    }
  }'
```

---

## JavaScript/Fetch Examples

### Get Notifications
```javascript
fetch('http://localhost:3000/api/notifications?page=1&limit=20', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(res => res.json())
.then(data => console.log(data.notifications));
```

### Get Unread Count
```javascript
fetch('http://localhost:3000/api/notifications/count', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(res => res.json())
.then(data => {
  document.querySelector('.notification-badge').textContent = data.unreadCount;
});
```

### Mark as Read
```javascript
fetch(`http://localhost:3000/api/notifications/${notificationId}/read`, {
  method: 'PATCH',
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(res => res.json())
.then(data => console.log('Marked as read'));
```

### Mark All as Read
```javascript
fetch('http://localhost:3000/api/notifications/read-all', {
  method: 'PATCH',
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(res => res.json())
.then(data => console.log(`${data.markedCount} notifications marked as read`));
```

### Delete Notification
```javascript
fetch(`http://localhost:3000/api/notifications/${notificationId}`, {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(res => res.json())
.then(data => console.log('Notification deleted'));
```

---

## Email Templates

The system includes pre-built email templates for:

1. **Order Confirmations** - Order placed with items and total
2. **Payment Successful** - Payment received confirmation
3. **Order Shipped** - Shipping info with tracking
4. **Order Delivered** - With review request link
5. **Order Cancelled** - With refund details
6. **Wallet Credited** - Balance increase notification
7. **Withdrawal Status** - Approval/rejection/completion
8. **Complaint Resolution** - Decision and resolution details
9. **Seller New Order** - Order details for seller action
10. **Low Stock Alert** - Inventory warning
11. **OTP Email** - One-time password
12. **Password Reset** - Reset link

---

## Notification Status Lifecycle

```
pending 
  ↓
sent (processed and sent through channels)
  ↓
delivered (user received and in-app notification visible)
  ↓
read (user opened/read the notification)

OR

failed (delivery failed, will retry)
```

---

## Notification Priorities

| Priority | Use Case |
|----------|----------|
| urgent | Critical issues, security alerts, large amounts |
| high | Order updates, payment confirmations, complaints |
| medium | General orders, wallet transactions, reviews |
| low | Marketing, non-critical updates, suggestions |

---

## Implementation Checklist

✅ Notification Model Created
✅ Email Service Implemented (Mailtrap integration)
✅ Notification Service Created (all notification methods)
✅ Controller & Routes Setup
✅ API Endpoints Available
✅ Email Templates Implemented

---

## Next Steps for Integration

### 1. Order Service Integration
```javascript
// In order.service.js
async createOrder(...) {
  // ... create order logic
  
  // Send notification
  await notificationService.notifyOrderConfirmation(user, orderId, items, total);
}
```

### 2. Wallet Service Integration
```javascript
// In wallet.service.js
async creditWallet(...) {
  // ... credit logic
  
  // Send notification
  await notificationService.notifyWalletCredited(user, amount, reason, reference);
}
```

### 3. Complaint Service Integration
```javascript
// In complaint resolution
async resolveComplaint(...) {
  // ... resolution logic
  
  // Notify user about resolution
  await notificationService.notifyComplaintResolved(user, complaintId, resolution, decision);
}
```

### 4. Frontend Implementation
- Display notification bell icon with unread count
- Show notification center/dropdown
- Real-time updates using WebSockets (optional)
- Mark as read on view
- Delete old notifications

---

## Configuration

### Environment Variables
```env
# Email Configuration
MAILTRAP_HOST=smtp.mailtrap.io
MAILTRAP_PORT=465
MAILTRAP_USER=your_mailtrap_user
MAILTRAP_PASSWORD=your_mailtrap_password
EMAIL_FROM=noreply@campustrade.com

# Frontend URL for links
FRONTEND_URL=https://campustrade.example.com
```

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 404 - Notification not found | Invalid notification ID | Check ID and try again |
| 401 - Unauthorized | Missing/invalid token | Include valid Bearer token |
| 500 - Email send failed | Mailtrap issue | Check email config and retry |
| 400 - Invalid data | Missing required fields | Verify request body |

---

## Summary Table

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/` | Get all notifications | Yes |
| GET | `/count` | Get unread count | Yes |
| PATCH | `/:id/read` | Mark as read | Yes |
| PATCH | `/read-all` | Mark all as read | Yes |
| DELETE | `/:id` | Delete notification | Yes |
| DELETE | `/` | Delete all notifications | Yes |
| GET | `/preferences` | Get preferences | Yes |
| PATCH | `/preferences` | Update preferences | Yes |

---

## Support & Testing

To test notifications:

1. Create a test order via order endpoint
2. Check `/api/notifications` for new notifications
3. Verify email was sent to Mailtrap
4. Mark as read and verify read count updates
5. Delete and verify removal

All emails also appear in your Mailtrap dashboard for verification.
