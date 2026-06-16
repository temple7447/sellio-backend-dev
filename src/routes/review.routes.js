const express = require('express');
const router = express.Router();
const { auth, optionalAuth } = require('../middleware/auth');
const reviewController = require('../controllers/review.controller');

// Authenticated customers can create a review after delivery confirmation
router.post('/customer', auth, reviewController.createCustomerReview);

// Authenticated: toggle a "helpful" vote on a review
router.post('/:reviewId/helpful', auth, reviewController.markReviewHelpful);

// Public: list reviews for a specific product (optionalAuth flags viewer votes)
router.get('/product/:productId', optionalAuth, reviewController.listProductReviews);

// Public: list reviews for a vendor's products
router.get('/vendor/:sellerId', reviewController.listVendorReviews);

module.exports = router;
