const express = require('express');
const router = express.Router();
const { auth, isSeller, isAdmin } = require('../middleware/auth');  // Fix the import path
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

/**
 * @swagger
 * /api/orders/seller/orders:
 *   get:
 *     summary: Get orders for seller's products
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, processing, shipped, delivered, cancelled]
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: '-createdAt'
 *     responses:
 *       200:
 *         description: List of orders containing seller's products
 *         content:
 *           application/json:
 *             example:
 *               orders:
 *                 - orderId: "65a123abc..."
 *                   customerDetails:
 *                     email: "customer@example.com"
 *                     fullName: "John Doe"
 *                   items:
 *                     - product:
 *                         id: "65a123def..."
 *                         name: "Product Name"
 *                         image: "https://example.com/image.jpg"
 *                       quantity: 2
 *                       price: 99.99
 *                       total: 199.98
 *                   status: "pending"
 *                   payment:
 *                     status: "pending"
 *                     method: "paystack"
 *                   orderDate: "2024-01-20T10:00:00.000Z"
 *               pagination:
 *                 total: 50
 *                 pages: 5
 *                 currentPage: 1
 *                 limit: 10
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not a seller account
 */
router.get('/seller/orders', auth, isSeller, orderController.getSellerOrders);

/**
 * @swagger
 * /api/orders/admin/orders:
 *   get:
 *     summary: Get all orders (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, processing, shipped, delivered, cancelled]
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: '-createdAt'
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by order ID or customer email
 *     responses:
 *       200:
 *         description: List of all orders with pagination
 *         content:
 *           application/json:
 *             example:
 *               orders:
 *                 - orderId: "65a123abc..."
 *                   customerType: "registered"
 *                   customer:
 *                     id: "65b234def..."
 *                     email: "customer@example.com" 
 *                     fullName: "John Doe"
 *                   items:
 *                     - product:
 *                         id: "65c345ghi..."
 *                         name: "iPhone 14 Pro"
 *                         image: "https://example.com/iphone.jpg"
 *                       seller:
 *                         id: "65d456jkl..."
 *                         name: "Apple Store"
 *                       quantity: 1
 *                       price: 999.99
 *                       total: 999.99
 *                   status: "pending"
 *                   payment:
 *                     status: "pending"
 *                     method: "paystack"
 *                     transactionId: null
 *                   shipping:
 *                     address:
 *                       street: "123 Main St"
 *                       city: "New York"
 *                       state: "NY"
 *                       country: "USA"
 *                       zipCode: "10001"
 *                     cost: 10.00
 *                     tracking: null
 *                   totals:
 *                     subtotal: 999.99
 *                     tax: 50.00
 *                     shipping: 10.00
 *                     final: 1059.99
 *                   createdAt: "2024-01-20T10:00:00.000Z"
 *                   updatedAt: "2024-01-20T10:00:00.000Z"
 *               pagination:
 *                 total: 50
 *                 pages: 5
 *                 currentPage: 1
 *                 limit: 10
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin access required
 */
router.get('/admin/orders', auth, isAdmin, orderController.getAllOrders);

/**
 * @swagger
 * /api/orders/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [today, week, month, year]
 *           default: month
 *     responses:
 *       200:
 *         description: Admin dashboard statistics
 *         content:
 *           application/json:
 *             example:
 *               overview:
 *                 totalOrders: 1250
 *                 totalRevenue: 125999.99
 *                 avgOrderValue: 100.80
 *                 pendingOrders: 45
 *               recentOrders:
 *                 - orderId: "65a123abc..."
 *                   customerType: "registered"
 *                   amount: 1059.99
 *                   status: "pending"
 *                   createdAt: "2024-01-20T10:00:00.000Z"
 *               orderStats:
 *                 pending: 45
 *                 confirmed: 150
 *                 processing: 80
 *                 shipped: 120
 *                 delivered: 800
 *                 cancelled: 55
 *               salesChart:
 *                 - date: "Jan 2024"
 *                   orders: 450
 *                   revenue: 45999.99
 *               topProducts:
 *                 - productId: "65c345ghi..."
 *                   name: "iPhone 14 Pro"
 *                   totalOrders: 120
 *                   revenue: 119998.80
 *               topCustomers:
 *                 - customerId: "65b234def..."
 *                   name: "John Doe"
 *                   totalOrders: 25
 *                   totalSpent: 24999.75
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin access required
 */
router.get('/admin/dashboard', auth, isAdmin, orderController.getAdminDashboard);

module.exports = router;
