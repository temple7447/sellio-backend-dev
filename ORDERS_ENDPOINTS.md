# Order API Endpoints Documentation

## Base Path
```
/api/orders
```

## Authentication Requirements by Endpoint
- **Guest Orders**: No authentication required
- **Customer Orders**: Authentication token required
- **Seller Orders**: Authentication token + Seller role required
- **Admin Orders**: Authentication token + Admin role required

---

## GUEST CHECKOUT (No Authentication Required)

### 1. Create Guest Order
**Endpoint:** `POST /api/orders`

**Authentication:** Not required

**Request Body:**
```json
{
  "guestEmail": "customer@example.com",
  "items": [
    {
      "productId": "product_id_1",
      "quantity": 2
    },
    {
      "productId": "product_id_2",
      "quantity": 1
    }
  ],
  "shippingAddress": {
    "fullName": "John Doe",
    "phoneNumber": "+2348012345678",
    "street": "123 Main Street",
    "city": "Lagos",
    "state": "Lagos",
    "country": "Nigeria",
    "zipCode": "100001"
  }
}
```

**Response (Success - 201):**
```json
{
  "_id": "order_id",
  "guestEmail": "customer@example.com",
  "status": "pending",
  "payment": {
    "method": "paystack",
    "status": "pending",
    "transactionId": null
  },
  "shipping": {
    "address": {
      "fullName": "John Doe",
      "phoneNumber": "+2348012345678",
      "street": "123 Main Street",
      "city": "Lagos",
      "state": "Lagos",
      "country": "Nigeria",
      "zipCode": "100001"
    },
    "method": "standard"
  },
  "totals": {
    "subtotal": 15000,
    "tax": 250,
    "escrowProtection": 375,
    "service": 50,
    "final": 15675
  },
  "createdAt": "2026-02-27T10:30:00.000Z"
}
```

**Error Responses:**
- `400` - Missing required fields or insufficient inventory
- `500` - Server error

---

### 2. Get Guest Orders
**Endpoint:** `GET /api/orders/guest/orders/:email`

**Authentication:** Not required

**URL Parameters:**
```
:email - Guest email address
```

**Query Parameters (Optional):**
```
page    - Page number (default: 1)
limit   - Items per page (default: 10)
```

**Response (Success - 200):**
```json
{
  "success": true,
  "orders": [
    {
      "_id": "order_id",
      "guestEmail": "customer@example.com",
      "status": "pending",
      "totals": {
        "final": 15675
      },
      "createdAt": "2026-02-27T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 5,
    "pages": 1,
    "currentPage": 1,
    "limit": 10
  }
}
```

---

### 3. Get Single Guest Order
**Endpoint:** `GET /api/orders/guest/:orderId`

**Authentication:** Not required

**URL Parameters:**
```
:orderId - The order ID
```

**Query Parameters:**
```
email - Guest email (for verification)
```

**Response (Success - 200):**
```json
{
  "_id": "order_id",
  "guestEmail": "customer@example.com",
  "status": "pending",
  "payment": {
    "method": "paystack",
    "status": "pending"
  },
  "shipping": {
    "address": {...}
  },
  "totals": {...},
  "items": [
    {
      "_id": "item_id",
      "productId": {
        "_id": "product_id",
        "name": "Product Name",
        "price": 5000
      },
      "sellerId": "seller_id",
      "quantity": 2,
      "price": 5000,
      "totalPrice": 10000,
      "status": "pending"
    }
  ],
  "createdAt": "2026-02-27T10:30:00.000Z"
}
```

---

### 4. Initiate Payment (Guest)
**Endpoint:** `POST /api/orders/:orderId/pay`

**Authentication:** Not required

**URL Parameters:**
```
:orderId - The order ID
```

**Response (Success - 200):**
```json
{
  "success": true,
  "paymentUrl": "https://checkout.paystack.com/...",
  "reference": "paystack_reference_code",
  "amount": 15675
}
```

---

### 5. Verify Payment (Guest)
**Endpoint:** `GET /api/orders/verify/:reference` or `GET /api/orders/verify-payment/:reference`

