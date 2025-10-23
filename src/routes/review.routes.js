const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const reviewController = require('../controllers/review.controller');

// Authenticated customers can create a review after delivery confirmation
router.post('/customer', auth, reviewController.createCustomerReview);

// Public: list reviews for a vendor's products
router.get('/vendor/:sellerId', reviewController.listVendorReviews);

module.exports = router;
