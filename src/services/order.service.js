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
            guestEmail,
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

        // Create individual items in the new collection
        const MarketOrderItem = require('../models/MarketOrderItem');
        const itemPromises = processedItems.map(item => {
            return new MarketOrderItem({
                orderId: order._id,
                productId: item.productId,
                sellerId: item.sellerId,
                quantity: item.quantity,
                price: item.price,
                status: 'pending'
            }).save();
        });

        await Promise.all(itemPromises);

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

            // Create individual items in the new collection
            const MarketOrderItem = require('../models/MarketOrderItem');
            const itemPromises = processedItems.map(item => {
                return new MarketOrderItem({
                    orderId: order._id,
                    productId: item.productId,
                    sellerId: item.sellerId,
                    quantity: item.quantity,
                    price: item.price,
                    status: 'pending'
                }).save();
            });

            await Promise.all(itemPromises);

            // Populate order details
            return await MarketOrder.findById(order._id)
                .populate({
                    path: 'items',
                    model: 'MarketOrderItem',
                    populate: { path: 'productId' }
                });
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
                const MarketOrderItem = require('../models/MarketOrderItem');
                const orderItems = await MarketOrderItem.find({ orderId: order._id });

                for (const item of orderItems) {
                    await MarketProduct.findByIdAndUpdate(
                        item.productId,
                        {
                            $inc: {
                                'inventory.quantity': -item.quantity,
                                'metadata.sales': item.quantity
                            }
                        }
                    );
                    // Update item status to confirmed
                    item.status = 'confirmed';
                    await item.save();
                }

                // Calculate and credit cashback based on configurable settings
                try {
                    const walletService = require('./wallet.service');
                    const RewardSettings = require('../models/RewardSettings');

                    // Get current reward settings
                    const settings = await RewardSettings.getSettings();

                    // Check if cashback is enabled
                    if (settings.cashback.enabled && settings.cashback.amount > 0) {
                        const cashbackRewards = [];

                        // Get product details to check prices against minimum purchase
                        for (const item of orderItems) {
                            const product = await MarketProduct.findById(item.productId);
                            if (product && product.price.current >= settings.cashback.minimumPurchase) {
                                cashbackRewards.push({
                                    productName: product.name,
                                    productPrice: product.price.current,
                                    cashback: settings.cashback.amount
                                });
                            }
                        }

                        // Credit total cashback if any qualifying products
                        if (cashbackRewards.length > 0 && order.customerId) {
                            const totalCashback = cashbackRewards.length * settings.cashback.amount;
                            await walletService.credit(
                                order.customerId,
                                totalCashback,
                                `Cashback reward for ${cashbackRewards.length} product(s) in order ${order._id}`,
                                {
                                    type: 'cashback',
                                    relatedOrder: order._id,
                                    metadata: {
                                        qualifyingProducts: cashbackRewards,
                                        minimumPurchase: settings.cashback.minimumPurchase
                                    }
                                }
                            );
                            console.log(chalk.green(`✓ Cashback of ₦${totalCashback} credited to customer ${order.customerId}`));
                        } else {
                            console.log(chalk.yellow(`→ No products meet minimum purchase of ₦${settings.cashback.minimumPurchase}`));
                        }
                    } else {
                        console.log(chalk.yellow('→ Cashback is disabled in settings'));
                    }
                } catch (error) {
                    console.error(chalk.yellow('⚠ Failed to credit cashback:', error.message));
                    // Don't fail payment verification if cashback fails
                }

                // Process referral bonus if eligible
                try {
                    if (order.customerId) {
                        const customer = await MarketUser.findById(order.customerId);
                        const RewardSettings = require('../models/RewardSettings');
                        const settings = await RewardSettings.getSettings();

                        if (customer && customer.referredBy && settings.referralBonus.enabled && settings.referralBonus.amount > 0) {
                            const MarketReferral = require('../models/MarketReferral');
                            const referral = await MarketReferral.findOne({
                                referredUserId: customer._id,
                                status: 'signed_up'
                            });

                            // Check if purchase meets minimum requirement
                            if (referral && order.totals.subtotal >= settings.referralBonus.minPurchase) {
                                // Check if referrer is eligible (verified if seller)
                                const referrer = await MarketUser.findById(customer.referredBy);
                                const isEligible = referrer && (
                                    referrer.role !== 'seller' ||
                                    (referrer.isVerified && referrer.adminVerified)
                                );

                                if (isEligible) {
                                    const walletService = require('./wallet.service');
                                    const result = await walletService.credit(
                                        customer.referredBy,
                                        settings.referralBonus.amount,
                                        `Referral bonus for referring ${customer.email}`,
                                        {
                                            type: 'referral_bonus',
                                            metadata: {
                                                referredUserId: customer._id,
                                                referredUserEmail: customer.email,
                                                orderId: order._id
                                            }
                                        }
                                    );

                                    referral.status = 'bonus_paid';
                                    referral.bonusAmount = settings.referralBonus.amount;
                                    referral.transactionId = result.transaction._id;
                                    referral.completionDate = new Date();
                                    await referral.save();

                                    console.log(chalk.green(`✓ Referral bonus of ₦${settings.referralBonus.amount} paid to ${referrer.email}`));
                                } else {
                                    console.log(chalk.yellow(`→ Referrer ${referrer?.email} is not eligible for bonus (unverified seller)`));
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error(chalk.yellow('⚠ Failed to process referral bonus:', error.message));
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
            guestEmail,
            'payment.status': 'completed'
        });

        if (!order) {
            throw { status: 404, message: 'Order not found' };
        }

        // Fetch items from the new collection
        const MarketOrderItem = require('../models/MarketOrderItem');
        const items = await MarketOrderItem.find({ orderId: order._id })
            .populate('productId')
            .populate('sellerId', 'businessName');

        // Cast to object and attach items
        const orderObj = order.toObject();
        orderObj.items = items;

        return orderObj;
    }

    async getCustomerOrders(customerId, query = {}) {
        // Ensure numeric pagination values even if query params come in as strings
        const page = parseInt(query.page, 10) || 1;
        const limit = parseInt(query.limit, 10) || 10;
        const { status } = query;
        const skip = (page - 1) * limit;

        const filter = { customerId, 'payment.status': 'completed' };
        if (status) filter.status = status;

        const [orders, total] = await Promise.all([
            MarketOrder.find(filter)
                .sort('-createdAt')
                .skip(skip)
                .limit(limit)
                .lean(),
            MarketOrder.countDocuments(filter)
        ]);

        const MarketOrderItem = require('../models/MarketOrderItem');

        // Format orders response and fetch items for each
        const formattedOrders = await Promise.all((orders || []).map(async (order) => {
            const shipping = order.shipping || {};
            const shippingAddress = shipping.address || {};
            const shippingTracking = shipping.tracking || null;
            const totals = order.totals || {};

            // Fetch items for this specific order
            const items = await MarketOrderItem.find({ orderId: order._id })
                .populate({
                    path: 'productId',
                    select: 'name price images'
                })
                .populate('sellerId', 'businessName')
                .lean();

            return {
                orderId: order._id,
                orderDate: order.createdAt,
                status: order.status,
                items: (items || []).map(item => {
                    const product = item.productId || {};
                    const seller = item.sellerId || {};

                    return {
                        product: {
                            id: product._id,
                            name: product.name,
                            image: Array.isArray(product.images) ? product.images[0]?.url : undefined,
                            price: item.price
                        },
                        seller: {
                            id: seller._id,
                            name: seller.businessName
                        },
                        quantity: item.quantity,
                        total: item.price * item.quantity
                    };
                }),
                payment: {
                    status: order.payment?.status,
                    method: order.payment?.method
                },
                shipping: {
                    address: shippingAddress,
                    method: shipping.method,
                    cost: shipping.cost,
                    tracking: shippingTracking
                },
                totals: {
                    subtotal: totals.subtotal ?? 0,
                    tax: totals.tax ?? 0,
                    escrowProtection: totals.escrowProtection ?? 0,
                    service: totals.service ?? 0,
                    shipping: totals.shipping ?? 0,
                    final: totals.final ?? 0
                }
            };
        }));

        return {
            orders: formattedOrders,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                currentPage: page,
                limit
            }
        };
    }

    async getGuestOrders(guestEmail, query = {}) {
        const { page = 1, limit = 10, status } = query;
        const skip = (page - 1) * limit;

        const filter = { guestEmail, 'payment.status': 'completed' };
        if (status) filter.status = status;

        const [orders, total] = await Promise.all([
            MarketOrder.find(filter)
                .skip(skip)
                .limit(limit)
                .sort('-createdAt')
                .lean(),
            MarketOrder.countDocuments(filter)
        ]);

        const MarketOrderItem = require('../models/MarketOrderItem');

        const formattedOrders = await Promise.all(orders.map(async (order) => {
            const items = await MarketOrderItem.find({ orderId: order._id })
                .populate('productId')
                .populate('sellerId', 'businessName')
                .lean();

            return {
                ...order,
                items
            };
        }));

        return {
            orders: formattedOrders,
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
        }).select('status shipping payment');

        if (!order) {
            throw { status: 404, message: 'Order not found' };
        }

        // Fetch items
        const MarketOrderItem = require('../models/MarketOrderItem');
        const items = await MarketOrderItem.find({ orderId: order._id })
            .populate('productId', 'name');

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
            items: items.map(item => ({
                product: item.productId?.name || 'Product Not Found',
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

        // Update item statuses to delivered
        const MarketOrderItem = require('../models/MarketOrderItem');
        await MarketOrderItem.updateMany(
            { orderId: order._id },
            { status: 'delivered' }
        );

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

            // Fetch items for the response
            const MarketOrderItem = require('../models/MarketOrderItem');
            const items = await MarketOrderItem.find({ orderId: order._id });

            // Initialize Paystack transaction
            const response = await axios.post(
                'https://api.paystack.co/transaction/initialize',
                {
                    amount: Math.round(order.totals.final * 100),
                    email: customer.email,
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
                    items: items.map(item => ({
                        product: item.productId,
                        quantity: item.quantity,
                        price: item.price
                    })),
                    totals: order.totals
                },
                customer: {
                    email: customer.email,
                    shipping: order.shipping.address
                }
            };
        } catch (error) {
            console.error('Payment initialization error:', error);
            throw {
                status: 500,
                message: 'Payment initialization failed',
                details: error.message
            };
        }
    }

    async getSellerOrders(sellerId, query = {}) {
        const { page = 1, limit = 10, status, sort = '-createdAt' } = query;
        const skip = (page - 1) * limit;

        // NEW LOGIC: Querying items directly for this seller
        const MarketOrderItem = require('../models/MarketOrderItem');
        const itemFilter = { sellerId };
        if (status) itemFilter.status = status;

        try {
            // Find items for this seller, populating order and product info
            const [sellerItems, total] = await Promise.all([
                MarketOrderItem.find(itemFilter)
                    .populate({
                        path: 'orderId',
                        match: { 'payment.status': 'completed' },
                        populate: { path: 'customerId', select: 'email fullName' }
                    })
                    .populate('productId', 'name images price')
                    .skip(skip)
                    .limit(limit)
                    .sort(sort)
                    .lean(),
                MarketOrderItem.countDocuments(itemFilter)
            ]);

            // Group items by order for display (while maintaining API contract)
            const formattedOrders = sellerItems
                .filter(item => item.orderId) // Only include items where order payment is completed (due to match in populate)
                .map(item => {
                    const order = item.orderId || {};
                    const product = item.productId || {};

                    return {
                        orderId: order._id,
                        orderDate: order.createdAt,
                        customerDetails: order.customerId ? {
                            email: order.customerId.email,
                            fullName: order.customerId.fullName
                        } : {
                            email: order.guestEmail,
                            fullName: order.shipping?.address?.fullName || 'Guest'
                        },
                        items: [{
                            product: {
                                id: product._id,
                                name: product.name,
                                image: Array.isArray(product.images) ? product.images[0]?.url : null
                            },
                            quantity: item.quantity,
                            price: item.price,
                            total: item.totalPrice || (item.price * item.quantity)
                        }],
                        status: order.status,
                        itemStatus: item.status,
                        payment: {
                            status: order.payment?.status || 'unknown',
                            method: order.payment?.method || 'unknown'
                        },
                        shipping: {
                            address: order.shipping?.address || {},
                            tracking: order.shipping?.tracking || null
                        }
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
            console.error('Seller orders service error:', error);
            throw {
                status: 500,
                message: 'Failed to fetch seller orders',
                details: error.message
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
                MarketOrder.countDocuments({ 'payment.status': 'completed' }), // Get all paid orders
                MarketUser.countDocuments({ role: 'customer' }), // Get total customers
                MarketOrder.countDocuments({ status: 'pending', 'payment.status': 'completed' }) // Get paid pending orders
            ]);

            // Get overview statistics for the selected timeframe
            const overview = await MarketOrder.aggregate([
                { $match: { createdAt: { $gte: startDate }, 'payment.status': 'completed' } },
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
                { $match: { 'payment.status': 'completed' } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]);

            // Get recent orders
            const recentOrders = await MarketOrder.find({ 'payment.status': 'completed' })
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
            const filter = { 'payment.status': 'completed' };
            if (status) filter.status = status;

            if (search) {
                filter.$or = [{ 'guestEmail': { $regex: search, $options: 'i' } }];
                if (mongoose.Types.ObjectId.isValid(search)) {
                    filter.$or.push({ _id: new mongoose.Types.ObjectId(search) });
                }
                const customers = await MarketUser.find({
                    email: { $regex: search, $options: 'i' }
                }).select('_id');
                if (customers.length > 0) {
                    filter.$or.push({ customerId: { $in: customers.map(c => c._id) } });
                }
            }

            const [orders, total] = await Promise.all([
                MarketOrder.find(filter)
                    .populate('customerId', 'email fullName')
                    .sort(sort)
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                MarketOrder.countDocuments(filter)
            ]);

            const MarketOrderItem = require('../models/MarketOrderItem');

            const formattedOrders = await Promise.all(orders.map(async (order) => {
                const items = await MarketOrderItem.find({ orderId: order._id })
                    .populate('productId', 'name images price')
                    .populate('sellerId', 'businessName')
                    .lean();

                return {
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
                    items: items.map(item => ({
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
                };
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
            throw { status: 500, message: 'Failed to fetch orders', details: error.message };
        }
    }
}

module.exports = new OrderService();
