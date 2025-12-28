const express = require('express');
const router = express.Router();
const { auth, isSeller, isAdmin } = require('../middleware/auth');  // Fix the import path
const orderController = require('../controllers/order.controller');


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
router.post('/customer/:orderId/confirm-receipt', auth, orderController.confirmReceipt);

router.get('/seller', auth, isSeller, orderController.getSellerOrders);


router.get('/admin/orders', auth, isAdmin, orderController.getAllOrders);


router.get('/admin/dashboard', auth, isAdmin, orderController.getAdminDashboard);

module.exports = router;
