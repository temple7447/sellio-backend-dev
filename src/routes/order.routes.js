const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');  // Add this import
const orderController = require('../controllers/order.controller');

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Create a new order (guest)
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *               - shippingAddress
 *               - guestEmail
 *             properties:
 *               guestEmail:
 *                 type: string
 *                 format: email
 *                 description: Customer's email address
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - quantity
 *                   properties:
 *                     productId:
 *                       type: string
 *                       description: MongoDB ID of the product
 *                     quantity:
 *                       type: number
 *                       minimum: 1
 *                       description: Number of items to order
 *               shippingAddress:
 *                 type: object
 *                 required:
 *                   - fullName
 *                   - email
 *                   - phoneNumber
 *                   - street
 *                   - city
 *                   - state
 *                   - country
 *                   - zipCode
 *                 properties:
 *                   fullName:
 *                     type: string
 *                   email:
 *                     type: string
 *                     format: email
 *                   phoneNumber:
 *                     type: string
 *                   street:
 *                     type: string
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *                   country:
 *                     type: string
 *                   zipCode:
 *                     type: string
 *           example:
 *             guestEmail: "customer@example.com"
 *             items: [
 *               {
 *                 "productId": "65a123abc...",
 *                 "quantity": 2
 *               }
 *             ]
 *             shippingAddress:
 *               fullName: "John Doe"
 *               email: "customer@example.com"
 *               phoneNumber: "1234567890"
 *               street: "123 Main St"
 *               city: "Sample City"
 *               state: "Sample State"
 *               country: "Sample Country"
 *               zipCode: "12345"
 */
router.post('/', orderController.createOrder);

/**
 * @swagger
 * /api/orders/guest/orders/{email}:
 *   get:
 *     summary: Get orders by guest email
 *     tags: [Orders]
 */
router.get('/guest/orders/:email', orderController.getGuestOrders);

/**
 * @swagger
 * /api/orders/guest/{orderId}:
 *   get:
 *     summary: Get guest order details
 *     tags: [Orders]
 */
router.get('/guest/:orderId', orderController.getGuestOrder);

/**
 * @swagger
 * /api/orders/{orderId}/pay:
 *   post:
 *     summary: Initiate payment for an order
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment initialization successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 order:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     status:
 *                       type: string
 *                 paymentUrl:
 *                   type: string
 *                   description: Paystack payment URL to redirect the customer
 *                 reference:
 *                   type: string
 *                   description: Payment reference to track the transaction
 *             example:
 *               order:
 *                 _id: "65a123abc..."
 *                 status: "pending"
 *               paymentUrl: "https://checkout.paystack.com/abc123"
 *               reference: "ORD-65a123abc"
 */
router.post('/:orderId/pay', orderController.initiatePayment);

/**
 * @swagger
 * /api/orders/verify/{reference}:
 *   get:
 *     summary: Verify payment for an order
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment reference from Paystack (full reference string)
 */
router.get('/verify/:reference', orderController.verifyPayment);

/**
 * @swagger
 * /api/orders/customer:
 *   get:
 *     summary: Get customer orders (authenticated customers only)
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of customer orders
 *       401:
 *         description: Not authenticated
 */
router.get('/customer', auth, orderController.getCustomerOrders);

/**
 * @swagger
 * /api/orders/customer/create:
 *   post:
 *     summary: Create a new order (authenticated customer)
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *               - deliveryInfo
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - quantity
 *                   properties:
 *                     productId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *               deliveryInfo:
 *                 type: object
 *                 required:
 *                   - fullName
 *                   - phoneNumber
 *                   - street
 *                   - city
 *                   - state
 *                   - country
 *                   - zipCode
 *                   - deliveryMethod
 *                 properties:
 *                   fullName:
 *                     type: string
 *                   phoneNumber:
 *                     type: string
 *                   street:
 *                     type: string
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *                   country:
 *                     type: string
 *                   zipCode:
 *                     type: string
 *                   deliveryMethod:
 *                     type: string
 *                     enum: [standard, express]
 *                   specialInstructions:
 *                     type: string
 *           example:
 *             items: [
 *               {
 *                 "productId": "65a123abc...",
 *                 "quantity": 2
 *               }
 *             ]
 *             deliveryInfo: {
 *               "fullName": "John Doe",
 *               "phoneNumber": "1234567890",
 *               "street": "123 Main St",
 *               "city": "Sample City",
 *               "state": "Sample State",
 *               "country": "Sample Country",
 *               "zipCode": "12345",
 *               "deliveryMethod": "standard",
 *               "specialInstructions": "Leave at door"
 *             }
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authenticated
 */
router.post('/customer/create', auth, orderController.createCustomerOrder);

/**
 * @swagger
 * /api/orders/customer/{orderId}/status:
 *   get:
 *     summary: Get customer order status and tracking
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order status and tracking details
 *       404:
 *         description: Order not found
 */
router.get('/customer/:orderId/status', auth, orderController.getOrderStatus);

/**
 * @swagger
 * /api/orders/customer/{orderId}/pay:
 *   post:
 *     summary: Initialize payment for customer order
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment initialization successful
 */
router.post('/customer/:orderId/pay', auth, orderController.initializeCustomerPayment);

module.exports = router;
