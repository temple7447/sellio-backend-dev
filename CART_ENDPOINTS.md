# Cart API Endpoints Documentation

## Base Path
```
/api/cart
```

## Authentication
**All endpoints require:**
- Authentication token (Bearer token)
- User must be verified
- User must have customer role

---

## Endpoints

### 1. Add Product to Cart
**Endpoint:** `POST /api/cart/add`

**Authentication:** Required (Customer)

**Request Body:**
```json
{
  "productId": "product_id_here",
  "quantity": 1,
  "sellerId": "seller_id_here"
}
```

**Response (Success - 201):**
```json
{
  "success": true,
  "message": "Product added to cart",
  "data": {
    "_id": "cart_item_id",
    "userId": "user_id",
    "productId": "product_id",
    "quantity": 1,
    "sellerId": "seller_id",
    "addedAt": "2026-02-27T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Invalid quantity or missing required fields
- `404` - Product not found
- `409` - Insufficient product stock
- `500` - Server error

---

### 2. Remove Product from Cart
**Endpoint:** `DELETE /api/cart/remove/:cartItemId`

**Authentication:** Required (Customer)

**URL Parameters:**
```
:cartItemId - The ID of the cart item to remove
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Product removed from cart"
}
```

**Error Responses:**
- `404` - Cart item not found
- `500` - Server error

---

### 3. Update Cart Item Quantity
**Endpoint:** `PATCH /api/cart/update/:cartItemId`

**Authentication:** Required (Customer)

**URL Parameters:**
```
:cartItemId - The ID of the cart item to update
```

**Request Body:**
```json
{
  "quantity": 3
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Cart item quantity updated",
  "data": {
    "_id": "cart_item_id",
    "userId": "user_id",
    "productId": "product_id",
    "quantity": 3,
    "sellerId": "seller_id",
    "updatedAt": "2026-02-27T10:35:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Invalid quantity (must be > 0)
- `404` - Cart item not found
- `409` - Insufficient product stock
- `500` - Server error

---

### 4. Get User's Cart
**Endpoint:** `GET /api/cart`

**Authentication:** Required (Customer)

**Query Parameters (Optional):**
```
page    - Page number (default: 1)
limit   - Items per page (default: 20)
```

**Example URL:**
```
GET /api/cart?page=1&limit=20
```

**Response (Success - 200):**
```json
{
  "success": true,
  "items": [
    {
      "_id": "cart_item_id",
      "userId": "user_id",
      "productId": {
        "_id": "product_id",
        "name": "Product Name",
        "price": 5000,
        "image": "image_url_or_null",
        "stock": 50,
        "sellerId": "seller_id"
      },
      "quantity": 2,
      "sellerId": {
        "_id": "seller_id",
        "businessName": "Business Name",
        "email": "seller@example.com"
      },
      "price": 5000,
      "subtotal": 10000,
      "addedAt": "2026-02-27T10:30:00.000Z"
    }
  ],
  "summary": {
    "totalItems": 5,
    "totalQuantity": 8,
    "subtotal": 45000,
    "tax": 4500,
    "totalPrice": 49500,
    "bySeller": [
      {
        "sellerId": "seller_id_1",
        "sellerName": "Business Name 1",
        "itemCount": 3,
        "subtotal": 25000
      },
      {
        "sellerId": "seller_id_2",
        "sellerName": "Business Name 2",
        "itemCount": 2,
        "subtotal": 20000
      }
    ]
  },
  "pagination": {
    "total": 5,
    "pages": 1,
    "currentPage": 1,
    "limit": 20
  }
}
```

**Error Responses:**
- `500` - Server error

---

### 5. Clear Cart
**Endpoint:** `DELETE /api/cart/clear`

**Authentication:** Required (Customer)

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Cart cleared successfully",
  "cartItemsRemoved": 5
}
```

**Error Responses:**
- `500` - Server error

---

### 6. Remove Multiple Items from Cart
**Endpoint:** `POST /api/cart/remove-multiple`

**Authentication:** Required (Customer)

**Request Body:**
```json
{
  "cartItemIds": [
    "cart_item_id_1",
    "cart_item_id_2",
    "cart_item_id_3"
  ]
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Items removed from cart",
  "removedCount": 3
}
```

**Error Responses:**
- `400` - Invalid cart item IDs
- `500` - Server error

---

### 7. Get Cart Item Count
**Endpoint:** `GET /api/cart/count`

**Authentication:** Required (Customer)

**Response (Success - 200):**
```json
{
  "success": true,
  "cartCount": 5,
  "totalQuantity": 12
}
```

**Error Responses:**
- `500` - Server error

---

### 8. Check Product in Cart
**Endpoint:** `GET /api/cart/check/:productId`

**Authentication:** Required (Customer)

**URL Parameters:**
```
:productId - The ID of the product to check
```

**Response (Success - 200):**
```json
{
  "success": true,
  "inCart": true,
  "cartItemId": "cart_item_id",
  "quantity": 2
}
```

**Or (if not in cart):**
```json
{
  "success": true,
  "inCart": false
}
```

**Error Responses:**
- `500` - Server error

---

## cURL Examples

### Add to Cart
```bash
curl -X POST http://localhost:3000/api/cart/add \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "65a1234567890abcdef12345",
    "quantity": 2,
    "sellerId": "65b5678901234abcdef67890"
  }'
