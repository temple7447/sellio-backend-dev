const express = require('express');
const router = express.Router();
const { auth, isSeller, isAdmin } = require('../middleware/auth');
const orderController = require('../controllers/order.controller');
const multer = require('multer');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
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

// Customer confirms they have received the order
router.post('/customer/:orderId/confirm-receipt', auth, upload.single('proof'), orderController.confirmReceipt);

router.get('/seller', auth, isSeller, orderController.getSellerOrders);


router.get('/admin/orders', auth, isAdmin, orderController.getAllOrders);


router.get('/admin/dashboard', auth, isAdmin, orderController.getAdminDashboard);

// General order detail route for authenticated users (Buyer, Seller, Admin)
router.get('/:orderId', auth, orderController.getOrderDetail);

// Seller fulfillment routes
router.post('/seller/:orderItemId/fulfillment-proof', auth, isSeller, upload.single('proof'), orderController.uploadFulfillmentProof);
router.post('/seller/:orderItemId/shipped', auth, isSeller, upload.single('proof'), orderController.uploadFulfillmentProof);

module.exports = router;
