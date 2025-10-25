const MarketOrder = require('../models/MarketOrder');
const MarketProduct = require('../models/MarketProduct');
const { MarketUser } = require('../models/MarketUser');  // Fix import to use destructuring
const axios = require('axios');
const config = require('../config/config');
const paystackService = require('../utils/paystack');
const mongoose = require('mongoose');  // Add this import at the top

class OrderService {
    async createOrder(orderData) {
        // Validate order items and calculate totals
        const { items, shippingAddress, guestEmail } = orderData;
        
        if (!guestEmail) {
            throw { status: 400, message: 'Guest email is required' };
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(guestEmail)) {
            throw { status: 400, message: 'Invalid email format' };
        }

        // Get product details and validate inventory
        const productIds = items.map(item => item.productId);
        const products = await MarketProduct.find({ _id: { $in: productIds }, status: 'active' });
        
        let subtotal = 0;
        const processedItems = [];

        for (const item of items) {
            const product = products.find(p => p._id.toString() === item.productId);
            if (!product) {
                throw { status: 400, message: `Product ${item.productId} not found` };
            }
            
            if (product.inventory.quantity < item.quantity) {
                throw { 
                    status: 400, 
                    message: `Insufficient inventory for ${product.name}` 
                };
            }

            const itemPrice = product.price.current;
            const itemTotal = itemPrice * item.quantity;
            subtotal += itemTotal;

            processedItems.push({
                productId: product._id,
                sellerId: product.sellerId,
                quantity: item.quantity,
                price: itemPrice
            });
        }

        // Calculate totals with new fee structure
        const tax = 250; // Fixed tax
        const escrowProtection = subtotal * 0.025; // 2.5% of subtotal
        const service = 50; // Fixed service fee
        const final = subtotal + tax + escrowProtection + service;

        // Create order with guest information
        const order = new MarketOrder({
            guestEmail, // Add this field to store guest email
            items: processedItems,
            status: 'pending',
            payment: {
                method: 'paystack',
                status: 'pending'
            },
            shipping: {
                address: shippingAddress
            },
            totals: {
                subtotal,
                tax,
                escrowProtection,
                service,
                final
            }
        });

        await order.save();
        return order;
    }

    async createCustomerOrder(customerId, orderData) {
        try {
            const { items, shippingDetails } = orderData; // Changed from deliveryInfo to shippingDetails

            if (!shippingDetails) {
                throw {
                    status: 400,
                    message: 'Shipping details are required'
                };
            }

            // Validate shipping details
            const { fullName, phoneNumber, address } = shippingDetails;
            if (!fullName || !phoneNumber || !address) {
                throw {
                    status: 400,
                    message: 'Missing required shipping details'
                };
            }

            // Validate address fields (zipCode is optional)
            const requiredAddressFields = ['street', 'city', 'state', 'country'];
            for (const field of requiredAddressFields) {
                if (!address[field]) {
                    throw {
                        status: 400,
                        message: `Missing address field: ${field}`
                    };
                }
            }

            // Get product details and validate inventory
            const productIds = items.map(item => item.productId);
            const products = await MarketProduct.find({ _id: { $in: productIds }, status: 'active' });
            
            let subtotal = 0;
            const processedItems = [];

            for (const item of items) {
                const product = products.find(p => p._id.toString() === item.productId);
                if (!product) {
                    throw { status: 400, message: `Product ${item.productId} not found` };
                }
                
                if (product.inventory.quantity < item.quantity) {
                    throw { 
                        status: 400, 
                        message: `Insufficient inventory for ${product.name}` 
                    };
                }

                const itemPrice = product.price.current;
                const itemTotal = itemPrice * item.quantity;
                subtotal += itemTotal;

                processedItems.push({
                    productId: product._id,
                    sellerId: product.sellerId,
                    quantity: item.quantity,
                    price: itemPrice
                });
            }

            // Calculate totals with new fee structure
            const tax = 250; // Fixed tax
            const escrowProtection = subtotal * 0.025; // 2.5% of subtotal
            const service = 50; // Fixed service fee
            const final = subtotal + tax + escrowProtection + service;

            // Create order
            const order = new MarketOrder({
                customerId,
                items: processedItems,
                status: 'pending',
                payment: {
                    method: 'paystack',
                    status: 'pending'
                },
                shipping: {
                    address: {
                        fullName: shippingDetails.fullName,
                        phoneNumber: shippingDetails.phoneNumber,
                        ...shippingDetails.address
                    },
                    method: 'standard'
                },
                totals: {
                    subtotal,
                    tax,
                    escrowProtection,
                    service,
                    final
                }
            });

            await order.save();
            
            // Populate order details
            return await MarketOrder.findById(order._id)
                .populate('items.productId')
                .populate('items.sellerId', 'businessName');
        } catch (error) {
            console.error('Order creation error:', error);
            throw {
                status: error.status || 400,
                message: error.message || 'Failed to create order'
            };
        }
    }

