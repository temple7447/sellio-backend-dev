const MarketNotification = require('../models/MarketNotification');
const emailService = require('./email.service');
const mongoose = require('mongoose');
const chalk = require('chalk');

class NotificationService {
    /**
     * Create a notification
     */
    async createNotification(userId, type, title, message, data = {}, channels = { inApp: true, email: false }) {
        try {
            const notification = new MarketNotification({
                userId,
                type,
                title,
                message,
                data,
                channels: {
                    inApp: { sent: channels.inApp || false },
                    email: { sent: channels.email || false },
                    sms: { sent: false }
                }
            });

            await notification.save();
            console.log(chalk.green(`✅ Notification created: ${type} for user ${userId}`));
            return notification;
        } catch (error) {
            console.error(chalk.red('❌ Error creating notification:'), error.message);
            throw error;
        }
    }

    /**
     * Get user notifications
     */
    async getUserNotifications(userId, query = {}) {
        try {
            const page = parseInt(query.page) || 1;
            const limit = parseInt(query.limit) || 20;
            const skip = (page - 1) * limit;
            const unreadOnly = query.unreadOnly === 'true';

            const filter = { userId: new mongoose.Types.ObjectId(userId) };
            if (unreadOnly) filter.read = false;

            const notifications = await MarketNotification.find(filter)
                .sort('-createdAt')
                .skip(skip)
                .limit(limit)
                .lean();

            const total = await MarketNotification.countDocuments(filter);

            return {
                notifications,
                pagination: {
                    total,
                    pages: Math.ceil(total / limit),
                    currentPage: page,
                    limit
                }
            };
        } catch (error) {
            console.error(chalk.red('❌ Error fetching notifications:'), error.message);
            throw error;
        }
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId, userId) {
        try {
            const notification = await MarketNotification.findOne({
                _id: notificationId,
                userId
            });

            if (!notification) {
                throw { status: 404, message: 'Notification not found' };
            }

            await notification.markAsRead();
            return notification;
        } catch (error) {
            console.error(chalk.red('❌ Error marking notification as read:'), error.message);
            throw error;
        }
    }

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(userId) {
        try {
            const result = await MarketNotification.updateMany(
                { userId, read: false },
                { read: true, readAt: new Date() }
            );

            console.log(chalk.green(`✅ Marked ${result.modifiedCount} notifications as read`));
            return { markedCount: result.modifiedCount };
        } catch (error) {
            console.error(chalk.red('❌ Error marking all notifications as read:'), error.message);
            throw error;
        }
    }

    /**
     * Get unread count
     */
    async getUnreadCount(userId) {
        try {
            const count = await MarketNotification.countDocuments({
                userId,
                read: false
            });

            return { unreadCount: count };
        } catch (error) {
            console.error(chalk.red('❌ Error getting unread count:'), error.message);
            throw error;
        }
    }

    /**
     * Delete notification
     */
    async deleteNotification(notificationId, userId) {
        try {
            const result = await MarketNotification.deleteOne({
                _id: notificationId,
                userId
            });

            if (result.deletedCount === 0) {
                throw { status: 404, message: 'Notification not found' };
            }

            return { message: 'Notification deleted' };
        } catch (error) {
            console.error(chalk.red('❌ Error deleting notification:'), error.message);
            throw error;
        }
    }

    /**
     * Delete all notifications
     */
    async deleteAllNotifications(userId) {
        try {
            const result = await MarketNotification.deleteMany({ userId });
            return { message: 'All notifications deleted', deletedCount: result.deletedCount };
        } catch (error) {
            console.error(chalk.red('❌ Error deleting all notifications:'), error.message);
            throw error;
        }
    }

    /**
     * Send order confirmation notification
     */
    async notifyOrderConfirmation(user, orderId, items, total) {
        try {
            const title = 'Order Confirmed';
            const message = `Your order #${orderId} has been confirmed. Total: ₦${total.toLocaleString()}`;

            // In-app notification
            await this.createNotification(
                user._id,
                'order_created',
                title,
                message,
                { orderId, amount: total }
            );

            // Email notification
            if (user.email) {
                const emailHtml = emailService.orderConfirmation(
                    user.email,
                    user.fullName,
                    orderId,
                    items,
                    total
                );
                await emailService.sendEmail(user.email, title, emailHtml);
            }
        } catch (error) {
            console.error(chalk.red('❌ Error sending order confirmation:'), error.message);
        }
    }