**Authentication:** Not required

**URL Parameters:**
```
:reference - Paystack payment reference
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "status": "completed",
  "orderId": "order_id",
  "amount": 15675
}
```

---

## CUSTOMER ORDERS (Authentication Required)

### 6. Create Customer Order
**Endpoint:** `POST /api/orders/customer/create`

**Authentication:** Required (Customer)

**Request Body:**
```json
{
  "items": [
    {
      "productId": "product_id_1",
      "quantity": 2
    }
  ],
  "shippingDetails": {
    "fullName": "John Doe",
    "phoneNumber": "+2348012345678",
    "address": {
      "street": "123 Main Street",
      "city": "Lagos",
      "state": "Lagos",
      "country": "Nigeria",
      "zipCode": "100001"
    }
  },
  "paymentMethod": "paystack"
}
```

**Response (Success - 201):**
```json
{
  "_id": "order_id",
  "customerId": "customer_id",
  "status": "pending",
  "payment": {
    "method": "paystack",
    "status": "pending"
  },
  "shipping": {
    "address": {
      "fullName": "John Doe",
      "phoneNumber": "+2348012345678",
      "street": "123 Main Street",
      "city": "Lagos",
      "state": "Lagos",
      "country": "Nigeria",
      "zipCode": "100001"
    }
  },
  "totals": {
    "subtotal": 10000,
    "tax": 250,
    "escrowProtection": 250,
    "service": 50,
    "final": 10550
  }
}
```

---

### 7. Get Customer Orders
**Endpoint:** `GET /api/orders/customer`

**Authentication:** Required (Customer)

**Query Parameters (Optional):**
```
page    - Page number (default: 1)
limit   - Items per page (default: 10)
status  - Filter by status (pending, confirmed, processing, shipped, delivered, cancelled)
```

**Response (Success - 200):**
```json
{
  "orders": [
    {
      "_id": "order_id",
      "status": "pending",
      "totals": {
        "final": 10550
      },
      "items": [
        {
          "_id": "item_id",
          "productId": {
            "name": "Product Name",
            "price": 5000
          },
          "quantity": 2,
          "status": "pending"
        }
      ],
      "createdAt": "2026-02-27T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 15,
    "pages": 2,
    "currentPage": 1,
    "limit": 10
  }
}
```

---

### 8. Get Order Details
**Endpoint:** `GET /api/orders/:orderId`

**Authentication:** Required (Customer/Seller/Admin for their respective orders or all orders for admin)

**URL Parameters:**
```
:orderId - The order ID
```

**Response (Success - 200):**
```json
{
  "_id": "order_id",
  "customerId": "customer_id",
  "status": "pending",
  "payment": {
    "method": "paystack",
    "status": "pending",
    "transactionId": "txn_123456"
  },
  "shipping": {
    "address": {...},
    "tracking": {
      "number": "TRACK123",
      "url": "https://..."
    }
  },
  "totals": {
    "subtotal": 10000,
    "tax": 250,
    "escrowProtection": 250,
    "service": 50,
    "final": 10550
  },
  "items": [
    {
      "_id": "item_id",
      "orderId": "order_id",
      "productId": {
        "name": "Product Name",
        "price": 5000
      },
      "sellerId": {
        "businessName": "Business Name"
      },
      "quantity": 2,
      "price": 5000,
      "totalPrice": 10000,
      "status": "pending",
      "fulfillmentProof": null,
      "buyerProof": null
    }
  ]
}
```

---

### 9. Get Order Status
**Endpoint:** `GET /api/orders/customer/:orderId/status`

**Authentication:** Required (Customer)

**URL Parameters:**
```
:orderId - The order ID
```

**Response (Success - 200):**
```json
{
  "success": true,
  "status": "pending",
  "items": [
    {
      "itemId": "item_id",
      "productName": "Product Name",
      "quantity": 2,
      "status": "pending"
    }
  ]
}
```

---

### 10. Initialize Payment (Customer)
**Endpoint:** `POST /api/orders/customer/:orderId/pay`

