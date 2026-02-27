const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { auth } = require('../middleware/auth');

// Specific routes BEFORE parametrized routes

/**
 * Get unread notification count
 * GET /api/notifications/count
 */
router.get('/count', auth, (req, res, next) => {
    notificationController.getUnreadCount(req, res).catch(next);
});

/**
 * Get notification preferences
 * GET /api/notifications/preferences
 */
router.get('/preferences', auth, (req, res, next) => {
    notificationController.getPreferences(req, res).catch(next);
});

/**
 * Update notification preferences
 * PATCH /api/notifications/preferences
 */
router.patch('/preferences', auth, (req, res, next) => {
    notificationController.updatePreferences(req, res).catch(next);
});

/**
 * Mark all notifications as read
 * PATCH /api/notifications/read-all
 */
router.patch('/read-all', auth, (req, res, next) => {
    notificationController.markAllAsRead(req, res).catch(next);
});

// Parametrized routes

/**
 * Mark notification as read
 * PATCH /api/notifications/:notificationId/read
 */
router.patch('/:notificationId/read', auth, (req, res, next) => {
    notificationController.markAsRead(req, res).catch(next);
});

/**
 * Delete notification
 * DELETE /api/notifications/:notificationId
 */
router.delete('/:notificationId', auth, (req, res, next) => {
    notificationController.deleteNotification(req, res).catch(next);
});

// Root routes (least specific)

/**
 * Get user's notifications
 * GET /api/notifications
 */
router.get('/', auth, (req, res, next) => {
    notificationController.getNotifications(req, res).catch(next);
});

/**
 * Delete all notifications
 * DELETE /api/notifications
 */
router.delete('/', auth, (req, res, next) => {
    notificationController.deleteAllNotifications(req, res).catch(next);
});

module.exports = router;
