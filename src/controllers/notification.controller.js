const notificationService = require('../services/notification.service');
const chalk = require('chalk');

class NotificationController {
    /**
     * Get user's notifications
     */
    async getNotifications(req, res) {
        try {
            console.log(chalk.blue(`📬 Fetching notifications for user: ${req.user.id}`));

            const result = await notificationService.getUserNotifications(
                req.user.id,
                req.query
            );

            res.status(200).json({
                success: true,
                ...result
            });
        } catch (error) {
            console.error(chalk.red('❌ Error fetching notifications:'), error);
            res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Error fetching notifications'
            });
        }
    }

    /**
     * Get unread notification count
     */
    async getUnreadCount(req, res) {
        try {
            console.log(chalk.blue(`📬 Getting unread count for user: ${req.user.id}`));

            const result = await notificationService.getUnreadCount(req.user.id);

            res.status(200).json({
                success: true,
                ...result
            });
        } catch (error) {
            console.error(chalk.red('❌ Error getting unread count:'), error);
            res.status(500).json({
                success: false,
                message: 'Error getting unread count'
            });
        }
    }

    /**
     * Mark notification as read
     */
    async markAsRead(req, res) {
        try {
            const { notificationId } = req.params;

            console.log(chalk.blue(`✓ Marking notification as read: ${notificationId}`));

            const notification = await notificationService.markAsRead(
                notificationId,
                req.user.id
            );

            res.status(200).json({
                success: true,
                message: 'Notification marked as read',
                data: notification
            });
        } catch (error) {
            console.error(chalk.red('❌ Error marking notification as read:'), error);
            res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Error marking notification as read'
            });
        }
    }

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(req, res) {
        try {
            console.log(chalk.blue(`✓ Marking all notifications as read for user: ${req.user.id}`));

            const result = await notificationService.markAllAsRead(req.user.id);

            res.status(200).json({
                success: true,
                message: 'All notifications marked as read',
                ...result
            });
        } catch (error) {
            console.error(chalk.red('❌ Error marking all as read:'), error);
            res.status(500).json({
                success: false,
                message: 'Error marking all notifications as read'
            });
        }
    }

    /**
     * Delete notification
     */
    async deleteNotification(req, res) {
        try {
            const { notificationId } = req.params;

            console.log(chalk.blue(`🗑️ Deleting notification: ${notificationId}`));

            const result = await notificationService.deleteNotification(
                notificationId,
                req.user.id
            );

            res.status(200).json({
                success: true,
                message: result.message
            });
        } catch (error) {
            console.error(chalk.red('❌ Error deleting notification:'), error);
            res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Error deleting notification'
            });
        }
    }

    /**
     * Delete all notifications
     */
    async deleteAllNotifications(req, res) {
        try {
            console.log(chalk.blue(`🗑️ Deleting all notifications for user: ${req.user.id}`));

            const result = await notificationService.deleteAllNotifications(req.user.id);

            res.status(200).json({
                success: true,
                message: result.message,
                deletedCount: result.deletedCount
            });
        } catch (error) {
            console.error(chalk.red('❌ Error deleting all notifications:'), error);
            res.status(500).json({
                success: false,
                message: 'Error deleting all notifications'
            });
        }
    }

    /**
     * Get notification preferences (placeholder for future implementation)
     */
    async getPreferences(req, res) {
        try {
            console.log(chalk.blue(`⚙️ Getting notification preferences for user: ${req.user.id}`));

            // This could be stored in user model or separate model
            res.status(200).json({
                success: true,
                preferences: {
                    email: {
                        orders: true,
                        payments: true,
                        complaints: true,
                        wallet: true,
                        reviews: true,
                        security: true
                    },
                    inApp: {
                        orders: true,
                        payments: true,
                        complaints: true,
                        wallet: true,
                        reviews: true,
                        marketing: false
                    },
                    sms: {
                        payments: true,
                        emergencies: true
                    }
                }
            });
        } catch (error) {
            console.error(chalk.red('❌ Error getting preferences:'), error);
            res.status(500).json({
                success: false,
                message: 'Error getting preferences'
            });
        }
    }

    /**
     * Update notification preferences
     */
    async updatePreferences(req, res) {
        try {
            const { preferences } = req.body;

            console.log(chalk.blue(`⚙️ Updating preferences for user: ${req.user.id}`));

            // TODO: Save to user model or NotificationPreference model
            // await NotificationPreference.findOneAndUpdate(
            //     { userId: req.user.id },
            //     { preferences },
            //     { upsert: true, new: true }
            // );

            res.status(200).json({
                success: true,
                message: 'Preferences updated successfully',
                preferences
            });
        } catch (error) {
            console.error(chalk.red('❌ Error updating preferences:'), error);
            res.status(500).json({
                success: false,
                message: 'Error updating preferences'
            });
        }
    }
}

module.exports = new NotificationController();
