const cartService = require('../services/cart.service');
const chalk = require('chalk');

class CartController {
    async addToCart(req, res) {
        try {
            const { productId, quantity, sellerId } = req.body;

            if (!productId || !quantity || !sellerId) {
                return res.status(400).json({ 
                    message: 'Missing required fields: productId, quantity, sellerId' 
                });
            }

            const result = await cartService.addToCart(
                req.user._id,
                productId,
                quantity,
                sellerId
            );

            console.log(chalk.green(`✓ Product ${productId} added to cart for user ${req.user._id}`));
            res.status(201).json({
                success: true,
                message: 'Product added to cart',
                data: result
            });
        } catch (error) {
            console.error(chalk.red('✗ Add to cart failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async removeFromCart(req, res) {
        try {
            const { cartItemId } = req.params;

            const result = await cartService.removeFromCart(req.user._id, cartItemId);

            console.log(chalk.green(`✓ Item ${cartItemId} removed from cart`));
            res.json({
                success: true,
                ...result
            });
        } catch (error) {
            console.error(chalk.red('✗ Remove from cart failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async updateCartItemQuantity(req, res) {
        try {
            const { cartItemId } = req.params;
            const { quantity } = req.body;

            if (!quantity) {
                return res.status(400).json({ message: 'Quantity is required' });
            }

            const result = await cartService.updateCartItemQuantity(
                req.user._id,
                cartItemId,
                quantity
            );

            console.log(chalk.green(`✓ Cart item ${cartItemId} quantity updated to ${quantity}`));
            res.json({
                success: true,
                message: 'Cart item quantity updated',
                data: result
            });
        } catch (error) {
            console.error(chalk.red('✗ Update cart quantity failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async getCart(req, res) {
        try {
            const result = await cartService.getCart(req.user._id, req.query);

            console.log(chalk.green(`✓ Cart retrieved for user ${req.user._id}`));
            res.json({
                success: true,
                ...result
            });
        } catch (error) {
            console.error(chalk.red('✗ Fetch cart failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async clearCart(req, res) {
        try {
            const result = await cartService.clearCart(req.user._id);

            console.log(chalk.green(`✓ Cart cleared for user ${req.user._id}`));
            res.json({
                success: true,
                ...result
            });
        } catch (error) {
            console.error(chalk.red('✗ Clear cart failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async removeMultipleItems(req, res) {
        try {
            const { cartItemIds } = req.body;

            if (!cartItemIds) {
                return res.status(400).json({ message: 'cartItemIds array is required' });
            }

            const result = await cartService.removeMultipleItems(req.user._id, cartItemIds);

            console.log(chalk.green(`✓ Multiple items removed from cart for user ${req.user._id}`));
            res.json({
                success: true,
                ...result
            });
        } catch (error) {
            console.error(chalk.red('✗ Remove multiple items failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async getCartCount(req, res) {
        try {
            const result = await cartService.getCartCount(req.user._id);

            console.log(chalk.green(`✓ Cart count retrieved for user ${req.user._id}`));
            res.json({
                success: true,
                ...result
            });
        } catch (error) {
            console.error(chalk.red('✗ Get cart count failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async checkInCart(req, res) {
        try {
            const { productId } = req.params;

            const result = await cartService.checkInCart(req.user._id, productId);

            console.log(chalk.green(`✓ Cart item check completed for product ${productId}`));
            res.json({
                success: true,
                ...result
            });
        } catch (error) {
            console.error(chalk.red('✗ Check in cart failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }
}

module.exports = new CartController();
