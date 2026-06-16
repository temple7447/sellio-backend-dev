const MarketCart = require('../models/MarketCart');
const MarketProduct = require('../models/MarketProduct');
const mongoose = require('mongoose');
const { findVariant, resolvePurchasable } = require('../utils/variant');

class CartService {
    /**
     * Add product to cart
     */
    async addToCart(userId, productId, quantity, sellerId, variantId = null) {
        // Validate quantity
        if (!quantity || quantity < 1) {
            throw { status: 400, message: 'Quantity must be at least 1' };
        }

        // Check if product exists and get its details
        const product = await MarketProduct.findById(productId);
        if (!product) {
            throw { status: 404, message: 'Product not found' };
        }

        // Resolve the chosen variant (if any) for stock + price.
        let variant = null;
        if (variantId) {
            variant = findVariant(product, variantId);
            if (!variant) {
                throw { status: 400, message: 'Selected variant is not available' };
            }
        } else if (Array.isArray(product.variants) && product.variants.length > 0) {
            throw { status: 400, message: 'Please select a variant for this product' };
        }
        const purchasable = resolvePurchasable(product, variant);

        // Check stock availability against the variant (or base inventory).
        if (purchasable.stock < quantity) {
            throw {
                status: 409,
                message: 'Insufficient product stock',
                available: purchasable.stock,
                requested: quantity
            };
        }

        // Check if this same product+variant is already in the cart.
        const existingItem = await MarketCart.findOne({
            userId,
            productId,
            variantId: variantId || null,
            isDeleted: false
        });

        if (existingItem) {
            throw { status: 400, message: 'Product already in cart' };
        }

        // Create cart item
        const cartItem = new MarketCart({
            userId,
            productId,
            sellerId,
            quantity,
            price: purchasable.price,
            variantId: variantId || null,
            variantLabel: purchasable.label,
            variantImage: purchasable.image
        });

        await cartItem.save();
        return cartItem;
    }

    /**
     * Remove product from cart
     */
    async removeFromCart(userId, cartItemId) {
        const cartItem = await MarketCart.findOne({
            _id: cartItemId,
            userId,
            isDeleted: false
        });

        if (!cartItem) {
            throw { status: 404, message: 'Cart item not found' };
        }

        // Soft delete
        cartItem.isDeleted = true;
        await cartItem.save();

        return { message: 'Product removed from cart' };
    }

    /**
     * Update cart item quantity
     */
    async updateCartItemQuantity(userId, cartItemId, quantity) {
        if (!quantity || quantity < 1) {
            throw { status: 400, message: 'Quantity must be at least 1' };
        }

        const cartItem = await MarketCart.findOne({
            _id: cartItemId,
            userId,
            isDeleted: false
        });

        if (!cartItem) {
            throw { status: 404, message: 'Cart item not found' };
        }

        // Check stock availability (against the selected variant when present).
        const product = await MarketProduct.findById(cartItem.productId);
        if (!product) {
            throw { status: 404, message: 'Product not found' };
        }

        const variant = cartItem.variantId ? findVariant(product, cartItem.variantId) : null;
        const availableStock = variant ? (variant.stock ?? 0) : product.inventory.quantity;
        if (availableStock < quantity) {
            throw {
                status: 409,
                message: 'Insufficient product stock',
                available: availableStock,
                requested: quantity
            };
        }

        cartItem.quantity = quantity;
        await cartItem.save();

        return cartItem;
    }

