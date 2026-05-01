# Withdrawal Frontend Implementation Guide

## API Endpoint

**POST** `/api/wallet/withdraw`

### Headers
```
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body
```json
{
  "amount": 2000
}
```

### Response
```json
{
  "message": "Withdrawal request processed successfully",
  "transaction": { ... },
  "newBalance": 15000,
  "requiresManualAction": false,
  "feeDetails": {
    "originalAmount": 2000,
    "feePercentage": 3,
    "feeAmount": 60,
    "amountAfterFee": 1940
  }
}
```

---

## Fee Structure

| User Role | Fee Percentage | Example (₦2000) |
|-----------|----------------|------------------|
| Seller    | 3%             | ₦60 fee, ₦1940 received |
| Buyer     | 1.5%           | ₦30 fee, ₦1970 received |

---

## Frontend Implementation

### 1. Withdrawal Form Component

```javascript
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const WithdrawalForm = () => {
  const [amount, setAmount] = useState('');
  const [feeDetails, setFeeDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState('');

  // Fetch user profile to get role
  useEffect(() => {
    const fetchUser = async () => {
      const res = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setUserRole(res.data.role);
    };
    fetchUser();
  }, []);

  // Calculate fee preview (client-side)
  const calculateFee = (amount, role) => {
    const feePercentage = role === 'seller' ? 0.03 : 0.015;
    const feeAmount = Math.round(amount * feePercentage * 100) / 100;
    const amountAfterFee = Math.round((amount - feeAmount) * 100) / 100;
    return { feePercentage: feePercentage * 100, feeAmount, amountAfterFee };
  };

  const handleAmountChange = (e) => {
    const value = e.target.value;
    setAmount(value);

    if (value && userRole) {
      const fee = calculateFee(parseFloat(value), userRole);
      setFeeDetails(fee);
    } else {
      setFeeDetails(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await axios.post('/api/wallet/withdraw', {
        amount: parseFloat(amount)
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      alert(`Withdrawal requested! You will receive ₦${res.data.feeDetails.amountAfterFee}`);
      setAmount('');
      setFeeDetails(null);
    } catch (error) {
      alert(error.response?.data?.message || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Withdraw Funds</h2>
      <p>Your role: <strong>{userRole}</strong></p>
      <p>Fee: <strong>{userRole === 'seller' ? '3%' : '1.5%'}</strong></p>

      <input
        type="number"
        placeholder="Amount (₦)"
        value={amount}
        onChange={handleAmountChange}
        required
      />

      {feeDetails && (
        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f5f5f5' }}>
          <p>Original Amount: ₦{parseFloat(amount).toFixed(2)}</p>
          <p>Fee ({feeDetails.feePercentage}%): ₦{feeDetails.feeAmount.toFixed(2)}</p>
          <p><strong>You will receive: ₦{feeDetails.amountAfterFee.toFixed(2)}</strong></p>
        </div>
      )}

      <button type="submit" disabled={loading || !amount}>
        {loading ? 'Processing...' : 'Withdraw'}
      </button>
    </form>
  );
};

export default WithdrawalForm;
```

---

### 2. Withdrawal History Component

```javascript
const WithdrawalHistory = () => {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const fetchHistory = async () => {
      const res = await axios.get('/api/wallet/transactions', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      // Filter only withdrawals
      const withdrawals = res.data.filter(t => t.type === 'withdrawal');
      setTransactions(withdrawals);
    };
    fetchHistory();
  }, []);

  return (
    <div>
      <h3>Withdrawal History</h3>
      {transactions.map(tx => (
        <div key={tx._id} style={{ border: '1px solid #ccc', padding: '10px', margin: '10px 0' }}>
          <p>Amount: ₦{tx.amount}</p>
          <p>Status: {tx.status}</p>
          {tx.metadata?.feeAmount && (
            <p>Fee: ₦{tx.metadata.feeAmount} ({tx.metadata.feePercentage}%)</p>
          )}
          <p>Date: {new Date(tx.createdAt).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
};
```

---

## Important Notes

1. **Bank Details Required**: Users must have bank account details in their profile before withdrawing
2. **Verification Required**: Users must be verified (`isVerified` + `adminVerified`)
3. **Minimum Withdrawal**: Check `RewardSettings.withdrawal.minAmount` for minimum limit
4. **Fee Calculation**: Backend handles fee calculation, but frontend can preview it
5. **Manual Withdrawals**: Some withdrawals may require manual admin approval (`requiresManualAction: true`)