```

### Remove from Cart
```bash
curl -X DELETE http://localhost:3000/api/cart/remove/65c9999999999abcdef99999 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Cart Item Quantity
```bash
curl -X PATCH http://localhost:3000/api/cart/update/65c9999999999abcdef99999 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 5
  }'
```

### Get Cart
```bash
curl -X GET "http://localhost:3000/api/cart?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Clear Cart
```bash
curl -X DELETE http://localhost:3000/api/cart/clear \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Remove Multiple Items
```bash
curl -X POST http://localhost:3000/api/cart/remove-multiple \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cartItemIds": [
      "65c9999999999abcdef99999",
      "65c8888888888abcdef88888",
      "65c7777777777abcdef77777"
    ]
  }'
```

### Get Cart Count
```bash
curl -X GET http://localhost:3000/api/cart/count \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Check Product in Cart
```bash
curl -X GET http://localhost:3000/api/cart/check/65a1234567890abcdef12345 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## JavaScript/Fetch Examples

### Add to Cart
```javascript
fetch('http://localhost:3000/api/cart/add', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    productId: '65a1234567890abcdef12345',
    quantity: 2,
    sellerId: '65b5678901234abcdef67890'
  })
})
.then(res => res.json())
.then(data => console.log(data));
```

### Remove from Cart
```javascript
fetch('http://localhost:3000/api/cart/remove/65c9999999999abcdef99999', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => console.log(data));
```

### Update Quantity
```javascript
fetch('http://localhost:3000/api/cart/update/65c9999999999abcdef99999', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    quantity: 5
  })
})
.then(res => res.json())
.then(data => console.log(data));
```

### Get Cart
```javascript
fetch('http://localhost:3000/api/cart?page=1&limit=20', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => console.log(data));
```

### Clear Cart
```javascript
fetch('http://localhost:3000/api/cart/clear', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => console.log(data));
```

### Remove Multiple Items
```javascript
fetch('http://localhost:3000/api/cart/remove-multiple', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    cartItemIds: [
      '65c9999999999abcdef99999',
      '65c8888888888abcdef88888',
      '65c7777777777abcdef77777'
    ]
  })
})
.then(res => res.json())
.then(data => console.log(data));
```

### Get Cart Count
```javascript
fetch('http://localhost:3000/api/cart/count', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => console.log(`Items in cart: ${data.cartCount}`));
```

### Check Product in Cart
```javascript
fetch('http://localhost:3000/api/cart/check/65a1234567890abcdef12345', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => console.log(data.inCart ? 'In cart' : 'Not in cart'));
```

---

## Requirements & Constraints

✅ **Required:**
- Valid authentication token (login required)
- User must be verified
- User role must be "customer"
- Valid product ID and quantity

❌ **Not Allowed For:**
- Sellers
- Admins
- Unauthenticated users
- Quantity less than 1
- Invalid product IDs

---

## Business Rules

1. **Quantity Validation:**
   - Minimum quantity: 1
   - Cannot exceed available product stock
   - Must be an integer

2. **Stock Management:**
   - Cart respects product stock availability
   - If stock decreases, user is notified
   - Cannot checkout with out-of-stock items

3. **Cart Persistence:**
   - Cart data is tied to user account
   - Cart items persist across sessions
   - Items are removed when order is placed

4. **Multi-Seller Cart:**
   - Users can buy from multiple sellers in one checkout
   - Cart organizes items by seller
   - Each seller's items are processed separately

5. **Price Calculation:**
   - Subtotal = product price × quantity
   - Tax calculated on subtotal
   - Final total = subtotal + tax
   - Discounts/coupons (if applicable) applied at checkout

---

## Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created (item added) |
| 400 | Bad request / Invalid quantity |
| 404 | Product or cart item not found |
| 401 | Unauthorized / Invalid token |
| 403 | Forbidden (not a customer) |
| 409 | Conflict (insufficient stock) |
| 500 | Server error |

---

## Summary

| Method | Endpoint | Purpose | Returns |
|--------|----------|---------|---------|
| POST | `/add` | Add product to cart | Cart item |
| DELETE | `/remove/:cartItemId` | Remove single item | Success message |
| PATCH | `/update/:cartItemId` | Update item quantity | Updated item |
| GET | `/` | Get all cart items | Paginated items + summary |
| DELETE | `/clear` | Empty entire cart | Success message |
| POST | `/remove-multiple` | Remove multiple items | Removed count |
| GET | `/count` | Get cart stats | Item & quantity count |
| GET | `/check/:productId` | Check if product in cart | Boolean + details |

---

## Frontend Integration Tips

### 1. Add to Cart Flow
```javascript
async function addToCart(productId, quantity, sellerId) {
  const response = await fetch('/api/cart/add', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ productId, quantity, sellerId })
  });
  
  if (!response.ok) {
    const error = await response.json();
    showError(error.message);
    return;
  }
  
  const data = await response.json();
  updateCartUI();
}
```

### 2. Show Cart Count Badge
```javascript
async function updateCartBadge() {
  const response = await fetch('/api/cart/count', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  document.querySelector('.cart-badge').textContent = data.cartCount;
}
```

### 3. Display Cart Page
```javascript
async function loadCart() {
  const response = await fetch('/api/cart?page=1&limit=20', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  
  // Group by seller
  const bySeller = data.summary.bySeller;
  
  // Display items grouped by seller
  // Show summary with total price
  // Enable checkout button
}
```

