const orderService = require('../services/order.service');
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
            const result = await orderService.getCustomerOrders(req.user._id, req.query);
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Customer orders fetch failed:', error));
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

    async confirmPickup(req, res) {
        try {
            const result = await orderService.confirmPickup(req.user._id, req.params.orderId);
            console.log(chalk.green('✓ Pickup confirmed'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Pickup confirmation failed:', error));
            res.status(error.status || 400).json({ message: error.message });
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
            const result = await orderService.getSellerOrders(req.user._id, req.query);
            console.log(chalk.green('✓ Seller orders fetched successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Seller orders fetch failed:', error));
            res.status(error.status || 500).json({ message: error.message });
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
}

module.exports = new OrderController();