**Authentication:** Required (Customer)

**URL Parameters:**
```
:orderId - The order ID
```

**Response (Success - 200):**
```json
{
  "success": true,
  "paymentUrl": "https://checkout.paystack.com/...",
  "reference": "paystack_reference_code",
  "amount": 10550
}
```

---

### 11. Pay with Wallet
**Endpoint:** `POST /api/orders/customer/:orderId/pay-wallet`

**Authentication:** Required (Customer)

**URL Parameters:**
```
:orderId - The order ID
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Order paid with wallet successfully",
  "walletBalance": 5000,
  "status": "completed"
}
```

**Error Responses:**
- `400` - Insufficient wallet balance
  ```json
  {
    "message": "Insufficient wallet balance",
    "available": 5000,
    "required": 10550
  }
  ```

---

### 12. Confirm Receipt
**Endpoint:** `POST /api/orders/customer/:orderId/confirm-receipt`

**Authentication:** Required (Customer)

**URL Parameters:**
```
:orderId - The order ID
```

**Request (File Upload - Optional):**
```bash
# With proof file
curl -X POST http://localhost:3000/api/orders/customer/:orderId/confirm-receipt \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "proof=@receipt.jpg" \
  -F "itemIds=item_id_1,item_id_2"
```

**Request Body (Alternative - with proof URLs):**
```json
{
  "itemIds": ["item_id_1", "item_id_2"],
  "itemProofs": {
    "item_id_1": "https://cloudinary-url-1",
    "item_id_2": "https://cloudinary-url-2"
  }
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Receipt confirmed",
  "items": [
    {
      "_id": "item_id",
      "status": "delivered",
      "buyerProof": "https://cloudinary-url",
      "buyerConfirmationDate": "2026-02-27T11:00:00.000Z"
    }
  ]
}
```

---

### 13. Cancel Order
**Endpoint:** `POST /api/orders/customer/:orderId/cancel`

**Authentication:** Required (Customer)

**URL Parameters:**
```
:orderId - The order ID
```

**Request Body:**
```json
{
  "reason": "Found cheaper alternative"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Order cancelled successfully",
  "status": "cancelled"
}
```

**Error Responses:**
- `400` - Order cannot be cancelled (status not pending/confirmed)

---

### 14. Cancel Order Item
**Endpoint:** `POST /api/orders/customer/item/:orderItemId/cancel`

**Authentication:** Required (Customer)

**URL Parameters:**
```
:orderItemId - The order item ID
```

**Request Body:**
```json
{
  "reason": "Item not available"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Item cancelled successfully",
  "item": {
    "_id": "item_id",
    "status": "cancelled",
    "cancellationReason": "Item not available"
  }
}
```

---

### 15. File Complaint
**Endpoint:** `POST /api/orders/:orderId/complain`

**Authentication:** Required (Customer/Seller/Admin)

**URL Parameters:**
```
:orderId - The order ID
```

**Request (File Upload):**
```bash
curl -X POST http://localhost:3000/api/orders/:orderId/complain \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "subject=Product Quality Issue" \
  -F "complaint=The product arrived damaged" \
  -F "orderItemId=item_id_1" \
  -F "images=@image1.jpg" \
  -F "images=@image2.jpg"
```

**Request Body (JSON):**
```json
{
  "subject": "Product Quality Issue",
  "complaint": "The product arrived damaged and is not functional",
  "orderItemId": "item_id_1"
}
```

**Response (Success - 201):**
```json
{
  "success": true,
  "message": "Complaint filed successfully",
  "complaint": {
    "_id": "complaint_id",
    "orderId": "order_id",
    "orderItemId": "item_id",
    "subject": "Product Quality Issue",
    "complaint": "The product arrived damaged",
    "status": "pending",
    "images": ["https://cloudinary-url-1", "https://cloudinary-url-2"],
    "createdAt": "2026-02-27T10:30:00.000Z"
  }
}
```

---

## SELLER ORDERS (Authentication + Seller Role Required)

### 16. Get Seller Orders
**Endpoint:** `GET /api/orders/seller`

