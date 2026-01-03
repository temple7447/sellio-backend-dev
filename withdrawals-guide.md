# Bank Withdrawals via Paystack - Guide

This guide explains how to use the new wallet withdrawal features integrated with Paystack.

---

## 1. Updating Bank Information
Sellers must update their bank information including the **Bank Code** before they can withdraw.

**Endpoint:** `POST /api/auth/seller/bank-info`  
**Description:** Saves seller's bank details.  
**Request Body:**
```json
{
  "bankName": "Access Bank",
  "bankCode": "044", 
  "accountNumber": "0000000000",
  "accountName": "John Doe"
}
```

---

## 2. Helper Endpoints for the UI
Use these to build a smooth bank selection and verification UI.

### A. Get All Banks
**Endpoint:** `GET /api/wallet/banks`  
**Description:** Returns a list of all Nigerian banks supported by Paystack. Use this to populate your "Select Bank" dropdown.

### B. Verify Account Number
**Endpoint:** `POST /api/wallet/verify-account`  
**Description:** Verifies an account number and returns the account name. Use this to confirm the user has entered the correct details before they save.  
**Request Body:**
```json
{
  "accountNumber": "0000000000",
  "bankCode": "044"
}
```

---

## 3. Initiating a Withdrawal
**Endpoint:** `POST /api/wallet/withdraw`  
**Description:** Debits the user's wallet and initiates a real-time transfer via Paystack.

**Request Example:**
```javascript
const response = await fetch('/api/wallet/withdraw', {
  method: 'POST',
  body: JSON.stringify({ amount: 5000 }),
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
});
```

---

## Important Notes:
- **Environment Variable:** Ensure `PAYSTACK_SECRET_KEY` is correctly set in your `.env` file.
- **Verification:** Only verified sellers can withdraw funds.
- **Recipient Codes:** The backend automatically manages "Transfer Recipients" on Paystack. If a user changes their bank info, a new recipient is created automatically on their next withdrawal.
