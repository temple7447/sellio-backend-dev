const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart.controller');
const { auth, isVerified, isCustomer } = require('../middleware/auth');

// All cart routes require authentication and customer role
router.use(auth, isVerified, isCustomer);

// Add product to cart
router.post('/add', cartController.addToCart);

// Remove product from cart
router.delete('/remove/:cartItemId', cartController.removeFromCart);

// Update cart item quantity
router.patch('/update/:cartItemId', cartController.updateCartItemQuantity);

// Get user's cart
router.get('/', cartController.getCart);

// Clear entire cart
router.delete('/clear', cartController.clearCart);

// Remove multiple items from cart
router.post('/remove-multiple', cartController.removeMultipleItems);

// Get cart count
router.get('/count', cartController.getCartCount);

// Check if product is in cart
router.get('/check/:productId', cartController.checkInCart);

module.exports = router;