**Authentication:** Required (Seller)

**Query Parameters (Optional):**
```
page    - Page number (default: 1)
limit   - Items per page (default: 10)
status  - Filter by status (pending, confirmed, processing, shipped, delivered, cancelled)
```

**Response (Success - 200):**
```json
{
  "orders": [
    {
      "_id": "order_id",
      "customerId": "customer_id",
      "status": "pending",
      "items": [
        {
          "_id": "item_id",
          "productId": {
            "name": "Product Name"
          },
          "quantity": 2,
          "price": 5000,
          "status": "pending"
        }
      ]
    }
  ],
  "pagination": {
    "total": 25,
    "pages": 3,
    "currentPage": 1,
    "limit": 10
  }
}
```

---

### 17. Upload Fulfillment Proof
**Endpoint:** `POST /api/orders/seller/:orderItemId/fulfillment-proof` or `POST /api/orders/seller/:orderItemId/shipped`

**Authentication:** Required (Seller)

**URL Parameters:**
```
:orderItemId - The order item ID
```

**Request (File Upload):**
```bash
curl -X POST http://localhost:3000/api/orders/seller/:orderItemId/fulfillment-proof \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "proof=@proof.jpg"
```

**Or with proof URL in body:**
```json
{
  "proofUrl": "https://cloudinary-url"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Fulfillment proof uploaded successfully. Item status updated to shipped.",
  "data": {
    "_id": "item_id",
    "status": "shipped",
    "fulfillmentProof": "https://cloudinary-url",
    "fulfillmentDate": "2026-02-27T10:30:00.000Z"
  }
}
```

---

### 18. Cancel Order Item (Seller)
**Endpoint:** `POST /api/orders/seller/item/:orderItemId/cancel`

**Authentication:** Required (Seller)

**URL Parameters:**
```
:orderItemId - The order item ID
```

**Request Body:**
```json
{
  "reason": "Out of stock"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Item cancelled successfully",
  "item": {
    "_id": "item_id",
    "status": "cancelled",
    "cancellationReason": "Out of stock",
    "cancelledBy": "seller"
  }
}
```

---

## ADMIN ORDERS (Authentication + Admin Role Required)

### 19. Get All Orders (Admin)
**Endpoint:** `GET /api/orders/admin/orders`

**Authentication:** Required (Admin)

**Query Parameters (Optional):**
```
page    - Page number (default: 1)
limit   - Items per page (default: 10)
status  - Filter by status
```

**Response (Success - 200):**
```json
{
  "success": true,
  "orders": [
    {
      "_id": "order_id",
      "customerId": "customer_id",
      "guestEmail": "guest@example.com",
      "status": "pending",
      "totals": {
        "final": 10550
      },
      "createdAt": "2026-02-27T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 100,
    "pages": 10,
    "currentPage": 1,
    "limit": 10
  }
}
```

---

### 20. Get Admin Dashboard
**Endpoint:** `GET /api/orders/admin/dashboard`

**Authentication:** Required (Admin)

**Query Parameters (Optional):**
```
timeframe - daily, weekly, monthly, yearly (default: monthly)
```

**Response (Success - 200):**
```json
{
  "success": true,
  "stats": {
    "totalOrders": 1250,
    "totalRevenue": 50000000,
    "averageOrderValue": 40000,
    "pendingOrders": 120,
    "completedOrders": 1100,
    "cancelledOrders": 30,
    "topProducts": [
      {
        "productId": "product_id",
        "name": "Product Name",
        "orders": 45,
        "revenue": 900000
      }
    ],
    "topSellers": [
      {
        "sellerId": "seller_id",
        "businessName": "Business Name",
        "orders": 50,
        "revenue": 2000000
      }
    ]
  }
}
```

---

### 21. Get All Complaints (Admin)
**Endpoint:** `GET /api/orders/admin/complaints`

**Authentication:** Required (Admin)

**Query Parameters (Optional):**
```
status - pending, in-review, resolved, dismissed
```

