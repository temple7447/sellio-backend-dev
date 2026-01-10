const orderService = require('../services/order.service');
const { uploadToCloudinary } = require('../utils/cloudinary');
const chalk = require('chalk');

class OrderController {
    async createOrder(req, res) {
        try {
            const result = await orderService.createOrder(req.body);
            console.log(chalk.green(`✓ Guest order created: ${result._id}`));
            res.status(201).json(result);
        } catch (error) {
            console.error(chalk.red('✗ Order creation failed:', error));
            res.status(error.status || 400).json({ message: error.message });
        }
    }

    async getGuestOrders(req, res) {
        try {
            const { email } = req.params;
            const result = await orderService.getGuestOrders(email, req.query);
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Guest orders fetch failed:', error));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async getGuestOrder(req, res) {
        try {
            const order = await orderService.getOrderById(req.params.orderId, req.query.email);
            res.json(order);
        } catch (error) {
            console.error(chalk.red('✗ Guest order fetch failed:', error));
            res.status(error.status || 404).json({ message: error.message });
        }
    }

    async getCustomerOrders(req, res) {
        try {
            console.log(chalk.blue('→ Fetching customer orders for customer:'), req.user._id);
            console.log(chalk.blue('→ Query parameters:'), req.query);

            const result = await orderService.getCustomerOrders(req.user._id, req.query);

            console.log(chalk.green(`✓ Customer orders fetched successfully: ${result.orders.length} orders found`));
            console.log(chalk.blue(`→ Total orders in DB: ${result.pagination.total}`));

            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Customer orders fetch failed:', error));
            console.error(chalk.red('→ Customer ID:'), req.user._id);
            console.error(chalk.red('→ Error details:'), error.message);
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async createCustomerOrder(req, res) {
        try {
            const order = await orderService.createCustomerOrder(req.user._id, req.body);
            console.log(chalk.green(`✓ Customer order created: ${order._id}`));
            res.status(201).json(order);
        } catch (error) {
            console.error(chalk.red('✗ Customer order creation failed:', error));
            res.status(error.status || 400).json({ message: error.message });
        }
    }

    async initiatePayment(req, res) {
        try {
            const result = await orderService.initiatePayment(req.params.orderId);
            console.log(chalk.green(`✓ Payment initialized for order: ${req.params.orderId}`));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Payment initialization failed:', error));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async verifyPayment(req, res) {
        try {
            const result = await orderService.verifyPayment(req.params.reference);
            console.log(chalk.green(`✓ Payment verified: ${req.params.reference}`));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Payment verification failed:', error));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async getOrderStatus(req, res) {
        try {
            const status = await orderService.getOrderStatus(req.user._id, req.params.orderId);
            res.json(status);
        } catch (error) {
            console.error(chalk.red('✗ Order status fetch failed:', error));
            res.status(error.status || 404).json({ message: error.message });
        }
    }

    async confirmReceipt(req, res) {
        try {
            let { itemProofs, itemIds } = req.body;

            // If a file is uploaded, use it for all items being confirmed
            if (req.file) {
                console.log(chalk.blue('→ Uploading buyer receipt proof to Cloudinary...'));
                const uploadResult = await uploadToCloudinary(req.file, 'buyer_proofs');
                const proofUrl = uploadResult.secure_url;

                // Ensure itemIds is an array
                let ids = [];
                if (itemIds) {
                    ids = Array.isArray(itemIds) ? itemIds : itemIds.split(',').map(id => id.trim());
                } else if (itemProofs && typeof itemProofs === 'object') {
                    ids = Object.keys(itemProofs);
                }

                if (ids.length > 0) {
                    itemProofs = {};
                    ids.forEach(id => {
                        itemProofs[id] = proofUrl;
                    });
                } else {
                    // Smart detection: if no IDs specified but we have a file, 
                    // and the URL contains an ID, we'll let the service decide 
                    // if that URL ID is an item ID to apply the proof to.
                    // For now, let's pass a special flag or just the proof.
                    itemProofs = { __single_proof: proofUrl };
                }
            }

            const result = await orderService.confirmReceipt(req.user._id, req.params.orderId, itemProofs);
            console.log(chalk.green('✓ Receipt confirmation processed'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Receipt confirmation failed:'), error);
            res.status(error.status || 400).json({
                success: false,
                message: error.message || 'Receipt confirmation failed',
                details: error
            });
        }
    }

    async initializeCustomerPayment(req, res) {
        try {
            const result = await orderService.initializeCustomerPayment(req.user._id, req.params.orderId);
            console.log(chalk.green(`✓ Customer payment initialized for order: ${req.params.orderId}`));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Payment initialization failed:', error));
            res.status(error.status || 400).json({ message: error.message });
        }
    }

    async getAllOrders(req, res) {
        try {
            const result = await orderService.getAllOrders(req.query);
            console.log(chalk.green('✓ Admin orders fetch successful'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Admin orders fetch failed:', error));
            res.status(error.status || 500).json({
                message: error.message,
                details: error.details
            });
        }
    }

    async getSellerOrders(req, res) {
        try {
            console.log(chalk.blue('→ Fetching seller orders for seller:'), req.user._id);
            console.log(chalk.blue('→ Query parameters:'), req.query);

            const result = await orderService.getSellerOrders(req.user._id, req.query);

            console.log(chalk.green(`✓ Seller orders fetched successfully: ${result.orders.length} orders found`));
            console.log(chalk.blue(`→ Total orders in DB: ${result.pagination.total}`));

            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Seller orders fetch failed:'));
            console.error(chalk.red('→ Seller ID:'), req.user._id);
            console.error(chalk.red('→ Error message:'), error.message);
            console.error(chalk.red('→ Error details:'), error.details);
            if (error.stack) {
                console.error(chalk.red('→ Stack trace:'), error.stack);
            }
            res.status(error.status || 500).json({
                message: error.message,
                details: error.details
            });
        }
    }

    async getAdminDashboard(req, res) {
        try {
            const stats = await orderService.getAdminDashboardStats(req.query.timeframe);
            console.log(chalk.green('✓ Admin dashboard statistics fetched successfully'));
            res.json(stats);
        } catch (error) {
            console.error(chalk.red('✗ Dashboard statistics fetch failed:', error));
            res.status(error.status || 500).json({
                message: error.message || 'Failed to fetch dashboard statistics',
                error: error.details || undefined
            });
        }
    }
    async uploadFulfillmentProof(req, res) {
        try {
            const { orderItemId } = req.params;
            let { proofUrl } = req.body;
            const sellerId = req.user._id;

            // If a file is uploaded, use it as the fulfillment proof
            if (req.file) {
                console.log(chalk.blue('→ Uploading seller fulfillment proof to Cloudinary...'));
                const uploadResult = await uploadToCloudinary(req.file, 'fulfillment_proofs');
                proofUrl = uploadResult.secure_url;
            }

            if (!proofUrl) {
                return res.status(400).json({
                    success: false,
                    message: 'Fulfillment proof (file or URL) is required'
                });
            }

            const item = await orderService.uploadFulfillmentProof(sellerId, orderItemId, proofUrl);

            res.status(200).json({
                success: true,
                message: 'Fulfillment proof uploaded successfully. Item status updated to shipped.',
                data: item
            });
        } catch (error) {
            console.error('Upload fulfillment proof error:', error);
            res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Failed to upload fulfillment proof'
            });
        }
    }

    async getOrderDetail(req, res) {
        try {
            const result = await orderService.getOrderDetail(req.params.orderId, req.user);
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Order detail fetch failed:'), error);
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async payWithWallet(req, res) {
        try {
            const result = await orderService.payWithWallet(req.user._id, req.params.orderId);
            console.log(chalk.green(`✓ Order paid with wallet: ${req.params.orderId}`));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Wallet payment failed:'), error);
            res.status(error.status || 400).json({
                message: error.message,
                available: error.available,
                required: error.required
            });
        }
    }

    async cancelOrder(req, res) {
        try {
            const { reason } = req.body;
            if (!reason) {
                return res.status(400).json({ message: 'Cancellation reason is required' });
            }

            const result = await orderService.cancelOrder(req.user._id, req.params.orderId, reason);
            console.log(chalk.green(`✓ Order ${req.params.orderId} cancellation processed by customer ${req.user._id}`));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Order cancellation failed:'), error);
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async cancelOrderItem(req, res) {
        try {
            const { reason } = req.body;
            if (!reason) {
                return res.status(400).json({ message: 'Cancellation reason is required' });
            }

            // Determine role for authorization
            const role = req.user.role === 'seller' ? 'seller' : 'customer';

            const result = await orderService.cancelOrderItem(
                req.user._id,
                req.params.orderItemId,
                reason,
                role
            );

            console.log(chalk.green(`✓ Item ${req.params.orderItemId} cancelled by ${role} ${req.user._id}`));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Item cancellation failed:'), error);
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async fileComplaint(req, res) {
        try {
            const { subject, complaint, orderItemId } = req.body;
            const orderId = req.params.orderId;

            if (!subject || !complaint) {
                return res.status(400).json({ message: 'Subject and complaint are required' });
            }

            const complaintData = {
                orderId,
                orderItemId,
                subject,
                complaint,
                role: req.user.role // 'customer', 'seller', or 'admin'
            };

            const result = await orderService.fileComplaint(req.user._id, complaintData, req.files || []);
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Filing complaint failed:'), error);
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async resolveOrderComplaint(req, res) {
        try {
            const { decision, resolution } = req.body;
            const complaintId = req.params.complaintId;

            if (!decision || !resolution) {
                return res.status(400).json({ message: 'Decision and resolution text are required' });
            }

            const result = await orderService.resolveComplaint(req.user._id, complaintId, decision, resolution);
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Resolving complaint failed:'), error);
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async getAllComplaints(req, res) {
        try {
            const MarketOrderComplain = require('../models/MarketOrderComplain');
            const { status } = req.query;

            const query = {};
            if (status) {
                query.status = status;
            }

            const complaints = await MarketOrderComplain.find(query)
                .sort({ createdAt: -1 })
                .populate('userId', 'fullName email')
                .populate('orderId', 'status totals guestEmail');

            // Get counts for summary
            const counts = await MarketOrderComplain.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]);

            const summary = {
                all: 0,
                pending: 0,
                'in-review': 0,
                resolved: 0,
                dismissed: 0
            };

            counts.forEach(c => {
                summary[c._id] = c.count;
                summary.all += c.count;
            });

            res.json({
                success: true,
                count: complaints.length,
                summary,
                data: complaints
            });
        } catch (error) {
            console.error(chalk.red('✗ Fetching complaints failed:'), error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
}

module.exports = new OrderController();