    /**
     * Send payment successful notification
     */
    async notifyPaymentSuccessful(user, orderId, amount, reference) {
        try {
            const title = 'Payment Successful';
            const message = `Payment of ₦${amount.toLocaleString()} received for order #${orderId}`;

            await this.createNotification(
                user._id,
                'payment_successful',
                title,
                message,
                { orderId, amount, reference }
            );

            if (user.email) {
                const emailHtml = emailService.paymentSuccessful(
                    user.email,
                    user.fullName,
                    orderId,
                    amount,
                    reference
                );
                await emailService.sendEmail(user.email, title, emailHtml);
            }
        } catch (error) {
            console.error(chalk.red('❌ Error sending payment notification:'), error.message);
        }
    }

    /**
     * Send order shipped notification
     */
    async notifyOrderShipped(user, orderId, items, trackingNumber = null) {
        try {
            const title = 'Order Shipped';
            const message = `Your order #${orderId} has been shipped ${trackingNumber ? `(Tracking: ${trackingNumber})` : ''}`;

            await this.createNotification(
                user._id,
                'order_shipped',
                title,
                message,
                { orderId, reference: trackingNumber }
            );

            if (user.email) {
                const emailHtml = emailService.orderShipped(
                    user.email,
                    user.fullName,
                    orderId,
                    items,
                    trackingNumber
                );
                await emailService.sendEmail(user.email, title, emailHtml);
            }
        } catch (error) {
            console.error(chalk.red('❌ Error sending order shipped notification:'), error.message);
        }
    }

    /**
     * Send order delivered notification
     */
    async notifyOrderDelivered(user, orderId, items) {
        try {
            const title = 'Order Delivered';
            const message = `Your order #${orderId} has been delivered. Please confirm receipt.`;

            await this.createNotification(
                user._id,
                'order_delivered',
                title,
                message,
                { orderId }
            );

            if (user.email) {
                const emailHtml = emailService.orderDelivered(
                    user.email,
                    user.fullName,
                    orderId,
                    items
                );
                await emailService.sendEmail(user.email, title, emailHtml);
            }
        } catch (error) {
            console.error(chalk.red('❌ Error sending order delivered notification:'), error.message);
        }
    }

    /**
     * Send order cancelled notification
     */
    async notifyOrderCancelled(user, orderId, reason, refundAmount) {
        try {
            const title = 'Order Cancelled';
            const message = `Your order #${orderId} has been cancelled. Refund: ₦${refundAmount.toLocaleString()}`;

            await this.createNotification(
                user._id,
                'order_cancelled',
                title,
                message,
                { orderId, amount: refundAmount, reason }
            );

            if (user.email) {
                const emailHtml = emailService.orderCancelled(
                    user.email,
                    user.fullName,
                    orderId,
                    reason,
                    refundAmount
                );
                await emailService.sendEmail(user.email, title, emailHtml);
            }
        } catch (error) {
            console.error(chalk.red('❌ Error sending order cancelled notification:'), error.message);
        }
    }

    /**
     * Send wallet credited notification
     */
    async notifyWalletCredited(user, amount, reason, reference) {
        try {
            const title = 'Wallet Credited';
            const message = `₦${amount.toLocaleString()} has been added to your wallet (${reason})`;

            await this.createNotification(
                user._id,
                'wallet_credited',
                title,
                message,
                { amount, reason, reference }
            );

            if (user.email) {
                const emailHtml = emailService.walletCredited(
                    user.email,
                    user.fullName,
                    amount,
                    reason,
                    reference
                );
                await emailService.sendEmail(user.email, title, emailHtml);
            }
        } catch (error) {
            console.error(chalk.red('❌ Error sending wallet credited notification:'), error.message);
        }
    }

    /**
     * Send withdrawal status notification
     */
    async notifyWithdrawalStatus(user, amount, status, reason = '') {
        try {
            const statusTitle = {
                approved: 'Withdrawal Approved',
                rejected: 'Withdrawal Rejected',
                completed: 'Withdrawal Completed'
            };

            const title = statusTitle[status] || 'Withdrawal Update';
            const message = `Your withdrawal request for ₦${amount.toLocaleString()} has been ${status}`;

            await this.createNotification(
                user._id,
                `withdrawal_${status}`,
                title,
                message,
                { amount, status, reason }
            );

            if (user.email) {
                const emailHtml = emailService.withdrawalStatus(
                    user.email,
                    user.fullName,
                    amount,
                    status,
                    reason
                );
                await emailService.sendEmail(user.email, title, emailHtml);
            }
        } catch (error) {
            console.error(chalk.red('❌ Error sending withdrawal status notification:'), error.message);
        }
    }

