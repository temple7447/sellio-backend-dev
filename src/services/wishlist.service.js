const MarketWishlist = require('../models/MarketWishlist');
const MarketProduct = require('../models/MarketProduct');

class WishlistService {
    async addToWishlist(userId, productId) {
        // Check if product exists
        const product = await MarketProduct.findById(productId);
        if (!product) {
            throw { status: 404, message: 'Product not found' };
        }

        // Check if already in wishlist
        const existing = await MarketWishlist.findOne({ userId, productId });
        if (existing) {
            throw { status: 400, message: 'Product already in wishlist' };
        }

        const wishlistItem = new MarketWishlist({
            userId,
            productId
        });

        await wishlistItem.save();
        return wishlistItem;
    }

    async removeFromWishlist(userId, productId) {
        const result = await MarketWishlist.findOneAndDelete({ userId, productId });
        if (!result) {
            throw { status: 404, message: 'Product not found in wishlist' };
        }
        return { message: 'Product removed from wishlist' };
    }

    async getWishlist(userId, query = {}) {
        const mongoose = require('mongoose');
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 10;
        const skip = (page - 1) * limit;

        const filter = { userId: new mongoose.Types.ObjectId(userId) };

        console.log(`[DEBUG] getWishlist called for user: ${userId}`, { filter, page, limit, skip });
        const [items, total] = await Promise.all([
            MarketWishlist.find(filter)
                .populate({
                    path: 'productId',
                    populate: {
                        path: 'sellerId',
                        select: 'businessName'
                    }
                })
                .sort('-createdAt')
                .skip(skip)
                .limit(limit)
                .lean(),
            MarketWishlist.countDocuments(filter)
        ]);

        console.log(`[DEBUG] getWishlist results: total = ${total}, itemsCount = ${items.length} `);

        return {
            items,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        };
    }

    async checkInWishlist(userId, productId) {
        const item = await MarketWishlist.findOne({ userId, productId });
        return { isInWishlist: !!item };
    }
}

module.exports = new WishlistService();
