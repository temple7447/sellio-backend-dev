# Wishlist API Endpoints Documentation

## Base Path
```
/api/wishlist
```

## Authentication
**All endpoints require:**
- Authentication token (Bearer token)
- User must be verified
- User must have customer role

---

## Endpoints

### 1. Add Product to Wishlist
**Endpoint:** `POST /api/wishlist/add`

**Authentication:** Required (Customer)

**Request Body:**
```json
{
  "productId": "product_id_here"
}
```

**Response (Success - 201):**
```json
{
  "success": true,
  "message": "Product added to wishlist",
  "data": {
    "_id": "wishlist_item_id",
    "userId": "user_id",
    "productId": "product_id",
    "createdAt": "2026-02-27T10:30:00.000Z",
    "updatedAt": "2026-02-27T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Product already in wishlist
- `404` - Product not found
- `500` - Server error

---

### 2. Remove Product from Wishlist
**Endpoint:** `DELETE /api/wishlist/remove/:productId`

**Authentication:** Required (Customer)

**URL Parameters:**
```
:productId - The ID of the product to remove
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Product removed from wishlist"
}
```

**Error Responses:**
- `404` - Product not found in wishlist
- `500` - Server error

---

### 3. Get User's Wishlist
**Endpoint:** `GET /api/wishlist`

**Authentication:** Required (Customer)

**Query Parameters (Optional):**
```
page    - Page number (default: 1)
limit   - Items per page (default: 10)
```

**Example URL:**
```
GET /api/wishlist?page=1&limit=10
```

**Response (Success - 200):**
```json
{
  "success": true,
  "items": [
    {
      "_id": "wishlist_item_id",
      "userId": "user_id",
      "productId": {
        "_id": "product_id",
        "name": "Product Name",
        "price": 5000,
        "image": "image_url",
        "sellerId": {
          "_id": "seller_id",
          "businessName": "Business Name"
        }
      },
      "createdAt": "2026-02-27T10:30:00.000Z"
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

**Error Responses:**
- `500` - Server error

---

### 4. Check if Product is in Wishlist
**Endpoint:** `GET /api/wishlist/check/:productId`

**Authentication:** Required (Customer)

**URL Parameters:**
```
:productId - The ID of the product to check
```

**Response (Success - 200):**
```json
{
  "success": true,
  "isInWishlist": true
}
```

**Possible Responses:**
```json
{
  "success": true,
  "isInWishlist": false
}
```

**Error Responses:**
- `500` - Server error

---

## cURL Examples

### Add to Wishlist
```bash
curl -X POST http://localhost:3000/api/wishlist/add \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "65a1234567890abcdef12345"
  }'
```

### Remove from Wishlist
```bash
curl -X DELETE http://localhost:3000/api/wishlist/remove/65a1234567890abcdef12345 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Wishlist
```bash
curl -X GET "http://localhost:3000/api/wishlist?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Check in Wishlist
```bash
curl -X GET http://localhost:3000/api/wishlist/check/65a1234567890abcdef12345 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## JavaScript/Fetch Examples

### Add to Wishlist
```javascript
fetch('http://localhost:3000/api/wishlist/add', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    productId: '65a1234567890abcdef12345'
  })
})
.then(res => res.json())
.then(data => console.log(data));
```

### Remove from Wishlist
```javascript
fetch('http://localhost:3000/api/wishlist/remove/65a1234567890abcdef12345', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => console.log(data));
```

### Get Wishlist
```javascript
fetch('http://localhost:3000/api/wishlist?page=1&limit=10', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => console.log(data));
```

### Check in Wishlist
```javascript
fetch('http://localhost:3000/api/wishlist/check/65a1234567890abcdef12345', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => console.log(data.isInWishlist));
```

---

## Requirements & Constraints

✅ **Required:**
- Valid authentication token (login required)
- User must be verified
- User role must be "customer"

❌ **Not Allowed For:**
- Sellers
- Admins
- Unauthenticated users

---

## Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created (item added) |
| 400 | Bad request / Product already in wishlist |
| 404 | Product or item not found |
| 401 | Unauthorized / Invalid token |
| 403 | Forbidden (not a customer) |
| 500 | Server error |

---

## Summary

| Method | Endpoint | Purpose | Returns |
|--------|----------|---------|---------|
| POST | `/add` | Add product to wishlist | Wishlist item |
| DELETE | `/remove/:productId` | Remove from wishlist | Success message |
| GET | `/` | Get all wishlist items | Paginated items |
| GET | `/check/:productId` | Check if in wishlist | Boolean status |