    /**
     * Send complaint resolved notification
     */
    async notifyComplaintResolved(user, complaintId, resolution, decision) {
        try {
            const title = 'Complaint Resolved';
            const message = `Your complaint has been reviewed. Decision: ${decision}`;

            await this.createNotification(
                user._id,
                'complaint_resolved',
                title,
                message,
                { complaintId, status: decision }
            );

            if (user.email) {
                const emailHtml = emailService.complaintResolved(
                    user.email,
                    user.fullName,
                    complaintId,
                    resolution,
                    decision
                );
                await emailService.sendEmail(user.email, title, emailHtml);
            }
        } catch (error) {
            console.error(chalk.red('❌ Error sending complaint resolved notification:'), error.message);
        }
    }

    /**
     * Send seller: new order notification
     */
    async notifySellerNewOrder(seller, orderId, items, totalAmount, buyerName) {
        try {
            const title = 'New Order Received';
            const message = `You have a new order (#${orderId}) from ${buyerName}. Total: ₦${totalAmount.toLocaleString()}`;

            await this.createNotification(
                seller._id,
                'new_order_received',
                title,
                message,
                { orderId, amount: totalAmount }
            );

            if (seller.email) {
                const emailHtml = emailService.sellerNewOrder(
                    seller.email,
                    seller.businessName || seller.fullName,
                    orderId,
                    items,
                    totalAmount,
                    buyerName
                );
                await emailService.sendEmail(seller.email, title, emailHtml);
            }
        } catch (error) {
            console.error(chalk.red('❌ Error sending seller order notification:'), error.message);
        }
    }

    /**
     * Send seller: low stock alert
     */
    async notifySellerLowStock(seller, productName, currentStock, threshold) {
        try {
            const title = 'Low Stock Alert';
            const message = `"${productName}" stock is low (${currentStock} units)`;

            await this.createNotification(
                seller._id,
                'low_stock_alert',
                title,
                message,
                { productName, currentStock, threshold },
                { inApp: true, email: true }
            );

            if (seller.email) {
                const emailHtml = emailService.lowStockAlert(
                    seller.email,
                    seller.businessName || seller.fullName,
                    productName,
                    currentStock,
                    threshold
                );
                await emailService.sendEmail(seller.email, title, emailHtml);
            }
        } catch (error) {
            console.error(chalk.red('❌ Error sending low stock alert:'), error.message);
        }
    }

    /**
     * Send OTP notification
     */
    async notifyOTP(user, otp, purpose = 'verification') {
        try {
            const title = `${purpose.charAt(0).toUpperCase() + purpose.slice(1)} OTP`;
            const message = `Your OTP is: ${otp}. This expires in 10 minutes.`;

            await this.createNotification(
                user._id,
                'otp_sent',
                title,
                message,
                { otp, purpose }
            );

            if (user.email) {
                const emailHtml = emailService.otpEmail(
                    user.email,
                    user.fullName,
                    otp,
                    purpose
                );
                await emailService.sendEmail(user.email, title, emailHtml);
            }
        } catch (error) {
            console.error(chalk.red('❌ Error sending OTP:'), error.message);
        }
    }

    /**
     * Send complaint filed notification to admin
     */
    async notifyAdminComplaintFiled(adminUser, complaintId, orderId, userId, subject) {
        try {
            const title = 'New Complaint Filed';
            const message = `New complaint on order #${orderId}: ${subject}`;

            await this.createNotification(
                adminUser._id,
                'complaint_filed',
                title,
                message,
                { complaintId, orderId, userId },
                { inApp: true, email: true }
            );
        } catch (error) {
            console.error(chalk.red('❌ Error notifying admin of complaint:'), error.message);
        }
    }

    /**
     * Send seller: complaint filed notification
     */
    async notifySellerComplaintFiled(seller, complaintId, orderId, subject) {
        try {
            const title = 'Complaint Filed on Your Item';
            const message = `A customer has filed a complaint: ${subject}`;

            await this.createNotification(
                seller._id,
                'complaint_filed_on_item',
                title,
                message,
                { complaintId, orderId }
            );
        } catch (error) {
            console.error(chalk.red('❌ Error notifying seller of complaint:'), error.message);
        }
    }
}

module.exports = new NotificationService();
