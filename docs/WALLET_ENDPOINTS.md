# Wallet API Endpoints Documentation

## Base Path
```
/api/wallet
```

## Authentication
**All endpoints require:**
- Authentication token (Bearer token)
- User must be verified

**Role-Specific Endpoints:**
- Withdrawal endpoints: Seller or Admin only
- Admin transactions: Admin only
- Credit/Debit operations: Admin only

---

## Endpoints

### 1. Get Wallet Balance
**Endpoint:** `GET /api/wallet/balance`

**Authentication:** Required (All authenticated users)

**Response (Success - 200):**
```json
{
  "balance": 50000,
  "currency": "NGN",
  "lastTransaction": "2026-02-27T10:30:00.000Z",
  "status": "active"
}
```

**Status Values:**
- `active` - Wallet is active and can be used
- `locked` - Wallet is locked, no transactions allowed
- `maintenance` - Wallet is under maintenance

---

### 2. Get Transaction History
**Endpoint:** `GET /api/wallet/transactions`

**Authentication:** Required (All authenticated users)

**Query Parameters (Optional):**
```
page    - Page number (default: 1)
limit   - Items per page (default: 20)
type    - Filter by transaction type (deposit, withdrawal, payment, refund)
status  - Filter by status (pending, completed, failed)
```

**Example URL:**
```
GET /api/wallet/transactions?page=1&limit=20&type=deposit&status=completed
```

**Response (Success - 200):**
```json
{
  "transactions": [
    {
      "_id": "transaction_id",
      "userId": "user_id",
      "type": "deposit",
      "amount": 10000,
      "balanceBefore": 40000,
      "balanceAfter": 50000,
      "reference": "TXN20260227103000",
      "description": "Payment for order #12345",
      "status": "completed",
      "paymentGateway": "paystack",
      "relatedOrder": "order_id",
      "createdAt": "2026-02-27T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 150,
    "pages": 8,
    "currentPage": 1,
    "limit": 20
  }
}
```

---

### 3. Get Wallet Summary
**Endpoint:** `GET /api/wallet/summary`

**Authentication:** Required (All authenticated users)

**Response (Success - 200):**
```json
{
  "balance": 50000,
  "currency": "NGN",
  "status": "active",
  "statistics": {
    "totalDeposits": 150000,
    "totalWithdrawals": 100000,
    "totalPayments": 80000,
    "totalRefunds": 20000,
    "transactionCount": 45,
    "lastTransactionDate": "2026-02-27T10:30:00.000Z",
    "thisMonthDeposits": 30000,
    "thisMonthWithdrawals": 15000
  }
}
```

---

### 4. Verify Transaction by Reference
**Endpoint:** `GET /api/wallet/transaction/:reference`

**Authentication:** Required (All authenticated users)

**URL Parameters:**
```
:reference - Transaction reference ID
```

**Response (Success - 200):**
```json
{
  "_id": "transaction_id",
  "userId": "user_id",
  "type": "deposit",
  "amount": 10000,
  "reference": "TXN20260227103000",
  "status": "completed",
  "description": "Payment for order",
  "balanceBefore": 40000,
  "balanceAfter": 50000,
  "paymentGateway": "paystack",
  "createdAt": "2026-02-27T10:30:00.000Z"
}
```

---

### 5. Get List of Banks
**Endpoint:** `GET /api/wallet/banks`

**Authentication:** Required

**Response (Success - 200):**
```json
{
  "banks": [
    {
      "id": "011",
      "code": "011",
      "name": "First Bank Nigeria",
      "slug": "first-bank-nigeria",
      "type": "nuban"
    },
    {
      "id": "044",
      "code": "044",
      "name": "Access Bank Nigeria",
      "slug": "access-bank",
      "type": "nuban"
    },
    {
      "id": "050",
      "code": "050",
      "name": "Guaranty Trust Bank",
      "slug": "guaranty-trust-bank",
      "type": "nuban"
    }
  ]
}
```

---

### 6. Verify Bank Account
**Endpoint:** `POST /api/wallet/verify-account`

**Authentication:** Required

**Request Body:**
```json
{
  "accountNumber": "1234567890",
  "bankCode": "011"
}
```

**Response (Success - 200):**
```json
{
  "accountName": "John Doe",
  "accountNumber": "1234567890",
  "bankCode": "011",
  "bankName": "First Bank Nigeria",
  "verified": true
}
```

**Error Responses:**
- `400` - Invalid account number or bank code
- `404` - Account not found

---

### 7. Request Withdrawal
**Endpoint:** `POST /api/wallet/withdraw`

**Authentication:** Required (Seller or Admin only)

**Request Body:**
```json
{
  "amount": 25000
}
```