    /**
     * Get user's cart with populated details
     */
    async getCart(userId, query = {}) {
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 20;
        const skip = (page - 1) * limit;

        // Fetch cart items
        const cartItems = await MarketCart.find({
            userId: new mongoose.Types.ObjectId(userId),
            isDeleted: false
        })
            .populate({
                path: 'productId',
                select: 'name price images inventory'
            })
            .populate({
                path: 'sellerId',
                select: 'businessName email _id'
            })
            .sort('-addedAt')
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await MarketCart.countDocuments({
            userId,
            isDeleted: false
        });

        // Calculate totals
        let subtotal = 0;
        let totalQuantity = 0;
        let totalItems = 0;

        const bySeller = {};

        cartItems.forEach(item => {
            const itemSubtotal = item.price * item.quantity;
            subtotal += itemSubtotal;
            totalQuantity += item.quantity;
            totalItems += 1;

            const sellerId = item.sellerId._id.toString();
            if (!bySeller[sellerId]) {
                bySeller[sellerId] = {
                    sellerId: item.sellerId._id,
                    sellerName: item.sellerId.businessName,
                    itemCount: 0,
                    subtotal: 0
                };
            }

            bySeller[sellerId].itemCount += 1;
            bySeller[sellerId].subtotal += itemSubtotal;
        });

        // Calculate tax and totals (assume 10% tax)
        const taxRate = 0.10;
        const tax = Math.round(subtotal * taxRate);
        const totalPrice = subtotal + tax;

        // Helper function to extract image URL from images array
        const getImageUrl = (images) => {
            if (!images || images.length === 0) return null;
            const defaultImage = images.find(img => img.isDefault);
            return defaultImage ? defaultImage.url : (images[0]?.url || null);
        };

        return {
            items: cartItems.map(item => ({
                _id: item._id,
                userId: item.userId,
                productId: {
                    _id: item.productId._id,
                    name: item.productId.name,
                    price: item.productId.price,
                    image: getImageUrl(item.productId.images),
                    stock: item.productId.inventory?.quantity || 0,
                    sellerId: item.productId.sellerId
                },
                quantity: item.quantity,
                sellerId: {
                    _id: item.sellerId._id,
                    businessName: item.sellerId.businessName,
                    email: item.sellerId.email
                },
                price: item.price,
                subtotal: item.price * item.quantity,
                variantId: item.variantId || null,
                variantLabel: item.variantLabel || null,
                variantImage: item.variantImage || null,
                addedAt: item.addedAt
            })),
            summary: {
                totalItems,
                totalQuantity,
                subtotal,
                tax,
                totalPrice,
                bySeller: Object.values(bySeller)
            },
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                currentPage: page,
                limit
            }
        };
    }

    /**
     * Clear entire cart
     */
    async clearCart(userId) {
        const result = await MarketCart.updateMany(
            { userId, isDeleted: false },
            { isDeleted: true }
        );

        return {
            message: 'Cart cleared successfully',
            cartItemsRemoved: result.modifiedCount
        };
    }

    /**
     * Remove multiple items from cart
     */
    async removeMultipleItems(userId, cartItemIds) {
        if (!Array.isArray(cartItemIds) || cartItemIds.length === 0) {
            throw { status: 400, message: 'Invalid cart item IDs' };
        }

        const result = await MarketCart.updateMany(
            {
                _id: { $in: cartItemIds },
                userId,
                isDeleted: false
            },
            { isDeleted: true }
        );

        return {
            message: 'Items removed from cart',
            removedCount: result.modifiedCount
        };
    }

    /**
     * Get cart item count
     */
    async getCartCount(userId) {
        const cartCount = await MarketCart.countDocuments({
            userId,
            isDeleted: false
        });

        const totalQuantity = await MarketCart.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId), isDeleted: false } },
            { $group: { _id: null, total: { $sum: '$quantity' } } }
        ]);

        return {
            cartCount,
            totalQuantity: totalQuantity.length > 0 ? totalQuantity[0].total : 0
        };
    }

    /**
     * Check if product is in cart
     */
    async checkInCart(userId, productId) {
        const item = await MarketCart.findOne({
            userId,
            productId,
            isDeleted: false
        });

        if (item) {
            return {
                inCart: true,
                cartItemId: item._id,
                quantity: item.quantity
            };
        }

        return { inCart: false };
    }

    /**
     * Get cart for checkout (validate stock before checkout)
     */
    async getCartForCheckout(userId) {
        const cartItems = await MarketCart.find({
            userId,
            isDeleted: false
        })
            .populate({
                path: 'productId',
                select: 'name price images inventory sellerId'
            })
            .populate('sellerId', 'businessName email _id')
            .lean();

        if (cartItems.length === 0) {
            throw { status: 400, message: 'Cart is empty' };
        }

        // Validate stock for all items
        for (const item of cartItems) {
            if (item.productId.inventory.quantity < item.quantity) {
                throw { 
                    status: 409, 
                    message: `Insufficient stock for ${item.productId.name}`,
                    product: item.productId.name,
                    available: item.productId.inventory.quantity,
                    requested: item.quantity
                };
            }
        }

        // Helper function to extract image URL from images array
        const getImageUrl = (images) => {
            if (!images || images.length === 0) return null;
            const defaultImage = images.find(img => img.isDefault);
            return defaultImage ? defaultImage.url : (images[0]?.url || null);
        };

        // Transform items to ensure image returns proper URL or null
        return cartItems.map(item => ({
            _id: item._id,
            userId: item.userId,
            productId: {
                _id: item.productId._id,
                name: item.productId.name,
                price: item.productId.price,
                image: getImageUrl(item.productId.images),
                stock: item.productId.inventory?.quantity || 0,
                sellerId: item.productId.sellerId
            },
            quantity: item.quantity,
            sellerId: {
                _id: item.sellerId._id,
                businessName: item.sellerId.businessName,
                email: item.sellerId.email
            },
            price: item.price,
            addedAt: item.addedAt
        }));
    }

    /**
     * Clear cart after successful order
     */
    async clearCartAfterOrder(userId, productIds) {
        const result = await MarketCart.updateMany(
            {
                userId,
                productId: { $in: productIds },
                isDeleted: false
            },
            { isDeleted: true }
        );

        return result.modifiedCount;
    }
}

module.exports = new CartService();
