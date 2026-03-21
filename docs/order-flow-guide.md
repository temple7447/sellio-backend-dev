# Order Flow Step-by-Step Guide (Direct Image Uploads)

This guide explains how to complete a full order process from payment to fund release using the updated endpoints that support direct image uploads via `FormData`.

---

## 1. Customer Payment
**Endpoint:** `POST /api/orders/customer/:orderId/pay`  
**Description:** Initializes the payment via Paystack.  
**Action:** The buyer completes the payment on the Paystack checkout page.

---

## 2. Seller Fulfillment (Proof of Shipping)
**Endpint:** `POST /api/orders/seller/:orderItemId/shipped`  
**Description:** Seller confirms the item has been dispatched by uploading a photo of the receipt or package.  
**Frontend Action:** Use `FormData` to send the image file.

**Request Example (JS):**
```javascript
const formData = new FormData();
formData.append('proof', fileInput.files[0]); // The image file

const response = await fetch(`/api/orders/seller/${orderItemId}/shipped`, {
  method: 'POST',
  body: formData,
  headers: {
    'Authorization': `Bearer ${sellerToken}`
  }
});
```

---

## 3. Buyer Confirmation (Proof of Receipt)
**Endpoint:** `POST /api/orders/customer/:orderId/confirm-receipt`  
**Description:** Buyer confirms they have received the items by uploading a photo of the received package.  
**Frontend Action:** Use `FormData` to send the image file and specify which items are being confirmed.

**Request Example (JS):**
```javascript
const formData = new FormData();
formData.append('proof', fileInput.files[0]); // The receipt photo
formData.append('itemIds', 'item_id_1,item_id_2'); // Comma-separated list of item IDs

const response = await fetch(`/api/orders/customer/${orderId}/confirm-receipt`, {
  method: 'POST',
  body: formData,
  headers: {
    'Authorization': `Bearer ${buyerToken}`
  }
});
```

---

## 4. Fund Release
**Action:** Automatic (Backend)  
**Description:** Once BOTH the seller proof (Step 2) and buyer proof (Step 3) are present for an item, the backend automatically:
1. Credits the seller's wallet.
2. Updates the item status to `delivered`.
3. If all items in the order are delivered, updates the order status to `delivered`.

---

## Important Notes:
- **Field Name:** Always use the key **`proof`** for the image file in your `FormData`.
- **Fallbacks:** The endpoints still support sending a `proofUrl` in a JSON body if you prefer to upload to Cloudinary separately, but `FormData` is now the recommended approach for a simpler flow.
