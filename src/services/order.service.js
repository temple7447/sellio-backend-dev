const MarketOrder = require('../models/MarketOrder');
const MarketProduct = require('../models/MarketProduct');
const { MarketUser } = require('../models/MarketUser');  // Fix import to use destructuring
const axios = require('axios');
const config = require('../config/config');

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

        // Calculate totals
        const tax = subtotal * 0.05; // 5% tax
        const shipping = 1000; // Fixed shipping cost
        const final = subtotal + tax + shipping;

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
                address: shippingAddress,
                cost: shipping
            },
            totals: {
                subtotal,
                tax,
                shipping,
                final
            }
        });

        await order.save();
        return order;
    }

    async createCustomerOrder(customerId, orderData) {
        const { items, deliveryInfo } = orderData;

        // Validate delivery info
        const requiredFields = ['fullName', 'phoneNumber', 'street', 'city', 'state', 'country', 'zipCode', 'deliveryMethod'];
        for (const field of requiredFields) {
            if (!deliveryInfo[field]) {
                throw { 
                    status: 400, 
                    message: `Missing delivery info field: ${field}` 
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

        // Calculate shipping cost based on delivery method
        const shippingCost = deliveryInfo.deliveryMethod === 'express' ? 2000 : 1000;
        
        // Calculate totals
        const tax = subtotal * 0.05; // 5% tax
        const final = subtotal + tax + shippingCost;

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
                    fullName: deliveryInfo.fullName,
                    phoneNumber: deliveryInfo.phoneNumber,
                    street: deliveryInfo.street,
                    city: deliveryInfo.city,
                    state: deliveryInfo.state,
                    country: deliveryInfo.country,
                    zipCode: deliveryInfo.zipCode
                },
                method: deliveryInfo.deliveryMethod,
                instructions: deliveryInfo.specialInstructions,
                cost: shippingCost
            },
            totals: {
                subtotal,
                tax,
                shipping: shippingCost,
                final
            }
        });

        await order.save();
        
        // Populate order details
        return await MarketOrder.findById(order._id)
            .populate('items.productId')
            .populate('items.sellerId', 'businessName');
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

            const response = await axios.get(
                `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
                {
                    headers: {
                        'Authorization': `Bearer ${config.PAYSTACK_SECRET_KEY}`
                    }
                }
            );

            console.log('Paystack verification response:', response.data);

            const { data } = response.data;
            if (!data) {
                throw new Error('Invalid response from Paystack');
            }

            // Extract orderId from reference
            const orderId = reference.startsWith('ORD-') ? 
                reference.replace('ORD-', '') : reference;

            const order = await MarketOrder.findById(orderId);
            if (!order) {
                throw { status: 404, message: 'Order not found' };
            }

            if (data.status === 'success') {
                order.status = 'confirmed';
                order.payment.status = 'completed';
                order.payment.transactionId = reference;
                await order.save();

                // Update product inventory
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
                success: data.status === 'success',
                order,
                transaction: data
            };
        } catch (error) {
            console.error('Payment verification error details:', {
                reference,
                message: error.message,
                response: error.response?.data,
                stack: error.stack
            });

            throw { 
                status: 500, 
                message: 'Payment verification failed',
                details: {
                    paystackError: error.response?.data,
                    serverError: error.message
                }
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
}

module.exports = new OrderService();
