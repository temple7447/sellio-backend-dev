# Seller Trusted Badge - Quick Start Guide

## 🎯 What Is It?

A **Trusted Seller Badge** is a visual indicator that admin approves a seller as trustworthy. Unlike email verification (required for all sellers), this badge is optional and admin-controlled.

```
Email Verification = Seller's email is real ✅
Trusted Badge = This seller is reliable & trustworthy ✨
```

## 💡 Real-World Example

**Without Badge:**
- Customer sees product: "Premium Electronics from UnknownStore"
- No way to know if seller is trustworthy
- May hesitate to buy

**With Badge:**
- Customer sees product with ✨ badge
- Seller profile shows: "Trusted Seller"
- Customer feels confident, more likely to purchase

## 🏃 Quick Start (5 minutes)

### 1. Admin Awards Badge to Seller

```bash
# URL Format
PUT /api/admin/sellers/{SELLER_ID}/trusted-badge

# Example
curl -X PUT http://localhost:5000/api/admin/sellers/507f1f77bcf86cd799439011/trusted-badge \
  -H "Authorization: Bearer your_admin_token" \
  -H "Content-Type: application/json" \
  -d '{"isTrusted": true}'
```

**Response:**
```json
{
  "message": "Seller awarded trusted badge",
  "seller": {
    "id": "507f1f77bcf86cd799439011",
    "email": "seller@example.com",
    "businessName": "Premium Store",
    "isTrustedSeller": true,
    "trustedBadgeAwardedAt": "2026-03-21T10:30:00Z"
  }
}
```

### 2. Customer Sees Badge on Seller Profile

```bash
GET /api/auth/sellers/507f1f77bcf86cd799439011
```

**Response includes:**
```json
{
  "businessName": "Premium Store",
  "isTrustedSeller": true,
  "rating": {
    "average": 4.8,
    "count": 342
  }
}
```

### 3. Customer Sees Badge on Products

```bash
GET /api/products/public
```

**Each product shows seller info:**
```json
{
  "name": "Gaming Laptop",
  "price": { "current": 999.99 },
  "sellerId": {
    "_id": "507f1f77bcf86cd799439011",
    "businessName": "Premium Store",
    "isTrustedSeller": true
  }
}
```

## 📊 Check Badge Status

### Via Admin List
```bash
GET /api/admin/users?role=seller
```

Look for:
```json
{
  "isTrustedSeller": true,
  "trustedBadgeAwardedAt": "2026-03-21T10:30:00Z"
}
```

### Via Seller Profile
```bash
GET /api/auth/sellers/{SELLER_ID}
```

Check: `"isTrustedSeller": true`

## ⚙️ Admin Operations

### Award Badge ✨
```bash
PUT /api/admin/sellers/{id}/trusted-badge
{ "isTrusted": true }
```

### Revoke Badge ❌
```bash
PUT /api/admin/sellers/{id}/trusted-badge
{ "isTrusted": false }
```

### View Trusted Sellers
```bash
GET /api/admin/users?role=seller | filter where isTrustedSeller == true
```

## 🧪 Test It Out

### Run Full Test Suite
```bash
# From project root
node tests/test-seller-trusted-badge.js
```

The test will:
1. Create test sellers
2. Award badges to some
3. Verify badges show up correctly
4. Show admin view
5. Demonstrate toggle operations

## 📋 Fields

| Field | Type | Purpose |
|-------|------|---------|
| `isTrustedSeller` | Boolean | Is seller trusted? (default: false) |
| `trustedBadgeAwardedAt` | Date | When was badge awarded? |

## 🔒 Permissions

| Role | Can Award | Can See |
|------|-----------|---------|
| Admin | ✅ Yes | ✅ Yes |
| Seller | ❌ No | ✅ Own badge |
| Customer | ❌ No | ✅ In profiles/products |

## 🎨 UI Implementation (Frontend)

### Show Badge on Product Card
```javascript
{product.sellerId.isTrustedSeller && (
  <span className="trusted-badge">✨ Trusted Seller</span>
)}
```

### Show in Seller Profile
```javascript
<div className="seller-card">
  <h2>{seller.businessName}</h2>
  {seller.isTrustedSeller && (
    <div className="badge">Trusted Seller</div>
  )}
  <Rating value={seller.rating.average} />
</div>
```

### Sort by Trusted
```javascript
// Filter products from trusted sellers
const trustedProducts = products.filter(
  p => p.sellerId.isTrustedSeller === true
);

// Or show trusted first
const sorted = products.sort(
  (a, b) => b.sellerId.isTrustedSeller - a.sellerId.isTrustedSeller
);
```

## 🐛 Troubleshooting

**Badge not showing?**
- Verify `isTrustedSeller: true` in database
- Check seller is verified and admin-verified
- Ensure API is returning the field

**Can't award badge?**
- Verify you're logged in as admin
- Check token authorization header
- Ensure seller exists and has role `seller`

**Getting 404?**
- Verify correct seller ID from database
- Check seller isn't deleted
- Ensure using correct API endpoint

## 📚 Full Documentation

See `docs/SELLER_TRUSTED_BADGE.md` for complete documentation

## 💬 Examples

### Award Badge to TopStore
```bash
curl -X PUT http://localhost:5000/api/admin/sellers/xyz123/trusted-badge \
  -H "Authorization: Bearer admin_token" \
  -H "Content-Type: application/json" \
  -d '{"isTrusted": true}'
```

### Remove Badge from BadStore
```bash
curl -X PUT http://localhost:5000/api/admin/sellers/abc789/trusted-badge \
  -H "Authorization: Bearer admin_token" \
  -H "Content-Type: application/json" \
  -d '{"isTrusted": false}'
```

### Check Seller's Badge Status
```bash
curl http://localhost:5000/api/auth/sellers/xyz123
```

Look for: `"isTrustedSeller": true`

## ✅ Checklist

- [x] Badge field exists in seller model
- [x] Admin can award/revoke badge
- [x] Badge shows in seller profile
- [x] Badge shows in product listings
- [x] Badge shows in admin view
- [x] Test suite created
- [x] Documentation complete

## 🚀 Next Steps

1. Run the test to verify everything works
2. Update frontend to show badge with ✨ icon
3. Add admin dashboard to award/manage badges
4. Consider auto-awarding based on metrics
5. Add badge tier system (Silver/Gold/Platinum)