**Response (Success - 200):**
```json
{
  "success": true,
  "count": 15,
  "summary": {
    "all": 15,
    "pending": 5,
    "in-review": 3,
    "resolved": 6,
    "dismissed": 1
  },
  "data": [
    {
      "_id": "complaint_id",
      "orderId": "order_id",
      "userId": {
        "_id": "user_id",
        "fullName": "John Doe",
        "email": "john@example.com"
      },
      "subject": "Product Quality Issue",
      "complaint": "Product arrived damaged",
      "status": "pending",
      "createdAt": "2026-02-27T10:30:00.000Z"
    }
  ]
}
```

---

### 22. Resolve Complaint (Admin)
**Endpoint:** `POST /api/orders/admin/complaints/:complaintId/resolve`

**Authentication:** Required (Admin)

**URL Parameters:**
```
:complaintId - The complaint ID
```

**Request Body:**
```json
{
  "decision": "resolved",
  "resolution": "Customer will receive a replacement product within 3 days"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Complaint resolved successfully",
  "complaint": {
    "_id": "complaint_id",
    "status": "resolved",
    "resolution": "Customer will receive a replacement product within 3 days",
    "resolvedAt": "2026-02-27T11:00:00.000Z"
  }
}
```

---

## cURL Examples

### Create Guest Order
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "guestEmail": "guest@example.com",
    "items": [{"productId": "65a1234567890abcdef12345", "quantity": 2}],
    "shippingAddress": {
      "fullName": "John Doe",
      "phoneNumber": "+2348012345678",
      "street": "123 Main Street",
      "city": "Lagos",
      "state": "Lagos",
      "country": "Nigeria"
    }
  }'
```

### Get Customer Orders
```bash
curl -X GET "http://localhost:3000/api/orders/customer?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create Customer Order
```bash
curl -X POST http://localhost:3000/api/orders/customer/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": "65a1234567890abcdef12345", "quantity": 2}],
    "shippingDetails": {
      "fullName": "John Doe",
      "phoneNumber": "+2348012345678",
      "address": {
        "street": "123 Main Street",
        "city": "Lagos",
        "state": "Lagos",
        "country": "Nigeria"
      }
    }
  }'
```

### Confirm Receipt with Proof
```bash
curl -X POST http://localhost:3000/api/orders/customer/:orderId/confirm-receipt \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "proof=@receipt.jpg" \
  -F "itemIds=item_id_1,item_id_2"
```

### Upload Fulfillment Proof (Seller)
```bash
curl -X POST http://localhost:3000/api/orders/seller/:orderItemId/fulfillment-proof \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "proof=@fulfillment.jpg"
```

### Cancel Order
```bash
curl -X POST http://localhost:3000/api/orders/customer/:orderId/cancel \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Found cheaper alternative"
  }'
```

### File Complaint
```bash
curl -X POST http://localhost:3000/api/orders/:orderId/complain \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "subject=Product Quality Issue" \
  -F "complaint=Product arrived damaged" \
  -F "orderItemId=item_id_1" \
  -F "images=@image1.jpg" \
  -F "images=@image2.jpg"
```

### Get Admin Dashboard
```bash
curl -X GET "http://localhost:3000/api/orders/admin/dashboard?timeframe=monthly" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## JavaScript/Fetch Examples

### Create Guest Order
```javascript
fetch('http://localhost:3000/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    guestEmail: 'guest@example.com',
    items: [
      { productId: '65a1234567890abcdef12345', quantity: 2 }
    ],
    shippingAddress: {
      fullName: 'John Doe',
      phoneNumber: '+2348012345678',
      street: '123 Main Street',
      city: 'Lagos',
      state: 'Lagos',
      country: 'Nigeria'
    }
  })
})
.then(res => res.json())
.then(data => console.log(data));
```

### Get Customer Orders
```javascript
fetch('http://localhost:3000/api/orders/customer?page=1&limit=10', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(res => res.json())
.then(data => console.log(data));
```

### Initialize Payment
```javascript
fetch('http://localhost:3000/api/orders/customer/:orderId/pay', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(res => res.json())
.then(data => window.location.href = data.paymentUrl);
```

### Confirm Receipt
```javascript
const formData = new FormData();
formData.append('proof', fileInput.files[0]);
formData.append('itemIds', 'item_id_1,item_id_2');

fetch('http://localhost:3000/api/orders/customer/:orderId/confirm-receipt', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
})
.then(res => res.json())
.then(data => console.log(data));
```

### Pay with Wallet
```javascript
fetch('http://localhost:3000/api/orders/customer/:orderId/pay-wallet', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(res => res.json())
.then(data => console.log(data));
```

### Cancel Order
```javascript
fetch('http://localhost:3000/api/orders/customer/:orderId/cancel', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    reason: 'Found cheaper alternative'
  })
})
.then(res => res.json())
.then(data => console.log(data));
```

---

## Order Status Lifecycle

```
pending 
  ↓