**Response (Success - 200):**
```json
{
  "message": "Withdrawal request processed successfully",
  "transaction": {
    "_id": "transaction_id",
    "type": "withdrawal",
    "amount": 25000,
    "status": "pending",
    "reference": "WTH20260227103000"
  },
  "newBalance": 25000,
  "requiresManualAction": true
}
```

**Error Responses:**
- `400` - Insufficient wallet balance
  ```json
  {
    "message": "Insufficient wallet balance",
    "required": 25000,
    "available": 15000
  }
  ```
- `403` - Wallet is locked or under maintenance

---

## ADMIN ONLY ENDPOINTS

### 8. Get All Transactions (Admin)
**Endpoint:** `GET /api/wallet/admin/transactions`

**Authentication:** Required (Admin only)

**Query Parameters (Optional):**
```
page      - Page number (default: 1)
limit     - Items per page (default: 20)
type      - Transaction type filter
status    - Transaction status filter
userId    - Filter by specific user ID
reference - Filter by transaction reference
```

**Example URL:**
```
GET /api/wallet/admin/transactions?page=1&limit=20&status=pending
```

**Response (Success - 200):**
```json
{
  "transactions": [
    {
      "_id": "transaction_id",
      "userId": {
        "_id": "user_id",
        "fullName": "John Doe",
        "email": "john@example.com",
        "businessName": "John's Business"
      },
      "type": "withdrawal",
      "amount": 25000,
      "status": "pending",
      "reference": "WTH20260227103000",
      "createdAt": "2026-02-27T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 500,
    "pages": 25,
    "currentPage": 1,
    "limit": 20
  }
}
```

---

### 9. Credit Wallet (Admin)
**Endpoint:** `POST /api/wallet/credit`

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "userId": "user_id_here",
  "amount": 10000,
  "description": "Referral bonus for order"
}
```

**Response (Success - 200):**
```json
{
  "message": "Wallet credited successfully",
  "balanceBefore": 40000,
  "balanceAfter": 50000,
  "transaction": {
    "_id": "transaction_id",
    "amount": 10000,
    "type": "deposit",
    "status": "completed",
    "reference": "CRD20260227103000"
  }
}
```

---

### 10. Debit Wallet (Admin)
**Endpoint:** `POST /api/wallet/debit`

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "userId": "user_id_here",
  "amount": 5000,
  "description": "Adjustment for disputed order"
}
```

**Response (Success - 200):**
```json
{
  "message": "Wallet debited successfully",
  "balanceBefore": 50000,
  "balanceAfter": 45000,
  "transaction": {
    "_id": "transaction_id",
    "amount": 5000,
    "type": "payment",
    "status": "completed",
    "reference": "DEB20260227103000"
  }
}
```

**Error Responses:**
- `400` - Insufficient wallet balance
- `403` - Wallet is locked

---

### 11. Approve Withdrawal (Admin)
**Endpoint:** `POST /api/wallet/admin/withdrawals/:transactionId/approve`

**Authentication:** Required (Admin only)

**URL Parameters:**
```
:transactionId - The transaction ID to approve
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Withdrawal approved successfully",
  "transaction": {
    "_id": "transaction_id",
    "status": "completed",
    "amount": 25000,
    "reference": "WTH20260227103000",
    "approvedAt": "2026-02-27T11:00:00.000Z"
  }
}
```

---

### 12. Decline Withdrawal (Admin)
**Endpoint:** `POST /api/wallet/admin/withdrawals/:transactionId/decline`

**Authentication:** Required (Admin only)

**URL Parameters:**
```
:transactionId - The transaction ID to decline
```

**Request Body:**
```json
{
  "reason": "Account verification pending"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Withdrawal declined successfully",
  "transaction": {
    "_id": "transaction_id",
    "status": "failed",
    "amount": 25000,
    "reason": "Account verification pending",
    "declinedAt": "2026-02-27T11:00:00.000Z"
  }
}
```

---

## cURL Examples

### Get Wallet Balance
```bash
curl -X GET http://localhost:3000/api/wallet/balance \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Transaction History
```bash
curl -X GET "http://localhost:3000/api/wallet/transactions?page=1&limit=20&type=deposit" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Wallet Summary
```bash
curl -X GET http://localhost:3000/api/wallet/summary \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Verify Account
```bash
curl -X POST http://localhost:3000/api/wallet/verify-account \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "accountNumber": "1234567890",
    "bankCode": "011"
  }'
```

### Request Withdrawal
```bash
curl -X POST http://localhost:3000/api/wallet/withdraw \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 25000
  }'
```

### Get Banks List
```bash
curl -X GET http://localhost:3000/api/wallet/banks \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Credit Wallet (Admin)
```bash
curl -X POST http://localhost:3000/api/wallet/credit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_id_here",
    "amount": 10000,
    "description": "Referral bonus"
  }'
```

