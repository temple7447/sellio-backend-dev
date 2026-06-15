const MarketOrder = require('../models/MarketOrder');
const MarketProduct = require('../models/MarketProduct');
const { MarketUser } = require('../models/MarketUser');  // Fix import to use destructuring
const config = require('../config/config');
const paystackService = require('../utils/paystack');
const mongoose = require('mongoose');  // Add this import at the top
const chalk = require('chalk');
const RewardSettings = require('../models/RewardSettings');
const walletService = require('./wallet.service');

const generateTrackingNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `SELLIO-${timestamp}-${randomPart}`;
};

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

            const itemPrice = product.price.current;   // buyer-facing price (with platform fee)
            const itemSellerPrice = product.price.sellerPrice ?? product.price.current; // seller earns this
            const itemTotal = itemPrice * item.quantity;
            subtotal += itemTotal;

            processedItems.push({
                productId: product._id,
                sellerId: product.sellerId,
                quantity: item.quantity,
                price: itemPrice,
                sellerPrice: itemSellerPrice,
            });
        }

        // Platform fee is already baked into product prices — total equals subtotal
        const final = subtotal;

        // Create order with guest information
        const order = new MarketOrder({
            guestEmail,
            status: 'pending',
            payment: {
                method: 'direct_transfer',
                status: 'pending'
            },
            shipping: {
                address: shippingAddress
            },
            totals: {
                subtotal,
                tax: 0,
                escrowProtection: 0,
                service: 0,
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
                sellerPrice: item.sellerPrice,
                status: 'pending'
            }).save();
        });

        await Promise.all(itemPromises);

        return order;
    }

    async createCustomerOrder(customerId, orderData) {
        try {
            const { items, shippingDetails, paymentMethod = 'direct_transfer' } = orderData;

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
                const product = products.find(p => p._id.equals(item.productId));
                if (!product) {
                    throw { status: 400, message: `Product ${item.productId} not found` };
                }

                if (product.inventory.quantity < item.quantity) {
                    throw {
                        status: 400,
                        message: `Insufficient inventory for ${product.name}`
                    };
                }

                const itemPrice = product.price.current;   // buyer-facing price (with platform fee)
                const itemSellerPrice = product.price.sellerPrice ?? product.price.current; // seller earns this
                const itemTotal = itemPrice * item.quantity;
                subtotal += itemTotal;

                processedItems.push({
                    productId: product._id,
                    sellerId: product.sellerId,
                    quantity: item.quantity,
                    price: itemPrice,
                    sellerPrice: itemSellerPrice,
                });
            }

            // Platform fee is already baked into product prices — total equals subtotal
            const final = subtotal;

            // Create order
            const order = new MarketOrder({
                customerId,
                status: 'pending',
                payment: {
                    method: paymentMethod,
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
                    tax: 0,
                    escrowProtection: 0,
                    service: 0,
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
                    sellerPrice: item.sellerPrice,
                    status: 'pending'
                }).save();
            });

            await Promise.all(itemPromises);

            // Fetch items manually instead of illegal populate
            const orderDoc = await MarketOrder.findById(order._id).lean();
            const itemsList = await MarketOrderItem.find({ orderId: order._id })
                .populate('productId')
                .populate('sellerId', 'businessName')
                .lean();

            return { ...orderDoc, items: itemsList };
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

        return {
            order,
            payment: {
                method: 'direct_transfer',
                paymentUrl: null,
                reference: `ORD-${order._id}-DT`,
                amount: order.totals.final,
                currency: 'NGN',
                bankDetails: {
                    accountName: 'Sellio Enterprise',
                    accountNumber: '8166313442',
                    bankName: 'MoniePoint MFB'
                },
                instructions: 'Please make a direct bank transfer to the account above and upload your payment proof in your order history.'
            }
        };
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
            const response = await paystackService.verifyTransaction(refToVerify);
            const paymentData = response.data;

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
                const orderItems = await MarketOrderItem.find({ orderId: order._id }).populate('productId');

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

                // Send receipt email to buyer
                try {
                    const { sendOrderReceiptEmail } = require('../utils/email');

                    // Robustly determine recipient email
                    let recipientEmail = order.shipping?.address?.email || order.guestEmail;

                    if (!recipientEmail && order.customerId) {
                        const { MarketUser } = require('../models/MarketUser');
                        const user = await MarketUser.findById(order.customerId);
                        if (user) {
                            recipientEmail = user.email;
                        }
                    }

                    if (recipientEmail) {
                        await sendOrderReceiptEmail(recipientEmail, order, orderItems);
                    } else {
                        console.warn(chalk.yellow('⚠ Could not find recipient email for order receipt:', order._id));
                    }
                } catch (error) {
                    console.error(chalk.yellow('⚠ Failed to send order receipt email:', error.message));
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

    async getOrderDetail(orderId, user) {
        const order = await MarketOrder.findById(orderId);
        if (!order) {
            throw { status: 404, message: 'Order not found' };
        }

        const MarketOrderItem = require('../models/MarketOrderItem');
        const items = await MarketOrderItem.find({ orderId: order._id })
            .populate('productId')
            .populate('sellerId', 'businessName fullName email');

        // Access Control
        let hasAccess = false;

        // 1. Admin always has access
        if (user.role === 'admin') {
            hasAccess = true;
        }
        // 2. Customer has access if it's their order
        else if (order.customerId && order.customerId.toString() === user._id.toString()) {
            hasAccess = true;
        }
        // 3. Seller has access if they are the seller of AT LEAST one item in the order
        else if (user.role === 'seller') {
            const isItemSeller = items.some(item => item.sellerId?._id.toString() === user._id.toString());
            if (isItemSeller) {
                hasAccess = true;
            }
        }

        if (!hasAccess) {
            throw { status: 403, message: 'You do not have permission to view this order' };
        }

        const orderObj = order.toObject();

        // Filter items for sellers: only show items they own
        if (user.role === 'seller') {
            const sellerItems = items.filter(item => item.sellerId?._id.toString() === user._id.toString());
            orderObj.items = sellerItems;

            // Adjust totals for seller view to reflect only their items
            const subtotal = sellerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            orderObj.totals = {
                subtotal,
                final: subtotal // For sellers, we show their portion of the total
            };
        } else {
            orderObj.items = items;
        }

        return orderObj;
    }

    async getCustomerOrders(customerId, query = {}) {
        // Ensure numeric pagination values even if query params come in as strings
        const page = parseInt(query.page, 10) || 1;
        const limit = parseInt(query.limit, 10) || 10;
        const { status, paymentStatus } = query;
        const skip = (page - 1) * limit;

        // Include all payment statuses except 'failed' and 'refunded'
        const filter = { 
            customerId,
            'payment.status': { $in: ['pending', 'pending_verification', 'processing', 'completed'] }
        };
        if (paymentStatus) {
            filter['payment.status'] = paymentStatus;
        }
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

    async uploadFulfillmentProof(sellerId, orderItemId, proofUrl) {
        const MarketOrderItem = require('../models/MarketOrderItem');
        const item = await MarketOrderItem.findOne({ _id: orderItemId, sellerId });

        if (!item) {
            throw { status: 404, message: 'Order item not found' };
        }

        if (item.status !== 'confirmed' && item.status !== 'processing') {
            throw { status: 400, message: `Cannot upload proof for item with status ${item.status}` };
        }

        // Check if payment is verified
        const paymentCheckOrder = await MarketOrder.findById(item.orderId);
        if (paymentCheckOrder && !['completed', 'processing'].includes(paymentCheckOrder.payment.status)) {
            throw { status: 400, message: 'Cannot ship item - payment is not yet verified' };
        }

        const trackingNumber = generateTrackingNumber();

        item.fulfillmentProof = proofUrl;
        item.fulfillmentDate = new Date();
        item.status = 'shipped';
        await item.save();

        const order = await MarketOrder.findById(item.orderId);
        if (order) {
            order.shipping = order.shipping || {};
            order.shipping.tracking = {
                number: trackingNumber,
                url: null
            };
            await order.save();
        }

        // Notify buyer their item has shipped
        try {
            const emailService = require('./email.service');
            const populatedItem = await require('../models/MarketOrderItem')
                .findById(item._id)
                .populate('productId', 'name')
                .lean();

            let buyerEmail, buyerName;
            if (order.customerId) {
                const buyer = await MarketUser.findById(order.customerId).select('email fullName').lean();
                buyerEmail = buyer?.email;
                buyerName = buyer?.fullName || 'Customer';
            } else {
                buyerEmail = order.guestEmail || order.shipping?.address?.email;
                buyerName = order.shipping?.address?.fullName || 'Customer';
            }

            if (buyerEmail) {
                const itemsForEmail = [{
                    productName: populatedItem?.productId?.name || 'Product',
                    quantity: item.quantity,
                    sellerName: ''
                }];
                const html = emailService.orderShipped(
                    buyerEmail,
                    buyerName,
                    order._id.toString(),
                    itemsForEmail,
                    trackingNumber
                );
                await emailService.sendEmail(buyerEmail, `📦 Your Item Has Been Shipped - Order ${order._id}`, html);
                console.log(chalk.blue(`✓ Shipped notification sent to ${buyerEmail}`));
            }
        } catch (emailError) {
            console.log(chalk.yellow(`⚠ Failed to send shipped email: ${emailError.message}`));
        }

        console.log(chalk.green(`✓ Fulfillment proof uploaded for item ${orderItemId} with tracking: ${trackingNumber}`));
        return { item, trackingNumber };
    }

    async confirmReceipt(customerId, orderId, itemProofs = {}) {
        const MarketOrderItem = require('../models/MarketOrderItem');
        let orderIdToUse = orderId;
        let fallbackItemId = null;

        let order = await MarketOrder.findOne({ _id: orderId, customerId });

        // If not found, check if orderId is actually an orderItemId
        if (!order) {
            const item = await MarketOrderItem.findOne({ _id: orderId });
            if (item) {
                order = await MarketOrder.findOne({ _id: item.orderId, customerId });
                if (order) {
                    orderIdToUse = item.orderId;
                    fallbackItemId = orderId;
                }
            }
        }

        if (!order) {
            throw { status: 404, message: 'Order not found' };
        }
        if (order.payment.status !== 'completed') {
            throw { status: 400, message: 'Payment not completed for this order' };
        }
        if (order.status === 'delivered') {
            return { success: true, message: 'Already confirmed', data: order };
        }

        const walletService = require('./wallet.service');
        const orderItems = await MarketOrderItem.find({ orderId: order._id });

        // Handle single proof shortcut from controller
        if (itemProofs && itemProofs.__single_proof) {
            const proofUrl = itemProofs.__single_proof;
            itemProofs = {};

            if (fallbackItemId) {
                // If we know it came from an item ID in the URL, apply only to that item
                itemProofs[fallbackItemId] = proofUrl;
            } else {
                // Otherwise, apply to ALL items in the order
                orderItems.forEach(item => {
                    itemProofs[item._id.toString()] = proofUrl;
                });
            }
        }

        // Update items with buyer proofs if provided
        for (const item of orderItems) {
            if (itemProofs[item._id.toString()]) {
                item.buyerProof = itemProofs[item._id.toString()];
                item.buyerConfirmationDate = new Date();
                await item.save();
            }
        }

        // Release funds to each seller in the order
        for (const item of orderItems) {
            if (item.status !== 'delivered' && item.status !== 'cancelled' && item.status !== 'disputed') {
                // Release funds when buyer confirms receipt (buyerProof is required)
                // Seller proof is optional - if buyer confirms receipt, transaction is complete
                if (!item.buyerProof) {
                    console.log(chalk.yellow(`→ Skipping fund release for item ${item._id}: Buyer proof not yet uploaded.`));
                    continue;
                }

                // Credit seller their original price (before platform fee), not the buyer-paid amount
                const sellerEarning = (item.sellerPrice ?? item.price) * item.quantity;
                await walletService.credit(
                    item.sellerId,
                    sellerEarning,
                    `Payment for order item ${item._id} (Order: ${order._id})`,
                    {
                        type: 'earning',
                        relatedOrder: order._id,
                        metadata: {
                            orderItemId: item._id,
                            productId: item.productId,
                            quantity: item.quantity,
                            buyerConfirmed: true
                        }
                    }
                );

                item.status = 'delivered';
                await item.save();
            }
        }

        // Check if all items are now delivered
        const remainingItems = await MarketOrderItem.countDocuments({
            orderId: order._id,
            status: { $ne: 'delivered' }
        });

        if (remainingItems === 0) {
            order.status = 'delivered';
            order.shipping.estimatedDelivery = new Date();
            await order.save();

            // Notify buyer their order is fully delivered
            try {
                const emailService = require('./email.service');
                const MarketOrderItem = require('../models/MarketOrderItem');
                const deliveredItems = await MarketOrderItem.find({ orderId: order._id })
                    .populate('productId', 'name')
                    .populate('sellerId', 'businessName fullName')
                    .lean();

                let buyerEmail, buyerName;
                if (order.customerId) {
                    const buyer = await MarketUser.findById(order.customerId).select('email fullName').lean();
                    buyerEmail = buyer?.email;
                    buyerName = buyer?.fullName || 'Customer';
                } else {
                    buyerEmail = order.guestEmail || order.shipping?.address?.email;
                    buyerName = order.shipping?.address?.fullName || 'Customer';
                }

                if (buyerEmail) {
                    const itemsForEmail = deliveredItems.map(i => ({
                        productName: i.productId?.name || 'Product',
                        sellerName: i.sellerId?.businessName || i.sellerId?.fullName || 'Seller'
                    }));
                    const html = emailService.orderDelivered(
                        buyerEmail,
                        buyerName,
                        order._id.toString(),
                        itemsForEmail
                    );
                    await emailService.sendEmail(buyerEmail, `✓ Order Delivered - Order ${order._id}`, html);
                    console.log(chalk.blue(`✓ Delivered notification sent to ${buyerEmail}`));
                }
            } catch (emailError) {
                console.log(chalk.yellow(`⚠ Failed to send delivered email: ${emailError.message}`));
            }
        }

        return {
            success: true,
            message: remainingItems === 0
                ? 'Receipt confirmed and all funds released'
                : 'Receipt confirmed. Funds released for items with both seller and buyer proof. Waiting for remaining proofs.',
            data: order
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

            // Fetch items for the response
            const MarketOrderItem = require('../models/MarketOrderItem');
            const items = await MarketOrderItem.find({ orderId: order._id });

            return {
                payment: {
                    method: 'direct_transfer',
                    paymentUrl: null,
                    reference: `ORD-${order._id}-DT`,
                    amount: order.totals.final,
                    currency: 'NGN',
                    bankDetails: {
                        accountName: 'Sellio Enterprise',
                        accountNumber: '8166313442',
                        bankName: 'MoniePoint MFB'
                    },
                    instructions: 'Please make a direct bank transfer to the account above and upload your payment proof in your order history.'
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

    async uploadPaymentProof(customerId, orderId, proofUrl, transferredAmount) {
        const order = await MarketOrder.findOne({
            _id: orderId,
            customerId
        });

        if (!order) {
            throw { status: 404, message: 'Order not found' };
        }

        if (order.payment.status !== 'pending') {
            throw { status: 400, message: 'Order payment is not pending' };
        }

        // Validate transferred amount if provided
        if (transferredAmount !== undefined) {
            const expectedAmount = order.totals.final;
            const difference = Math.abs(expectedAmount - transferredAmount);
            
            // Allow tolerance of up to ₦1000 difference
            if (difference > 1000) {
                throw { 
                    status: 400, 
                    message: `Transferred amount (₦${transferredAmount.toLocaleString()}) does not match order total (₦${expectedAmount.toLocaleString()}). Difference: ₦${difference.toLocaleString()}`
                };
            }
        }

        // Get customer details
        const customer = await MarketUser.findById(customerId);

        order.payment.proofUrl = proofUrl;
        order.payment.status = 'pending_verification';
        order.payment.method = 'direct_transfer';
        if (transferredAmount) {
            order.payment.transferredAmount = transferredAmount;
        }
        await order.save();

        const emailService = require('./email.service');

        // Notify customer their proof was received
        if (customer) {
            try {
                const customerHtml = emailService.paymentProofSubmitted(
                    customer.email,
                    customer.fullName || 'Customer',
                    order._id.toString(),
                    order.totals.final
                );
                await emailService.sendEmail(customer.email, 'Payment Proof Submitted - Pending Verification', customerHtml);
                console.log(chalk.blue(`✓ Payment proof submission email sent to ${customer.email}`));
            } catch (emailError) {
                console.log(chalk.yellow(`⚠ Failed to send payment proof email to customer: ${emailError.message}`));
            }
        }

        // Notify admin to review and approve/decline the proof
        if (config.ADMIN_EMAIL) {
            try {
                const adminHtml = emailService.adminPaymentProofAlert(
                    order._id.toString(),
                    customer?.fullName || 'Customer',
                    customer?.email || 'N/A',
                    order.totals.final,
                    proofUrl
                );
                await emailService.sendEmail(config.ADMIN_EMAIL, `🔔 Payment Proof Awaiting Review - Order ${order._id}`, adminHtml);
                console.log(chalk.blue(`✓ Admin notified of payment proof for order ${order._id}`));
            } catch (emailError) {
                console.log(chalk.yellow(`⚠ Failed to send payment proof alert to admin: ${emailError.message}`));
            }
        }

        return {
            success: true,
            message: 'Payment proof uploaded successfully. Your payment is now pending verification.',
            order: {
                id: order._id,
                status: order.status,
                payment: {
                    status: order.payment.status,
                    method: order.payment.method,
                    proofUrl: order.payment.proofUrl
                }
            }
        };
    }

    async adminVerifyPayment(orderId, status, adminId) {
        const order = await MarketOrder.findById(orderId);

        if (!order) {
            throw { status: 404, message: 'Order not found' };
        }

        if (order.payment.method !== 'direct_transfer') {
            throw { status: 400, message: 'This order was not paid via direct transfer' };
        }

        if (order.payment.status !== 'pending_verification') {
            throw { status: 400, message: 'This order is not pending verification' };
        }

        const expectedAmount = order.totals.final;
        const transferredAmount = order.payment.transferredAmount || expectedAmount;
        const amountDifference = expectedAmount - transferredAmount;
        
        // Check if transferred amount is within acceptable range (tolerance of ₦1000)
        const isWithinTolerance = amountDifference >= 0 && amountDifference <= 1000;

        if (status === 'approved') {
            // Handle partial payment case
            if (transferredAmount < expectedAmount && isWithinTolerance) {
                // Refund the difference to buyer's wallet (after deducting ₦100 fee)
                const processingFee = 100;
                const refundAmount = amountDifference - processingFee;
                const customer = await MarketUser.findById(order.customerId);
                
                if (customer && refundAmount > 0) {
                    await walletService.credit(
                        customer._id,
                        refundAmount,
                        `Refund: Overpayment for order ${order._id} (Fee: ₦${processingFee})`,
                        {
                            type: 'refund',
                            orderId: order._id,
                            originalAmount: expectedAmount,
                            transferredAmount: transferredAmount,
                            refundedAmount: refundAmount,
                            processingFee: processingFee
                        }
                    );
                    
                    console.log(chalk.blue(`✓ Refunded ₦${refundAmount.toLocaleString()} to buyer for overpayment (Fee: ₦${processingFee})`));
                    
                    // Update order totals to reflect actual amount received
                    order.totals.final = transferredAmount;
                    order.payment.refundedAmount = refundAmount;
                    order.payment.processingFee = processingFee;
                    
                    // Send refund email
                    try {
                        const emailService = require('./email.service');
                        const emailHtml = emailService.walletCredited(
                            customer.email,
                            customer.fullName || 'Customer',
                            refundAmount,
                            `Refund for order ${order._id}`
                        );
                        await emailService.sendEmail(customer.email, '💰 Refund Processed - Wallet Credited', emailHtml);
                    } catch (emailError) {
                        console.log(chalk.yellow(`⚠ Failed to send refund email: ${emailError.message}`));
                    }
                }
            }

            order.payment.status = 'completed';
            order.payment.receivedAmount = transferredAmount;
            order.status = 'processing';
            await order.save();

            // Update order items status
            const MarketOrderItem = require('../models/MarketOrderItem');
            await MarketOrderItem.updateMany(
                { orderId: order._id, status: 'pending' },
                { status: 'processing' }
            );

            // Get customer details for email
            const customer = await MarketUser.findById(order.customerId);

            const emailService = require('./email.service');

            // Notify customer that payment is verified
            if (customer) {
                try {
                    const customerHtml = emailService.paymentVerified(
                        customer.email,
                        customer.fullName || 'Customer',
                        order._id.toString(),
                        order.totals.final
                    );
                    await emailService.sendEmail(customer.email, '✅ Payment Verified - Order Confirmed!', customerHtml);
                    console.log(chalk.blue(`✓ Payment verification email sent to ${customer.email}`));
                } catch (emailError) {
                    console.log(chalk.yellow(`⚠ Failed to send payment verification email to customer: ${emailError.message}`));
                }
            }

            // Notify each seller that they have a new confirmed order to fulfill
            try {
                const orderItems = await MarketOrderItem.find({ orderId: order._id })
                    .populate('productId', 'name sku')
                    .populate('sellerId', 'email fullName businessName')
                    .lean();

                const sellerMap = new Map();
                for (const item of orderItems) {
                    const seller = item.sellerId;
                    if (!seller) continue;
                    const key = seller._id.toString();
                    if (!sellerMap.has(key)) sellerMap.set(key, { seller, items: [] });
                    sellerMap.get(key).items.push({
                        productName: item.productId?.name || 'Product',
                        sku: item.productId?.sku || null,
                        quantity: item.quantity,
                        price: item.price
                    });
                }

                const buyerName = customer?.fullName || 'A customer';
                for (const { seller, items } of sellerMap.values()) {
                    try {
                        const sellerSubtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
                        const sellerHtml = emailService.sellerNewOrder(
                            seller.email,
                            seller.businessName || seller.fullName || 'Seller',
                            order._id.toString(),
                            items,
                            sellerSubtotal,
                            buyerName
                        );
                        await emailService.sendEmail(seller.email, `🎉 New Order Confirmed - Order ${order._id}`, sellerHtml);
                        console.log(chalk.blue(`✓ Seller ${seller.email} notified of new order`));
                    } catch (err) {
                        console.log(chalk.yellow(`⚠ Failed to notify seller ${seller.email}: ${err.message}`));
                    }
                }
            } catch (sellerEmailError) {
                console.log(chalk.yellow(`⚠ Failed to send seller notifications: ${sellerEmailError.message}`));
            }

            return {
                success: true,
                message: amountDifference > 0 && amountDifference <= 1000 
                    ? `Payment verified. ₦${amountDifference.toLocaleString()} refund credited to buyer wallet.`
                    : 'Payment verified successfully. Order is now being processed.',
                amountInfo: {
                    expected: expectedAmount,
                    transferred: transferredAmount,
                    refunded: amountDifference > 0 && amountDifference <= 1000 ? amountDifference : 0,
                    finalAmount: order.totals.final
                },
                order: {
                    id: order._id,
                    status: order.status,
                    totals: order.totals,
                    payment: {
                        status: order.payment.status,
                        method: order.payment.method,
                        receivedAmount: order.payment.receivedAmount,
                        refundedAmount: order.payment.refundedAmount,
                        verifiedAt: new Date(),
                        verifiedBy: adminId
                    }
                }
            };
        } else {
            order.payment.status = 'failed';
            order.payment.proofUrl = null;
            order.payment.transferredAmount = null;
            await order.save();

            // Notify customer that their payment proof was rejected
            try {
                const emailService = require('./email.service');
                let buyerEmail, buyerName;
                if (customer) {
                    buyerEmail = customer.email;
                    buyerName = customer.fullName || 'Customer';
                } else {
                    buyerEmail = order.guestEmail || order.shipping?.address?.email;
                    buyerName = order.shipping?.address?.name || 'Customer';
                }
                if (buyerEmail) {
                    const html = emailService.paymentProofRejected(buyerEmail, buyerName, order._id.toString());
                    await emailService.sendEmail(buyerEmail, '⚠ Payment Proof Rejected - Action Required', html);
                    console.log(chalk.blue(`✓ Payment rejection email sent to ${buyerEmail}`));
                }
            } catch (emailError) {
                console.log(chalk.yellow(`⚠ Failed to send payment rejection email: ${emailError.message}`));
            }

            return {
                success: true,
                message: 'Payment rejected. Customer needs to upload a new payment proof.',
                amountInfo: {
                    expected: expectedAmount,
                    transferred: transferredAmount,
                    match: false
                },
                order: {
                    id: order._id,
                    status: order.status,
                    payment: {
                        status: order.payment.status,
                        method: order.payment.method
                    }
                }
            };
        }
    }

    /**
     * Admin: Cancel order and refund buyer (for underpayment cases)
     */
    async adminCancelAndRefund(orderId, adminId, refundAmount = null) {
        const order = await MarketOrder.findById(orderId);

        if (!order) {
            throw { status: 404, message: 'Order not found' };
        }

        if (order.payment.method !== 'direct_transfer') {
            throw { status: 400, message: 'This order was not paid via direct transfer' };
        }

        if (order.payment.status !== 'pending_verification') {
            throw { status: 400, message: 'This order cannot be cancelled' };
        }

        const transferredAmount = order.payment.transferredAmount || 0;
        const adminInputAmount = refundAmount;
        
        // Admin must provide the amount they want to refund
        if (!adminInputAmount || adminInputAmount <= 0) {
            throw { status: 400, message: 'Please provide the amount to refund' };
        }

        // Deduct ₦100 processing fee
        const processingFee = 100;
        const refundToBuyer = adminInputAmount - processingFee;
        
        if (refundToBuyer <= 0) {
            throw { status: 400, message: 'Refund amount must be greater than ₦100' };
        }

        // Refund to buyer's wallet
        if (refundToBuyer > 0) {
            const customer = await MarketUser.findById(order.customerId);
            
            if (customer) {
                await walletService.credit(
                    customer._id,
                    refundToBuyer,
                    `Refund: Order cancelled - Order ${order._id} (Admin confirmed: ₦${adminInputAmount.toLocaleString()}, Fee: ₦${processingFee})`,
                    {
                        type: 'refund',
                        orderId: order._id,
                        reason: 'underpayment_cancelled',
                        adminInputAmount,
                        processingFee,
                        refundToBuyer
                    }
                );
                
                console.log(chalk.blue(`✓ Refunded ₦${refundToBuyer.toLocaleString()} to buyer (Admin: ₦${adminInputAmount.toLocaleString()}, Fee: ₦${processingFee})`));
                
                // Send refund email
                try {
                    const emailService = require('./email.service');
                    const emailHtml = emailService.walletCredited(
                        customer.email,
                        customer.fullName || 'Customer',
                        refundToBuyer,
                        `Order cancelled - Refund for order ${order._id}`
                    );
                    await emailService.sendEmail(customer.email, '💰 Order Cancelled - Refund Processed', emailHtml);
                } catch (emailError) {
                    console.log(chalk.yellow(`⚠ Failed to send refund email: ${emailError.message}`));
                }
            }
        }

        // Restore product inventory
        const MarketOrderItem = require('../models/MarketOrderItem');
        const orderItems = await MarketOrderItem.find({ orderId: order._id });
        
        const MarketProduct = require('../models/MarketProduct');
        for (const item of orderItems) {
            await MarketProduct.updateOne(
                { _id: item.productId },
                { $inc: { 'inventory.quantity': item.quantity } }
            );
        }

        // Update order status
        order.status = 'cancelled';
        order.payment.status = 'refunded';
        order.payment.refundedAmount = refundToBuyer;
        order.payment.adminInputAmount = adminInputAmount;
        order.payment.processingFee = processingFee;
        order.payment.cancelledBy = adminId;
        order.payment.cancelledAt = new Date();
        await order.save();

        return {
            success: true,
            message: `Order cancelled. ₦${transferredAmount.toLocaleString()} refunded to buyer's wallet.`,
            order: {
                id: order._id,
                status: order.status,
                payment: {
                    status: order.payment.status,
                    refundedAmount: transferredAmount
                }
            }
        };
    }

    async adminCancelUnpaidOrder(orderId, adminId, reason = 'Payment not received') {
        const order = await MarketOrder.findById(orderId);

        if (!order) {
            throw { status: 404, message: 'Order not found' };
        }

        if (order.payment.status !== 'pending') {
            throw {
                status: 400,
                message: `Cannot cancel this order. Payment status is "${order.payment.status}". Use the refund endpoint for orders with uploaded proof.`
            };
        }

        // Restore product inventory
        const MarketOrderItem = require('../models/MarketOrderItem');
        const orderItems = await MarketOrderItem.find({ orderId: order._id });

        for (const item of orderItems) {
            await MarketProduct.updateOne(
                { _id: item.productId },
                { $inc: { 'inventory.quantity': item.quantity } }
            );
        }

        // Cancel all order items
        await MarketOrderItem.updateMany(
            { orderId: order._id },
            { status: 'cancelled', cancellationReason: reason, cancelledBy: 'admin' }
        );

        // Cancel the order
        order.status = 'cancelled';
        order.payment.status = 'failed';
        order.cancellationReason = reason;
        order.cancelledBy = 'admin';
        await order.save();

        // Notify buyer
        if (order.customerId) {
            try {
                const customer = await MarketUser.findById(order.customerId);
                if (customer) {
                    const emailService = require('./email.service');
                    const html = emailService.orderCancelled(
                        customer.email,
                        customer.fullName || 'Customer',
                        order._id.toString(),
                        reason,
                        0
                    );
                    await emailService.sendEmail(customer.email, `Order Cancelled - Order ${order._id}`, html);
                }
            } catch (emailError) {
                console.log(chalk.yellow(`⚠ Failed to send cancellation email: ${emailError.message}`));
            }
        }

        return {
            success: true,
            message: 'Order cancelled successfully. No payment was made so no refund is required.',
            order: {
                id: order._id,
                status: order.status,
                payment: { status: order.payment.status },
                cancellationReason: reason
            }
        };
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
            // Only show orders where payment is completed or processing
            const [sellerItems, total] = await Promise.all([
                MarketOrderItem.find(itemFilter)
                    .populate({
                        path: 'orderId',
                        match: { 'payment.status': { $in: ['processing', 'completed'] } },
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
                .filter(item => item.orderId) // Only include items where order payment is completed/processing
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
                            price: item.sellerPrice ?? item.price,
                            total: (item.sellerPrice ?? item.price) * item.quantity
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
                paymentStatus,
                sort = '-createdAt',
                search
            } = query;

            const skip = (page - 1) * limit;
            // Include all payment statuses except 'failed' and 'refunded'
            const filter = {
                'payment.status': paymentStatus
                    ? paymentStatus
                    : { $in: ['pending', 'pending_verification', 'processing', 'completed'] }
            };
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

    async payWithWallet(customerId, orderId) {
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

            // Deduct from wallet
            const walletService = require('./wallet.service');
            const amount = order.totals.final;

            const debitResult = await walletService.debit(
                customerId,
                amount,
                `Payment for order ${order._id}`,
                {
                    type: 'payment',
                    status: 'completed',
                    paymentGateway: 'wallet',
                    relatedOrder: order._id
                }
            );

            // Complete fulfillment logic
            await this._completeOrderFulfillment(order, {
                gateway: 'wallet',
                transactionId: debitResult.transaction.reference,
                channel: 'wallet',
                paidAt: new Date(),
                metadata: {
                    transactionId: debitResult.transaction._id
                }
            });

            return {
                success: true,
                message: 'Payment completed successfully using wallet',
                order: {
                    id: order._id,
                    status: order.status,
                    payment: order.payment
                },
                wallet: {
                    balanceAfter: debitResult.balanceAfter,
                    transactionId: debitResult.transaction._id
                }
            };
        } catch (error) {
            console.error(chalk.red('✗ Wallet payment failed:'), error);
            throw {
                status: error.status || 500,
                message: error.message || 'Wallet payment failed',
                available: error.available,
                required: error.required
            };
        }
    }

    /**
     * Shared fulfillment logic to be run after any successful payment
     * @private
     */
    async _completeOrderFulfillment(order, paymentInfo) {
        // Update order status and payment details
        order.status = 'confirmed';
        order.payment.status = 'completed';
        order.payment.method = paymentInfo.gateway;
        order.payment.transactionId = paymentInfo.transactionId;
        order.payment.metadata = {
            gateway: paymentInfo.gateway,
            channel: paymentInfo.channel,
            paidAt: paymentInfo.paidAt || new Date(),
            ...paymentInfo.metadata
        };

        await order.save();

        // Update inventory and item statuses
        const MarketOrderItem = require('../models/MarketOrderItem');
        const orderItems = await MarketOrderItem.find({ orderId: order._id }).populate('productId');

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

        // Send receipt email to buyer
        try {
            const { sendOrderReceiptEmail } = require('../utils/email');

            // Robustly determine recipient email
            let recipientEmail = order.shipping?.address?.email || order.guestEmail;

            if (!recipientEmail && order.customerId) {
                const { MarketUser } = require('../models/MarketUser');
                const user = await MarketUser.findById(order.customerId);
                if (user) {
                    recipientEmail = user.email;
                }
            }

            if (recipientEmail) {
                await sendOrderReceiptEmail(recipientEmail, order, orderItems);
            } else {
                console.warn(chalk.yellow('⚠ Could not find recipient email for order receipt:', order._id));
            }
        } catch (error) {
            console.error(chalk.yellow('⚠ Failed to send order receipt email:', error.message));
        }

        // Notify each seller of the new confirmed order
        try {
            const emailService = require('./email.service');
            const sellerItems = await MarketOrderItem.find({ orderId: order._id })
                .populate('productId', 'name sku')
                .populate('sellerId', 'email fullName businessName')
                .lean();

            const sellerMap = new Map();
            for (const item of sellerItems) {
                const seller = item.sellerId;
                if (!seller) continue;
                const key = seller._id.toString();
                if (!sellerMap.has(key)) sellerMap.set(key, { seller, items: [] });
                sellerMap.get(key).items.push({
                    productName: item.productId?.name || 'Product',
                    sku: item.productId?.sku || null,
                    quantity: item.quantity,
                    price: item.price
                });
            }

            const buyerName = order.customerId
                ? (await require('../models/MarketUser').MarketUser.findById(order.customerId).select('fullName').lean())?.fullName || 'A customer'
                : order.shipping?.address?.name || 'A customer';

            for (const { seller, items } of sellerMap.values()) {
                try {
                    const sellerSubtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
                    const sellerHtml = emailService.sellerNewOrder(
                        seller.email,
                        seller.businessName || seller.fullName || 'Seller',
                        order._id.toString(),
                        items,
                        sellerSubtotal,
                        buyerName
                    );
                    await emailService.sendEmail(seller.email, `🎉 New Order Confirmed - Order ${order._id}`, sellerHtml);
                    console.log(chalk.blue(`✓ Seller ${seller.email} notified of new order`));
                } catch (err) {
                    console.log(chalk.yellow(`⚠ Failed to notify seller ${seller.email}: ${err.message}`));
                }
            }
        } catch (sellerEmailError) {
            console.log(chalk.yellow(`⚠ Failed to send seller notifications: ${sellerEmailError.message}`));
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
                        `Cashback for order ${order._id}`,
                        {
                            type: 'cashback',
                            relatedOrder: order._id,
                            metadata: { items: cashbackRewards }
                        }
                    );
                }
            }
        } catch (error) {
            console.error(chalk.yellow('⚠ Failed to process cashback bonus:', error.message));
        }

        // Process referral bonus for the buyer's referrer
        try {
            const { MarketUser } = require('../models/MarketUser');
            const walletService = require('./wallet.service');
            const RewardSettings = require('../models/RewardSettings');

            const settings = await RewardSettings.getSettings();

            if (settings.referralBonus.enabled && order.customerId) {
                const customer = await MarketUser.findById(order.customerId);
                if (customer && customer.referredBy) {
                    const Referral = require('../models/Referral');
                    const referral = await Referral.findOne({
                        referredUserId: customer._id,
                        referrerId: customer.referredBy,
                        status: 'pending'
                    });

                    if (referral) {
                        const referrer = await MarketUser.findById(customer.referredBy);
                        if (referrer) {
                            // Only verified sellers get referral bonuses in this system (adjust if needed)
                            if (referrer.role === 'seller' && referrer.isVerified) {
                                const result = await walletService.credit(
                                    referrer._id,
                                    settings.referralBonus.amount,
                                    `Referral bonus for ${customer.fullName}'s purchase`,
                                    {
                                        type: 'referral_bonus',
                                        relatedOrder: order._id,
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
            }
        } catch (error) {
            console.error(chalk.yellow('⚠ Failed to process referral bonus:', error.message));
        }
    }

    /**
     * Cancel a specific order item
     * @param {string} userId - ID of the user performing the cancellation (Customer or Seller)
     * @param {string} orderItemId - ID of the item to cancel
     * @param {string} reason - Reason for cancellation
     * @param {string} role - 'customer' or 'seller'
     */
    async cancelOrderItem(userId, orderItemId, reason, role) {
        const MarketOrderItem = require('../models/MarketOrderItem');
        const walletService = require('./wallet.service');

        const item = await MarketOrderItem.findById(orderItemId);
        if (!item) {
            throw { status: 404, message: 'Order item not found' };
        }

        const order = await MarketOrder.findById(item.orderId);
        if (!order) {
            throw { status: 404, message: 'Parent order not found' };
        }

        // Authorization check
        if (role === 'customer') {
            if (order.customerId.toString() !== userId.toString()) {
                throw { status: 403, message: 'You are not authorized to cancel this item' };
            }
        } else if (role === 'seller') {
            if (item.sellerId.toString() !== userId.toString()) {
                throw { status: 403, message: 'You are not authorized to cancel this item' };
            }
        }

        // Status check
        if (['shipped', 'delivered', 'cancelled', 'refunded'].includes(item.status)) {
            throw { status: 400, message: `Cannot cancel item with status: ${item.status}` };
        }

        // Additional security check: If buyer has already provided proof of receipt, they cannot cancel
        if (role === 'customer' && item.buyerProof) {
            throw { status: 400, message: 'Cannot cancel item after you have confirmed receipt' };
        }

        // 1. Refund the buyer if order was paid
        if (order.payment.status === 'completed') {
            console.log(chalk.blue(`→ Refunding customer (${order.customerId}) for cancelled item ${item._id}`));
            await walletService.credit(
                order.customerId,
                item.totalPrice,
                `Refund for cancelled item: ${item._id} (Order: ${order._id})`,
                {
                    type: 'refund',
                    relatedOrder: order._id,
                    metadata: {
                        orderItemId: item._id,
                        reason,
                        cancelledBy: role
                    }
                }
            );
        }

        // 2. Restock inventory
        await MarketProduct.findByIdAndUpdate(
            item.productId,
            {
                $inc: {
                    'inventory.quantity': item.quantity,
                    'metadata.sales': -item.quantity
                }
            }
        );

        // 3. Update item status
        item.status = 'cancelled';
        item.cancellationReason = reason;
        item.cancelledBy = role;
        await item.save();

        // 4. Check if all items in the order are now cancelled
        const activeItemsCount = await MarketOrderItem.countDocuments({
            orderId: order._id,
            status: { $ne: 'cancelled' }
        });

        if (activeItemsCount === 0) {
            // IF THIS WAS THE LAST ITEM, refund any remaining bits of the order total (fees, shipping etc)
            if (order.payment.status === 'completed') {
                const WalletTransaction = require('../models/WalletTransaction');
                const previousRefunds = await WalletTransaction.find({
                    relatedOrder: order._id,
                    type: 'refund'
                });

                const totalRefunded = previousRefunds.reduce((sum, tx) => sum + tx.amount, 0);
                const remainder = order.totals.final - totalRefunded;

                if (remainder > 1) { // Use 1 to avoid tiny floating point dust
                    console.log(chalk.blue(`→ Refunding remaining fees (${remainder}) for fully cancelled order ${order._id}`));
                    await walletService.credit(
                        order.customerId,
                        remainder,
                        `Final refund (fees/shipping) for fully cancelled order: ${order._id}`,
                        {
                            type: 'refund',
                            relatedOrder: order._id,
                            metadata: {
                                reason: 'Order fully cancelled',
                                cancelledBy: role
                            }
                        }
                    );
                }
            }

            order.status = 'cancelled';
            order.cancellationReason = reason;
            order.cancelledBy = role;
            await order.save();
        }

        console.log(chalk.green(`✓ Item ${item._id} cancelled by ${role}. Reason: ${reason}`));

        // Notify the other party about the cancellation
        try {
            const emailService = require('./email.service');
            const productDoc = await MarketProduct.findById(item.productId).select('name').lean();
            const productName = productDoc?.name || 'Product';

            if (role === 'customer') {
                // Notify seller
                const seller = await MarketUser.findById(item.sellerId).select('email fullName businessName').lean();
                if (seller?.email) {
                    const html = emailService.orderItemCancelled(seller.email, seller.businessName || seller.fullName || 'Seller', order._id.toString(), productName, reason, 'customer');
                    await emailService.sendEmail(seller.email, `Order Item Cancelled - Order #${order._id}`, html);
                    console.log(chalk.blue(`✓ Seller ${seller.email} notified of item cancellation`));
                }
            } else if (role === 'seller') {
                // Notify buyer
                let buyerEmail, buyerName;
                if (order.customerId) {
                    const buyer = await MarketUser.findById(order.customerId).select('email fullName').lean();
                    buyerEmail = buyer?.email;
                    buyerName = buyer?.fullName || 'Customer';
                } else {
                    buyerEmail = order.guestEmail || order.shipping?.address?.email;
                    buyerName = order.shipping?.address?.name || 'Customer';
                }
                if (buyerEmail) {
                    const html = emailService.orderItemCancelled(buyerEmail, buyerName, order._id.toString(), productName, reason, 'seller');
                    await emailService.sendEmail(buyerEmail, `Order Item Cancelled - Order #${order._id}`, html);
                    console.log(chalk.blue(`✓ Buyer ${buyerEmail} notified of item cancellation`));
                }
            }
        } catch (emailError) {
            console.log(chalk.yellow(`⚠ Failed to send cancellation notification: ${emailError.message}`));
        }

        return {
            success: true,
            message: 'Item cancelled and refund processed',
            itemStatus: item.status,
            orderStatus: order.status
        };
    }

    /**
     * Cancel an entire order (Customer only)
     */
    async cancelOrder(customerId, orderId, reason) {
        const order = await MarketOrder.findOne({ _id: orderId, customerId });
        if (!order) {
            throw { status: 404, message: 'Order not found' };
        }

        if (order.status === 'cancelled') {
            return { success: true, message: 'Order is already cancelled' };
        }

        const MarketOrderItem = require('../models/MarketOrderItem');
        const items = await MarketOrderItem.find({ orderId: order._id });

        const results = [];
        for (const item of items) {
            if (!['shipped', 'delivered', 'cancelled', 'refunded'].includes(item.status)) {
                try {
                    const result = await this.cancelOrderItem(customerId, item._id, reason, 'customer');
                    results.push({ itemId: item._id, status: 'success', detail: result });
                } catch (error) {
                    results.push({ itemId: item._id, status: 'failed', error: error.message });
                }
            } else {
                results.push({ itemId: item._id, status: 'skipped', message: `Item is already ${item.status}` });
            }
        }

        // Final status sync
        const remainingActive = await MarketOrderItem.countDocuments({
            orderId: order._id,
            status: { $ne: 'cancelled' }
        });

        if (remainingActive === 0) {
            order.status = 'cancelled';
            order.cancellationReason = reason;
            order.cancelledBy = 'customer';
            await order.save();
        }

        const successCount = results.filter(r => r.status === 'success').length;
        if (successCount === 0) {
            const lastError = results.find(r => r.status === 'failed')?.error || 'No items were eligible for cancellation';
            throw { status: 400, message: lastError, results };
        }

        return {
            success: true,
            message: `Successfully cancelled ${successCount} item(s)`,
            results,
            orderStatus: order.status
        };
    }

    /**
     * File a complaint for an order or specific item
     */
    async fileComplaint(userId, complaintData, files = []) {
        const MarketOrderComplain = require('../models/MarketOrderComplain');
        const MarketOrderItem = require('../models/MarketOrderItem');
        const { uploadToCloudinary } = require('../utils/cloudinary');

        const { orderId, orderItemId, subject, complaint, role } = complaintData;

        // 1. Basic Validation
        const order = await MarketOrder.findById(orderId);
        if (!order) {
            throw { status: 404, message: 'Order not found' };
        }

        // 2. Role-based Authorization
        if (role === 'customer') {
            if (order.customerId?.toString() !== userId.toString()) {
                throw { status: 403, message: 'You are not authorized to file a complaint for this order' };
            }
        } else if (role === 'seller') {
            // Check if user is a seller for any item in this order
            const items = await MarketOrderItem.find({ orderId: order._id, sellerId: userId });
            if (items.length === 0) {
                throw { status: 403, message: 'You are not authorized to file a complaint for this order' };
            }
        } else if (role !== 'admin') {
            throw { status: 400, message: 'Invalid role for complaint' };
        }

        // 3. Handle image uploads
        const imagePromises = files.map(file => uploadToCloudinary(file, 'order_complaints'));
        const uploadResults = await Promise.all(imagePromises);
        const imageUrls = uploadResults.map(res => res.secure_url);

        // 4. Create Complaint
        const newComplaint = new MarketOrderComplain({
            orderId,
            orderItemId,
            userId,
            role,
            subject,
            complaint,
            images: imageUrls,
            status: 'pending'
        });

        await newComplaint.save();

        // 5. Update Status to 'disputed'
        if (orderItemId) {
            await MarketOrderItem.findByIdAndUpdate(orderItemId, { status: 'disputed' });
        } else {
            // If it's a general order complaint, mark the whole order
            order.status = 'disputed';
            await order.save();
        }

        console.log(chalk.green(`✓ Complaint filed for order ${orderId} by ${role} ${userId}. Status set to 'disputed'.`));

        return {
            success: true,
            message: 'Complaint filed successfully. The affected items are now marked as "disputed".',
            data: newComplaint
        };
    }

    /**
     * Resolve a filed complaint
     * @param {string} adminId - ID of the admin resolving the complaint
     * @param {string} complaintId - ID of the complaint record
     * @param {string} decision - 'refund_customer', 'release_to_seller', or 'dismiss'
     * @param {string} resolutionText - Additional details from the admin
     */
    async resolveComplaint(adminId, complaintId, decision, resolutionText) {
        const MarketOrderComplain = require('../models/MarketOrderComplain');
        const MarketOrderItem = require('../models/MarketOrderItem');
        const walletService = require('./wallet.service');

        const complaint = await MarketOrderComplain.findById(complaintId);
        if (!complaint) {
            throw { status: 404, message: 'Complaint not found' };
        }

        if (complaint.status !== 'pending' && complaint.status !== 'in-review') {
            throw { status: 400, message: `Complaint is already ${complaint.status}` };
        }

        const order = await MarketOrder.findById(complaint.orderId);
        const item = complaint.orderItemId ? await MarketOrderItem.findById(complaint.orderItemId) : null;

        // Process Decision
        if (decision === 'refund_customer') {
            // Case 1: Refund for specific item
            if (item) {
                if (order.payment.status === 'completed') {
                    await walletService.credit(
                        complaint.userId, // This assumes user who complained IS the customer if it's a refund
                        item.totalPrice,
                        `Refund for resolved dispute: ${complaintId}`,
                        { type: 'refund', relatedOrder: order._id, metadata: { complaintId } }
                    );
                }
                item.status = 'refunded';
                await item.save();
            } else {
                // Case 2: Refund for whole order
                if (order.payment.status === 'completed') {
                    await walletService.credit(
                        order.customerId,
                        order.totals.final,
                        `Full Order Refund for resolved dispute: ${complaintId}`,
                        { type: 'refund', relatedOrder: order._id, metadata: { complaintId } }
                    );
                }
                order.status = 'cancelled';
                await order.save();
                // Also mark items as cancelled/refunded
                await MarketOrderItem.updateMany({ orderId: order._id }, { status: 'refunded' });
            }
        } else if (decision === 'release_to_seller') {
            // Case: Release funds to seller — always credit seller's original price, not buyer-paid amount
            if (item) {
                const sellerEarning = (item.sellerPrice ?? item.price) * item.quantity;
                await walletService.credit(
                    item.sellerId,
                    sellerEarning,
                    `Payment released after dispute resolution: ${complaintId}`,
                    { type: 'earning', relatedOrder: order._id, metadata: { complaintId } }
                );
                item.status = 'delivered';
                await item.save();
            } else {
                // If whole order release (unlikely but possible), credit all items
                const orderItems = await MarketOrderItem.find({ orderId: order._id });
                for (const oi of orderItems) {
                    if (oi.status === 'disputed') {
                        const oiSellerEarning = (oi.sellerPrice ?? oi.price) * oi.quantity;
                        await walletService.credit(
                            oi.sellerId,
                            oiSellerEarning,
                            `Payment released after dispute resolution: ${complaintId}`,
                            { type: 'earning', relatedOrder: order._id, metadata: { complaintId } }
                        );
                        oi.status = 'delivered';
                        await oi.save();
                    }
                }
                order.status = 'delivered';
                await order.save();
            }
        } else if (decision === 'dismiss') {
            // Dismiss means complaint is invalid - no financial action, no status change
            // Just mark the complaint as resolved and keep everything as is
            console.log(chalk.yellow(`→ Complaint dismissed. No funds released. Order/item status unchanged.`));
        } else {
            throw { status: 400, message: 'Invalid resolution decision' };
        }

        // Final Status Sync - only for decisions that should change status
        if (order && decision !== 'dismiss') {
            const activeItems = await MarketOrderItem.countDocuments({
                orderId: order._id,
                status: { $nin: ['delivered', 'cancelled', 'refunded'] }
            });
            if (activeItems === 0 && order.status === 'disputed') {
                order.status = 'delivered';
                await order.save();
            }
        }

        // Update Complaint Document
        complaint.status = 'resolved';
        complaint.resolution = resolutionText;
        complaint.resolvedBy = adminId;
        complaint.resolvedAt = new Date();
        await complaint.save();

        console.log(chalk.green(`✓ Dispute ${complaintId} resolved by admin ${adminId}. Decision: ${decision}`));

        return {
            success: true,
            message: `Dispute resolved with decision: ${decision}`,
            complaintStatus: complaint.status
        };
    }
}

module.exports = new OrderService();