    async initiatePayment(orderId) {
        const order = await MarketOrder.findById(orderId);
        if (!order) {
            throw { status: 404, message: 'Order not found' };
        }

        // Initialize Paystack transaction
        try {
            const response = await axios.post(
                'https://api.paystack.co/transaction/initialize',
                {
                    amount: Math.round(order.totals.final * 100), // Convert to kobo
                    email: order.shipping.address.email || order.guestEmail,
                    reference: `ORD-${order._id}`,
                    callback_url: `${config.FRONTEND_URL}/payment/verify/${order._id}`
                },
                {
                    headers: {
                        'Authorization': `Bearer ${config.PAYSTACK_SECRET_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                order,
                paymentUrl: response.data.data.authorization_url,
                reference: response.data.data.reference
            };
        } catch (error) {
            throw { 
                status: 500, 
                message: 'Payment initialization failed',
                error: error.response?.data || error.message
            };
        }
    }

    async verifyPayment(reference) {
        try {
            console.log('Verifying payment for reference:', reference);

            // Accept either Paystack reference (e.g., ORD-<orderId>) or raw orderId
            let refToVerify = reference;
            const isObjectId = /^[a-f\d]{24}$/i.test(reference);
            if (isObjectId && !reference.startsWith('ORD-')) {
                refToVerify = `ORD-${reference}`;
            }

            // Verify with Paystack using the correct reference
            const paymentData = await paystackService.verifyTransaction(refToVerify);
            
            // Extract orderId from reference
            const orderId = refToVerify.startsWith('ORD-') ? 
                refToVerify.replace('ORD-', '') : reference;

            const order = await MarketOrder.findById(orderId);
            if (!order) {
                throw { status: 404, message: 'Order not found' };
            }

            // Map PayStack status to order status
            const transactionStatus = paystackService.getTransactionStatus(paymentData.status);
            
            // Update order based on payment status
            order.status = transactionStatus === 'completed' ? 'confirmed' : transactionStatus;
            order.payment.status = transactionStatus;
            order.payment.transactionId = paymentData.reference;
            order.payment.metadata = {
                gateway: 'paystack',
                channel: paymentData.channel,
                paidAt: paymentData.paid_at,
                cardDetails: paymentData.authorization ? {
                    last4: paymentData.authorization.last4,
                    cardType: paymentData.authorization.card_type,
                    bank: paymentData.authorization.bank
                } : null
            };

            await order.save();

            // Update inventory only if payment was successful
            if (transactionStatus === 'completed') {
                for (const item of order.items) {
                    await MarketProduct.findByIdAndUpdate(
                        item.productId,
                        {
                            $inc: {
                                'inventory.quantity': -item.quantity,
                                'metadata.sales': item.quantity
                            }
                        }
                    );
                }
            }

            return {
                success: transactionStatus === 'completed',
                order: {
                    id: order._id,
                    status: order.status,
                    payment: order.payment
                },
                transaction: {
                    reference: paymentData.reference,
                    amount: paymentData.amount / 100, // Convert from kobo to naira
                    status: transactionStatus,
                    channel: paymentData.channel,
                    paidAt: paymentData.paid_at,
                    cardDetails: order.payment.metadata.cardDetails
                }
            };

        } catch (error) {
            console.error('Payment verification error:', error);
            throw {
                status: error.status || 500,
                message: 'Payment verification failed',
                details: error.message
            };
        }
    }

    async getOrderById(orderId, guestEmail) {
        const order = await MarketOrder.findOne({ 
            _id: orderId,
            guestEmail 
        })
        .populate('items.productId')
        .populate('items.sellerId', 'businessName');

        if (!order) {
            throw { status: 404, message: 'Order not found' };
        }

        return order;
    }

    async getCustomerOrders(customerId, query = {}) {
        const { page = 1, limit = 10, status } = query;
        const skip = (page - 1) * limit;

        const filter = { customerId };
        if (status) filter.status = status;

        const [orders, total] = await Promise.all([
            MarketOrder.find(filter)
                .populate({
                    path: 'items.productId',
                    select: 'name price images'
                })
                .populate('items.sellerId', 'businessName')
                .skip(skip)
                .limit(limit)
                .sort('-createdAt'),
            MarketOrder.countDocuments(filter)
        ]);

        // Format orders response
        const formattedOrders = orders.map(order => ({
            orderId: order._id,
            orderDate: order.createdAt,
            status: order.status,
            items: order.items.map(item => ({
                product: {
                    id: item.productId._id,
                    name: item.productId.name,
                    image: item.productId.images[0]?.url,
                    price: item.price
                },
                seller: {
                    id: item.sellerId._id,
                    name: item.sellerId.businessName
                },
                quantity: item.quantity,
                total: item.price * item.quantity
            })),
            payment: {
                status: order.payment.status,
                method: order.payment.method
            },
            shipping: {
                address: order.shipping.address,
                method: order.shipping.method,
                cost: order.shipping.cost,
                tracking: order.shipping.tracking || null
            },
            totals: {
                subtotal: order.totals.subtotal,
                tax: order.totals.tax,
                escrowProtection: order.totals.escrowProtection,
                service: order.totals.service,
                shipping: order.totals.shipping,
                final: order.totals.final
            }
        }));

        return {
            orders: formattedOrders,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        };
    }

    async getGuestOrders(guestEmail, query = {}) {
        const { page = 1, limit = 10, status } = query;
        const skip = (page - 1) * limit;

        const filter = { guestEmail };
        if (status) filter.status = status;

        const [orders, total] = await Promise.all([
            MarketOrder.find(filter)
                .populate('items.productId')
                .populate('items.sellerId', 'businessName')
                .skip(skip)
                .limit(limit)
                .sort('-createdAt'),
            MarketOrder.countDocuments(filter)
        ]);

        return {
            orders,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                currentPage: page,
                limit
            }
        };
    }

    async getOrderStatus(customerId, orderId) {
        const order = await MarketOrder.findOne({ 
            _id: orderId,
            customerId
        })
        .populate('items.productId', 'name')
        .select('status shipping payment items');

        if (!order) {
            throw { status: 404, message: 'Order not found' };
        }

        return {
            orderId: order._id,
            status: order.status,
            payment: {
                status: order.payment.status,
                method: order.payment.method
            },
            delivery: {
                method: order.shipping.method,
                tracking: order.shipping.tracking || null,
                estimatedDelivery: order.shipping.estimatedDelivery,
                address: order.shipping.address
            },
            items: order.items.map(item => ({
                product: item.productId.name,
                quantity: item.quantity
            }))
        };
    }

    async confirmPickup(customerId, orderId) {
        const order = await MarketOrder.findOne({ _id: orderId, customerId });
        if (!order) {
            throw { status: 404, message: 'Order not found' };
        }
        if (order.payment.status !== 'completed') {
            throw { status: 400, message: 'Payment not completed for this order' };
        }
        if (order.status === 'delivered') {
            return { success: true, message: 'Already confirmed', data: order };
        }
        order.status = 'delivered';
        order.shipping.estimatedDelivery = new Date();
        await order.save();
        return { success: true, message: 'Pickup confirmed', data: order };
    }

    async initializeCustomerPayment(customerId, orderId) {
        try {
            const order = await MarketOrder.findOne({ 
                _id: orderId,
                customerId,
                'payment.status': 'pending'
            });

            if (!order) {
                throw { 
                    status: 404, 
                    message: 'Order not found or payment already processed' 
                };
            }

            // Get customer details
            const customer = await MarketUser.findById(customerId);
            if (!customer) {
                throw { status: 404, message: 'Customer not found' };
            }

            // Initialize Paystack transaction
            const response = await axios.post(
                'https://api.paystack.co/transaction/initialize',
                {
                    amount: Math.round(order.totals.final * 100),
                    email: customer.email, // Use customer's email from user record
                    reference: `ORD-${order._id}`,
                    metadata: {
                        order_id: order._id,
                        customer_id: customerId
                    },
                    callback_url: `${config.FRONTEND_URL}/payment/verify/${order._id}`
                },
                {
                    headers: {
                        'Authorization': `Bearer ${config.PAYSTACK_SECRET_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // Format response with order details
            return {
                payment: {
                    paymentUrl: response.data.data.authorization_url,
                    reference: response.data.data.reference,
                    amount: order.totals.final,
                    currency: 'NGN'
                },
                order: {
                    id: order._id,
                    status: order.status,
                    items: order.items.map(item => ({
                        product: item.productId,
                        quantity: item.quantity,
                        price: item.price
                    })),
                    totals: {
                        subtotal: order.totals.subtotal,
                        tax: order.totals.tax,
                        escrowProtection: order.totals.escrowProtection,
                        service: order.totals.service,
                        shipping: order.totals.shipping,
                        final: order.totals.final
                    }
                },
                customer: {
                    email: customer.email,
                    shipping: order.shipping.address
                }
            };
        } catch (error) {
            // Detailed error logging
            console.error('Payment initialization error details:', {
                message: error.message,
                response: error.response?.data,
                stack: error.stack,
                requestData: {
                    orderId,
                    customerId,
                    amount: order?.totals?.final,
                    email: customer?.email
                }
            });

            throw { 
                status: 500, 
                message: `Payment initialization failed: ${error.response?.data?.message || error.message}`,
                details: {
                    paystackError: error.response?.data,
                    serverError: error.message
                }
            };
        }
    }

    async getSellerOrders(sellerId, query = {}) {
        const { page = 1, limit = 10, status, sort = '-createdAt' } = query;
        const skip = (page - 1) * limit;

        // Build filter
        const filter = {
            'items.sellerId': sellerId
        };
        if (status) filter.status = status;

        try {
            const [orders, total] = await Promise.all([
                MarketOrder.find(filter)
                    .populate('customerId', 'email fullName')
                    .populate('items.productId', 'name images price')
                    .skip(skip)
                    .limit(limit)
                    .sort(sort),
                MarketOrder.countDocuments(filter)
            ]);

            // Format orders for seller view
            const formattedOrders = orders.map(order => {
                // Filter items to only show seller's products
                const sellerItems = order.items.filter(item => 
                    item.sellerId.toString() === sellerId.toString()
                );

                return {
                    orderId: order._id,
                    customerDetails: order.customerId ? {
                        email: order.customerId.email,
                        fullName: order.customerId.fullName
                    } : {
                        email: order.guestEmail,
                        fullName: order.shipping.address.fullName
                    },
                    items: sellerItems.map(item => ({
                        product: {
                            id: item.productId._id,
                            name: item.productId.name,
                            image: item.productId.images[0]?.url
                        },
                        quantity: item.quantity,
                        price: item.price,
                        total: item.price * item.quantity
                    })),
                    status: order.status,
                    payment: {
                        status: order.payment.status,
                        method: order.payment.method
                    },
                    shipping: {
                        address: order.shipping.address,
                        tracking: order.shipping.tracking
                    },
                    orderDate: order.createdAt
                };
            });

            return {
                orders: formattedOrders,
                pagination: {
                    total,
                    pages: Math.ceil(total / limit),
                    currentPage: parseInt(page),
                    limit: parseInt(limit)
                }
            };
        } catch (error) {
            throw {
                status: 500,
                message: 'Failed to fetch seller orders',
                error: error.message
            };
        }
    }

    async getAdminDashboardStats(timeframe = 'month') {
        const timeRanges = {
            today: new Date(new Date().setHours(0, 0, 0, 0)),
            week: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            month: new Date(new Date().setMonth(new Date().getMonth() - 1)),
            year: new Date(new Date().setFullYear(new Date().getFullYear() - 1))
        };

        const startDate = timeRanges[timeframe];

        try {
            // Get all orders count and total customers count
            const [totalOrdersCount, totalCustomers, pendingOrders] = await Promise.all([
                MarketOrder.countDocuments({}), // Get all orders
                MarketUser.countDocuments({ role: 'customer' }), // Get total customers
                MarketOrder.countDocuments({ status: 'pending' }) // Get pending orders
            ]);

            // Get overview statistics for the selected timeframe
            const overview = await MarketOrder.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                {
                    $group: {
                        _id: null,
                        totalOrders: { $sum: 1 },
                        totalRevenue: { $sum: '$totals.final' },
                        avgOrderValue: { $avg: '$totals.final' }
                    }
                }
            ]);

            // Get pending orders count by status
            const orderStats = await MarketOrder.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]);

            // Get recent orders
            const recentOrders = await MarketOrder.find()
                .sort('-createdAt')
                .limit(10)
                .select('_id customerType totals.final status createdAt');

            // Format the dashboard data
            return {
                overview: {
                    totalOrders: totalOrdersCount || 0, // Use total count instead of timeframe count
                    totalCustomers: totalCustomers || 0, // Add total customers
                    pendingOrders: pendingOrders || 0, // Add pending orders count
                    totalRevenue: overview[0]?.totalRevenue || 0,
                    avgOrderValue: overview[0]?.avgOrderValue || 0
                },
                recentOrders,
                orderStats: Object.fromEntries(
                    orderStats.map(s => [s._id, s.count])
                )
            };
        } catch (error) {
            throw {
                status: 500,
                message: 'Failed to fetch dashboard statistics',
                error: error.message
            };
        }
    }

