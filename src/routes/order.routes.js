const express = require('express');
const router = express.Router();
const { auth, isSeller, isAdmin } = require('../middleware/auth');
const orderController = require('../controllers/order.controller');
const multer = require('multer');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});


router.post('/', orderController.createOrder);


router.get('/guest/orders/:email', orderController.getGuestOrders);


router.get('/guest/:orderId', orderController.getGuestOrder);


router.post('/:orderId/pay', orderController.initiatePayment);


router.get('/verify/:reference', orderController.verifyPayment);


router.get('/verify-payment/:reference', orderController.verifyPayment);


router.get('/customer', auth, orderController.getCustomerOrders);

router.post('/customer/create', auth, orderController.createCustomerOrder);


router.get('/customer/:orderId/status', auth, orderController.getOrderStatus);


router.post('/customer/:orderId/pay', auth, orderController.initializeCustomerPayment);
router.post('/customer/:orderId/pay-wallet', auth, orderController.payWithWallet);

// Customer uploads payment proof for direct transfer
router.post('/customer/:orderId/upload-payment-proof', auth, upload.single('proof'), orderController.uploadPaymentProof);

// Customer confirms they have received the order
router.post('/customer/:orderId/confirm-receipt', auth, upload.single('proof'), orderController.confirmReceipt);

// Cancellation routes
router.post('/customer/:orderId/cancel', auth, orderController.cancelOrder);
router.post('/customer/item/:orderItemId/cancel', auth, orderController.cancelOrderItem);
router.post('/seller/item/:orderItemId/cancel', auth, isSeller, orderController.cancelOrderItem);

// Complaint routes
router.post('/:orderId/complain', auth, upload.array('images', 5), orderController.fileComplaint);

// Admin Complaint Management
router.get('/admin/complaints', auth, isAdmin, orderController.getAllComplaints);
router.post('/admin/complaints/:complaintId/resolve', auth, isAdmin, orderController.resolveOrderComplaint);

router.get('/seller', auth, isSeller, orderController.getSellerOrders);


router.get('/admin/orders', auth, isAdmin, orderController.getAllOrders);


router.get('/admin/dashboard', auth, isAdmin, orderController.getAdminDashboard);

// Admin: Verify direct transfer payment
router.post('/admin/:orderId/verify-payment', auth, isAdmin, orderController.adminVerifyPayment);

// Admin: Cancel order and refund buyer (for underpayment cases)
router.post('/admin/:orderId/cancel-refund', auth, isAdmin, orderController.adminCancelAndRefund);

// Admin: Cancel an unpaid order (no proof uploaded, no refund needed)
router.post('/admin/:orderId/cancel-unpaid', auth, isAdmin, orderController.adminCancelUnpaidOrder);

// General order detail route for authenticated users (Buyer, Seller, Admin)
router.get('/:orderId', auth, orderController.getOrderDetail);

// Seller fulfillment routes
router.post('/seller/:orderItemId/fulfillment-proof', auth, isSeller, upload.single('proof'), orderController.uploadFulfillmentProof);
router.post('/seller/:orderItemId/shipped', auth, isSeller, upload.single('proof'), orderController.uploadFulfillmentProof);

module.exports = router;
