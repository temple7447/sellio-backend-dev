const wishlistService = require('../services/wishlist.service');
const chalk = require('chalk');

class WishlistController {
    async addToWishlist(req, res) {
        try {
            const { productId } = req.body;
            if (!productId) {
                return res.status(400).json({ message: 'Product ID is required' });
            }

            const result = await wishlistService.addToWishlist(req.user._id, productId);
            console.log(chalk.green(`✓ Product ${productId} added to wishlist for user ${req.user._id}`));
            res.status(201).json({
                success: true,
                message: 'Product added to wishlist',
                data: result
            });
        } catch (error) {
            console.error(chalk.red('✗ Add to wishlist failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async removeFromWishlist(req, res) {
        try {
            const { productId } = req.params;
            const result = await wishlistService.removeFromWishlist(req.user._id, productId);
            console.log(chalk.green(`✓ Product ${productId} removed from wishlist for user ${req.user._id}`));
            res.json({
                success: true,
                ...result
            });
        } catch (error) {
            console.error(chalk.red('✗ Remove from wishlist failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async getWishlist(req, res) {
        try {
            const result = await wishlistService.getWishlist(req.user._id, req.query);
            res.json({
                success: true,
                ...result
            });
        } catch (error) {
            console.error(chalk.red('✗ Fetch wishlist failed:', error.message));
            res.status(500).json({ message: error.message });
        }
    }

    async checkInWishlist(req, res) {
        try {
            const { productId } = req.params;
            const result = await wishlistService.checkInWishlist(req.user._id, productId);
            res.json({
                success: true,
                ...result
            });
        } catch (error) {
            console.error(chalk.red('✗ Check wishlist failed:', error.message));
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = new WishlistController();