### Approve Withdrawal (Admin)
```bash
curl -X POST http://localhost:3000/api/wallet/admin/withdrawals/transaction_id/approve \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Decline Withdrawal (Admin)
```bash
curl -X POST http://localhost:3000/api/wallet/admin/withdrawals/transaction_id/decline \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Account verification pending"
  }'
```

---

## JavaScript/Fetch Examples

### Get Wallet Balance
```javascript
fetch('http://localhost:3000/api/wallet/balance', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => console.log(`Balance: ${data.balance} ${data.currency}`));
```

### Get Transactions
```javascript
fetch('http://localhost:3000/api/wallet/transactions?page=1&limit=20', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => console.log(data.transactions));
```

### Get Wallet Summary
```javascript
fetch('http://localhost:3000/api/wallet/summary', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => {
  console.log(`Balance: ${data.balance}`);
  console.log(`Total Deposits: ${data.statistics.totalDeposits}`);
  console.log(`Total Withdrawals: ${data.statistics.totalWithdrawals}`);
});
```

### Verify Account
```javascript
fetch('http://localhost:3000/api/wallet/verify-account', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    accountNumber: '1234567890',
    bankCode: '011'
  })
})
.then(res => res.json())
.then(data => console.log(`Account Name: ${data.accountName}`));
```

### Request Withdrawal
```javascript
fetch('http://localhost:3000/api/wallet/withdraw', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 25000
  })
})
.then(res => res.json())
.then(data => {
  console.log(`Withdrawal Status: ${data.transaction.status}`);
  console.log(`Reference: ${data.transaction.reference}`);
  console.log(`New Balance: ${data.newBalance}`);
});
```

### Get Banks List
```javascript
fetch('http://localhost:3000/api/wallet/banks', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => {
  data.banks.forEach(bank => {
    console.log(`${bank.name} (${bank.code})`);
  });
});
```

### Credit Wallet (Admin)
```javascript
fetch('http://localhost:3000/api/wallet/credit', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: 'user_id_here',
    amount: 10000,
    description: 'Referral bonus'
  })
})
.then(res => res.json())
.then(data => {
  console.log(`Balance Before: ${data.balanceBefore}`);
  console.log(`Balance After: ${data.balanceAfter}`);
});
```

### Approve Withdrawal (Admin)
```javascript
fetch('http://localhost:3000/api/wallet/admin/withdrawals/transaction_id/approve', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => console.log(`Withdrawal approved: ${data.transaction.reference}`));
```

---

## Transaction Types

| Type | Description | Direction |
|------|-------------|-----------|
| `deposit` | Funds added (payment, referral bonus) | ➕ In |
| `withdrawal` | Seller requesting to withdraw funds | ➖ Out |
| `payment` | Customer paying for order using wallet | ➖ Out |
| `refund` | Refund for cancelled order | ➕ In |
| `transfer` | Internal transfer | ➖ Out / ➕ In |

---

## Transaction Status

| Status | Description |
|--------|-------------|
| `pending` | Awaiting processing or admin approval |
| `completed` | Transaction successfully processed |
| `failed` | Transaction failed |
| `cancelled` | Transaction was cancelled |
| `processing` | Currently being processed |

---

## Wallet Use Cases

### 1. Customer Deposits Funds
✅ Pay via Paystack/Bank Transfer  
✅ Funds credited to wallet  
✅ Transaction recorded with reference  
✅ Can use funds to pay for orders instantly  

### 2. Seller Earns Money from Sales
✅ Customer confirms receipt of product  
✅ Seller funds credited to wallet (escrow release)  
✅ Seller can withdraw or use for next purchase  

### 3. Seller Withdrawals
✅ Seller requests withdrawal  
✅ Status: pending (awaits admin approval)  
✅ Admin verifies account and approves  
✅ Admin marks as completed  
✅ Real transfer handled via bank transfer (manual)  

### 4. Refunds
✅ Order cancelled or disputed  
✅ Amount refunded to customer wallet  
✅ Customer can withdraw or use for purchase  

### 5. Admin Operations
✅ Credit user for referral bonus  
✅ Debit user for dispute resolution  
✅ Manage withdrawal approvals  
✅ View all system transactions  

---

## Business Rules

1. **Minimum Withdrawal Amount:**
   - Must be > 0
   - Depends on system configuration

2. **Wallet Balance Constraints:**
   - Cannot have negative balance
   - Cannot withdraw more than available
   - Atomic operations to prevent race conditions

3. **Withdrawal Process:**
   - Seller/Admin initiates withdrawal (status: pending)
   - Admin reviews verification (bank account validity)
   - Admin approves or declines
   - If approved → marked as completed (actual bank transfer manual)
   - If declined → refunded to wallet + reason provided

4. **Transaction Recording:**
   - All transactions recorded with reference ID
   - Balance before & after tracked
   - Payment gateway stored
   - Related order ID (if applicable) stored

5. **Currency:**
   - Default: NGN (Nigerian Naira)
   - All amounts in smallest unit

---

## Security & Validation

✅ **All amounts validated:**
  - Must be > 0
  - Must be integer
  - Sufficient balance check

✅ **Atomic operations:**
  - No race conditions
  - Balance updates with atomic increment/decrement
  - Rollback on transaction log failure

✅ **Lock mechanisms:**
  - Wallet status validation
  - Cannot debit locked wallet
  - Manual unlock by admin only

✅ **Audit trail:**
  - All transactions immutable
  - Admin ID recorded for manual actions
  - Reason recorded for declines

---

## Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request / Invalid amount / Insufficient balance |
| 401 | Unauthorized / Invalid token |
| 403 | Forbidden (locked wallet or wrong role) |
| 404 | Transaction/Account not found |
| 500 | Server error |

---

## Requirements & Constraints

✅ **Required:**
- Valid authentication token
- User must be verified
- Valid amount (> 0)
- Sufficient balance for debit operations

❌ **Not Allowed:**
- Sellers withdrawing while account unverified
- Impossible amounts (negative, zero)
- Transactions on locked wallets
- Non-sellers/admins initiating withdrawals

---

## Endpoint Summary

| Method | Endpoint | Purpose | Auth | Role |
|--------|----------|---------|------|------|
| GET | `/balance` | Get wallet balance | Yes | All |
| GET | `/transactions` | Get transaction history | Yes | All |
| GET | `/summary` | Get wallet summary & stats | Yes | All |
| GET | `/transaction/:reference` | Verify transaction | Yes | All |
| GET | `/banks` | Get supported banks list | Yes | All |
| POST | `/verify-account` | Verify bank account | Yes | All |
| POST | `/withdraw` | Request withdrawal | Yes | Seller/Admin |
| GET | `/admin/transactions` | Get all transactions | Yes | Admin |
| POST | `/credit` | Credit wallet | Yes | Admin |
| POST | `/debit` | Debit wallet | Yes | Admin |
| POST | `/admin/withdrawals/:id/approve` | Approve withdrawal | Yes | Admin |
| POST | `/admin/withdrawals/:id/decline` | Decline withdrawal | Yes | Admin |

---

## Response Data Structure

### Wallet Object
```json
{
  "balance": 50000,
  "currency": "NGN",
  "status": "active",
  "lastTransaction": "2026-02-27T10:30:00.000Z"
}
```

### Transaction Object
```json
{
  "_id": "transaction_id",
  "userId": "user_id",
  "type": "deposit",
  "amount": 10000,
  "balanceBefore": 40000,
  "balanceAfter": 50000,
  "reference": "TXN20260227103000",
  "description": "Payment for order",
  "status": "completed",
  "paymentGateway": "paystack",
  "relatedOrder": "order_id",
  "metadata": {},
  "createdAt": "2026-02-27T10:30:00.000Z"
}
```

---

## Frontend Integration Tips

### 1. Display Wallet Balance Widget
```javascript
async function updateWalletDisplay() {
  const response = await fetch('/api/wallet/balance', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  document.querySelector('.wallet-balance').textContent = 
    `${data.balance.toLocaleString()} ${data.currency}`;
}
```

### 2. Transaction History Page
```javascript
async function loadTransactionHistory(page = 1) {
  const response = await fetch(
    `/api/wallet/transactions?page=${page}&limit=10`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  
  const data = await response.json();
  
  // Display transactions
  data.transactions.forEach(txn => {
    console.log(`${txn.type}: ${txn.amount} - ${txn.status}`);
  });
  
  // Render pagination
  updatePagination(data.pagination);
}
```

### 3. Withdrawal Request Flow
```javascript
async function requestWithdrawal(amount) {
  const response = await fetch('/api/wallet/withdraw', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ amount })
  });
  
  if (!response.ok) {
    const error = await response.json();
    showError(error.message);
    return;
  }
  
  const data = await response.json();
  showSuccess(`Withdrawal request #${data.transaction.reference}`);
  updateWalletDisplay();
}
```

### 4. Wallet Summary Dashboard
```javascript
async function loadWalletSummary() {
  const response = await fetch('/api/wallet/summary', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  
  // Display stats
  document.querySelector('.balance').textContent = data.balance;
  document.querySelector('.total-deposits').textContent = 
    data.statistics.totalDeposits;
  document.querySelector('.total-withdrawals').textContent = 
    data.statistics.totalWithdrawals;
  document.querySelector('.this-month').textContent = 
    data.statistics.thisMonthDeposits;
}
```

