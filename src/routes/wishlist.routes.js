const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlist.controller');
const { auth, isVerified, isCustomer } = require('../middleware/auth');

// All wishlist routes require authentication and customer role
router.use(auth, isVerified, isCustomer);

router.post('/add', wishlistController.addToWishlist);
router.delete('/remove/:productId', wishlistController.removeFromWishlist);
router.get('/', wishlistController.getWishlist);
router.get('/check/:productId', wishlistController.checkInWishlist);

module.exports = router;