confirmed (payment verified)
  ↓
processing (seller preparing)
  ↓
shipped (seller uploaded fulfillment proof)
  ↓
delivered (customer confirmed receipt)

OR at any stage:
  ↓
cancelled
disputed
```

---

## Order Item Status

| Status | Description | Actor |
|--------|-------------|-------|
| pending | Order placed, awaiting payment confirmation | System |
| confirmed | Payment confirmed | System |
| processing | Seller preparing item for shipment | Seller |
| shipped | Seller has shipped, proof uploaded | Seller |
| delivered | Customer confirmed receipt | Customer |
| cancelled | Item cancelled, refund initiated | Customer/Seller/Admin |
| refunded | Refund processed | Admin |
| disputed | Under complaint investigation | Admin |

---

## Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / Invalid data |
| 404 | Order or item not found |
| 401 | Unauthorized / Invalid token |
| 403 | Forbidden (wrong role) |
| 409 | Conflict (insufficient stock) |
| 500 | Server error |

---

## Endpoint Summary

| Method | Endpoint | Purpose | Auth | Role |
|--------|----------|---------|------|------|
| POST | `/` | Create guest order | No | - |
| GET | `/guest/orders/:email` | List guest orders | No | - |
| GET | `/guest/:orderId` | Get guest order | No | - |
| POST | `/:orderId/pay` | Initiate guest payment | No | - |
| GET | `/verify/:reference` | Verify payment | No | - |
| POST | `/customer/create` | Create customer order | Yes | Customer |
| GET | `/customer` | Get customer orders | Yes | Customer |
| GET | `/:orderId` | Get order details | Yes | Customer/Seller/Admin |
| GET | `/customer/:orderId/status` | Get order status | Yes | Customer |
| POST | `/customer/:orderId/pay` | Initiate customer payment | Yes | Customer |
| POST | `/customer/:orderId/pay-wallet` | Pay with wallet | Yes | Customer |
| POST | `/customer/:orderId/confirm-receipt` | Confirm receipt | Yes | Customer |
| POST | `/customer/:orderId/cancel` | Cancel order | Yes | Customer |
| POST | `/customer/item/:itemId/cancel` | Cancel item | Yes | Customer |
| POST | `/:orderId/complain` | File complaint | Yes | Customer/Seller |
| GET | `/seller` | Get seller orders | Yes | Seller |
| POST | `/seller/:itemId/fulfillment-proof` | Upload proof | Yes | Seller |
| POST | `/seller/item/:itemId/cancel` | Cancel item | Yes | Seller |
| GET | `/admin/orders` | Get all orders | Yes | Admin |
| GET | `/admin/dashboard` | Dashboard stats | Yes | Admin |
| GET | `/admin/complaints` | Get complaints | Yes | Admin |
| POST | `/admin/complaints/:id/resolve` | Resolve complaint | Yes | Admin |

---

## Frontend Integration Checklist

✅ Guest checkout flow
✅ Registered customer checkout flow
✅ Payment processing (Paystack)
✅ Wallet payment option
✅ Order tracking
✅ Receipt confirmation with proof
✅ Complaint filing
✅ Order cancellation
✅ Seller fulfillment workflow
✅ Admin order management & dashboard

