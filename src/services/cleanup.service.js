const MarketOrder = require('../models/MarketOrder');
const MarketOrderItem = require('../models/MarketOrderItem');
const { MarketUser } = require('../models/MarketUser');
const walletService = require('./wallet.service');
const adsService = require('./ads.service');
const chalk = require('chalk');

class CleanupService {
    constructor() {
        this.interval = null;
    }

    /**
     * Start the cleanup background job
     * @param {number} intervalMs - Frequency of cleanup in milliseconds (default: 1 hour)
     */
    start(intervalMs = 60 * 60 * 1000) {
        if (this.interval) return;

        console.log(chalk.blue(`✓ Order Cleanup Service started (Interval: ${intervalMs / (60 * 1000)} mins)`));

        // Run immediately on start
        this.cleanupUnpaidOrders();
        this.expireTrustedBadges();
        this.expireAdCampaigns();

        this.interval = setInterval(() => {
            this.cleanupUnpaidOrders();
            this.expireTrustedBadges();
            this.expireAdCampaigns();
        }, intervalMs);
    }

    /**
     * Stop the cleanup background job
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            console.log(chalk.yellow('! Order Cleanup Service stopped'));
        }
    }

    /**
     * Delete orders with pending payment older than 24 hours
     */
    async cleanupUnpaidOrders() {
        try {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            // Find orders that are pending and older than 24h
            const pendingOrders = await MarketOrder.find({
                'payment.status': 'pending',
                createdAt: { $lt: twentyFourHoursAgo }
            }).select('_id');

            if (pendingOrders.length === 0) {
                console.log(chalk.gray(`[${new Date().toISOString()}] No expired unpaid orders to clean up.`));
                return;
            }

            const orderIds = pendingOrders.map(order => order._id);

            console.log(chalk.yellow(`[${new Date().toISOString()}] Cleaning up ${orderIds.length} expired unpaid orders...`));

            // Delete order items first
            const itemsResult = await MarketOrderItem.deleteMany({
                orderId: { $in: orderIds }
            });

            // Delete orders
            const ordersResult = await MarketOrder.deleteMany({
                _id: { $in: orderIds }
            });

            console.log(chalk.green(`✓ Successfully deleted ${ordersResult.deletedCount} orders and ${itemsResult.deletedCount} items.`));
        } catch (error) {
            console.error(chalk.red('✗ Error during unpaid order cleanup:'), error.message);
        }
    }

    /**
     * Expire trusted badges that have exceeded 1 year
     */
    async expireTrustedBadges() {
        try {
            const result = await walletService.checkAndExpireBadges();
            if (result.expired > 0) {
                console.log(chalk.yellow(`[${new Date().toISOString()}] Expired ${result.expired} trusted badges`));
            }
        } catch (error) {
            console.error(chalk.red('✗ Error during badge expiry check:'), error.message);
        }
    }

    /**
     * Mark expired ad campaigns as completed
     */
    async expireAdCampaigns() {
        try {
            const count = await adsService.markExpiredCampaigns();
            if (count > 0) {
                console.log(chalk.blue(`[${new Date().toISOString()}] Completed ${count} expired ad campaigns`));
            }
        } catch (error) {
            console.error(chalk.red('✗ Error during ad campaign expiry check:'), error.message);
        }
    }
}

module.exports = new CleanupService();