    async getAllOrders(query = {}) {
        try {
            const { 
                page = 1, 
                limit = 10, 
                status, 
                sort = '-createdAt',
                search 
            } = query;
            
            const skip = (page - 1) * limit;

            // Build filter object
            const filter = {};
            
            if (status) {
                filter.status = status;
            }

            // Add search functionality
            if (search) {
                filter.$or = [
                    // Search by customer email (both registered and guest)
                    { 'guestEmail': { $regex: search, $options: 'i' } },
                ];

                // Only add ObjectId search if valid ObjectId
                if (mongoose.Types.ObjectId.isValid(search)) {
                    filter.$or.push({ _id: new mongoose.Types.ObjectId(search) });
                }

                // Also search in registered customer emails
                const customers = await MarketUser.find({
                    email: { $regex: search, $options: 'i' }
                }).select('_id');

                if (customers.length > 0) {
                    filter.$or.push({ 
                        customerId: { $in: customers.map(c => c._id) } 
                    });
                }
            }

            // Execute queries with error handling
            const [orders, total] = await Promise.all([
                MarketOrder.find(filter)
                    .populate('customerId', 'email fullName')
                    .populate({
                        path: 'items.productId',
                        select: 'name images price'
                    })
                    .populate('items.sellerId', 'businessName')
                    .sort(sort)
                    .skip(skip)
                    .limit(limit)
                    .lean(),  // Use lean for better performance
                MarketOrder.countDocuments(filter)
            ]).catch(err => {
                throw {
                    status: 500,
                    message: 'Database query failed',
                    details: err.message
                };
            });

            if (!orders) {
                return {
                    orders: [],
                    pagination: {
                        total: 0,
                        pages: 0,
                        currentPage: parseInt(page),
                        limit: parseInt(limit)
                    }
                };
            }

            // Format response
            const formattedOrders = orders.map(order => ({
                orderId: order._id,
                customerType: order.customerId ? 'registered' : 'guest',
                customer: order.customerId ? {
                    id: order.customerId._id,
                    email: order.customerId.email,
                    fullName: order.customerId.fullName
                } : {
                    email: order.guestEmail,
                    fullName: order.shipping?.address?.fullName
                },
                items: (order.items || []).map(item => ({
                    product: item.productId ? {
                        id: item.productId._id,
                        name: item.productId.name,
                        image: item.productId.images?.[0]?.url
                    } : null,
                    seller: item.sellerId ? {
                        id: item.sellerId._id,
                        name: item.sellerId.businessName
                    } : null,
                    quantity: item.quantity,
                    price: item.price,
                    total: item.price * item.quantity
                })),
                status: order.status,
                payment: order.payment,
                shipping: order.shipping,
                totals: order.totals,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt
            }));

            return {
                success: true,
                orders: formattedOrders,
                pagination: {
                    total,
                    pages: Math.ceil(total / limit),
                    currentPage: parseInt(page),
                    limit: parseInt(limit)
                }
            };

        } catch (error) {
            console.error('Admin orders fetch error:', error);
            throw {
                status: error.status || 500,
                message: error.message || 'Failed to fetch orders',
                details: error.details || error.stack
            };
        }
    }
}

module.exports = new OrderService();
