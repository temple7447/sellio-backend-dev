const MarketProduct = require('../models/MarketProduct');
const MarketCategory = require('../models/MarketCategory');
const { MarketUser } = require('../models/MarketUser');
const { uploadToCloudinary } = require('../utils/cloudinary');
const mongoose = require('mongoose');
const MarketOrder = require('../models/MarketOrder');
const MarketRecentlyViewed = require('../models/MarketRecentlyViewed');
const MarketOrderItem = require('../models/MarketOrderItem');
const discordLogger = require('../utils/discordLogger');
const RewardSettings = require('../models/RewardSettings');

/**
 * Given a seller-entered price and the current pricing tiers, return the
 * buyer-facing price (seller price + platform fee) and the fee details.
 */
async function applyPlatformFee(sellerPrice) {
    try {
        const settings = await RewardSettings.getSettings();
        const tiers = settings.pricingFees || [];
        const tier = tiers.find(
            (t) => sellerPrice >= t.minPrice && (t.maxPrice == null || sellerPrice <= t.maxPrice)
        );
        if (!tier || tier.feePercent === 0) {
            return { buyerPrice: sellerPrice, sellerPrice, feePercent: 0, feeAmount: 0 };
        }
        const feeAmount = Math.round(sellerPrice * (tier.feePercent / 100));
        return {
            buyerPrice: sellerPrice + feeAmount,
            sellerPrice,
            feePercent: tier.feePercent,
            feeAmount,
        };
    } catch {
        // If fee lookup fails, fall back to no fee so product creation isn't blocked
        return { buyerPrice: sellerPrice, sellerPrice, feePercent: 0, feeAmount: 0 };
    }
}

class ProductService {
    async createProduct(sellerId, productData, files) {
        try {
            // Validate all required fields
            const requiredFields = ['name', 'description', 'price', 'category'];
            for (const field of requiredFields) {
                if (!productData[field]) {
                    throw {
                        status: 400,
                        message: `Missing required field: ${field}`
                    };
                }
            }

            // Validate and parse price (handle both nested and flattened structures)
            const price = {
                current: parseFloat(productData['price.current'] || (productData.price && productData.price.current) || productData.price) || 0,
                discount: parseFloat(productData['price.discount'] || (productData.price && productData.price.discount) || productData.discount) || 0
            };

            if (price.current <= 0) {
                throw { status: 400, message: 'Price must be greater than 0' };
            }

            if (price.discount < 0 || price.discount > 100) {
                throw { status: 400, message: 'Discount must be between 0 and 100' };
            }

            // Validate and parse inventory (handle both nested and flattened structures)
            const inventory = {
                quantity: parseInt(productData['inventory.quantity'] || (productData.inventory && productData.inventory.quantity) || productData.initialInventory) || 0,
                lowStockAlert: parseInt(productData['inventory.lowStockAlert'] || (productData.inventory && productData.inventory.lowStockAlert) || productData.lowStockAlert) || 5
            };

            // Only add SKU if provided
            if (productData.sku && productData.sku.trim()) {
                if (!/^[A-Za-z0-9-_]+$/.test(productData.sku)) {
                    throw {
                        status: 400,
                        message: 'SKU must contain only letters, numbers, hyphens and underscores'
                    };
                }
                // Check if SKU already exists
                const existingSku = await MarketProduct.findOne({ 'inventory.sku': productData.sku });
                if (existingSku) {
                    throw {
                        status: 400,
                        message: 'This SKU is already in use'
                    };
                }
                inventory.sku = productData.sku.trim();
            }

            // Handle image upload
            const imageUrls = [];
            if (!files || files.length === 0) {
                throw { status: 400, message: 'At least one product image is required' };
            }

            if (files.length > 5) {
                throw { status: 400, message: 'Maximum 5 images allowed per product' };
            }

            for (const file of files) {
                const result = await uploadToCloudinary(file, 'products');
                if (!result || !result.secure_url) {
                    throw { status: 500, message: 'Failed to upload image' };
                }
                imageUrls.push({
                    url: result.secure_url,
                    isDefault: imageUrls.length === 0
                });
            }

            // Process category
            let category;
            const categoryId = productData.category;

            if (mongoose.Types.ObjectId.isValid(categoryId)) {
                category = await MarketCategory.findById(categoryId);
            } else {
                category = await MarketCategory.findOne({
                    name: { $regex: new RegExp(`^${productData.category}$`, 'i') }
                });
            }

            if (!category) {
                throw {
                    status: 400,
                    message: `Category not found: ${productData.category}`
                };
            }

            // Apply platform fee: buyer pays seller_price + fee; seller earns seller_price
            const feeResult = await applyPlatformFee(price.current);

            // Create and save the product
            const product = new MarketProduct({
                name: productData.name,
                description: productData.description,
                price: {
                    current: feeResult.buyerPrice,   // what the buyer sees / pays
                    sellerPrice: feeResult.sellerPrice, // what the seller entered / earns
                    discount: price.discount
                },
                category: category._id,
                brand: productData.brand,
                inventory,  // Use the validated inventory object
                images: imageUrls,
                sellerId,
                status: productData.status || 'draft'
            });

            const savedProduct = await product.save();

            discordLogger.productLog('Created', savedProduct._id, productData.name, {
                price: price.current,
                category: category.name,
                sellerId: sellerId
            });

            // Return populated product
            return await MarketProduct.findById(savedProduct._id)
                .populate('category', 'name')
                .populate('sellerId', 'businessName isTrustedSeller');

        } catch (error) {
            console.error('Product creation error:', error);

            // Handle duplicate key errors
            if (error.code === 11000) {
                throw {
                    status: 400,
                    message: 'A product with this SKU already exists'
                };
            }

            // Handle mongoose validation errors
            if (error.name === 'ValidationError') {
                throw {
                    status: 400,
                    message: Object.values(error.errors)
                        .map(err => err.message)
                        .join(', ')
                };
            }

            // Handle known errors
            if (error.status) {
                throw error;
            }

            // Handle unknown errors
            throw {
                status: 500,
                message: 'Failed to create product. Please try again.'
            };
        }
    }

    async getSellerProducts(sellerId, query = {}) {
        const { page = 1, limit = 10, status, sort = '-createdAt', search } = query;
        const skip = (page - 1) * limit;

        const filter = { sellerId };
        
        if (status && status !== 'all') {
            filter.status = status;
        }

        // Expanded search across multiple product fields
        if (search) {
            const searchRegex = { $regex: search, $options: 'i' };
            filter.$or = [
                { name: searchRegex },              // Product name
                { description: searchRegex },       // Product description
                { brand: searchRegex },             // Brand
                { 'inventory.sku': searchRegex },   // SKU code
                { slug: searchRegex }               // Product slug
            ];
        }

        try {
            const [products, total] = await Promise.all([
                MarketProduct.find(filter)
                    .populate('category', 'name')
                    .populate('sellerId', 'businessName isTrustedSeller')
                    .skip(skip)
                    .limit(limit)
                    .sort(sort),
                MarketProduct.countDocuments(filter)
            ]);

            return {
                products,
                pagination: {
                    total,
                    pages: Math.ceil(total / limit),
                    currentPage: parseInt(page),
                    limit: parseInt(limit)
                }
            };
        } catch (error) {
            throw new Error(`Failed to fetch seller products: ${error.message}`);
        }
    }

    async getPublicProducts(query) {
        // Log incoming request parameters
        console.log('\n🔍 Public Products Search Request:', {
            timestamp: new Date().toISOString(),
            parameters: query
        });

        const {
            page: _page = 1,
            limit: _limit = 10,
            category,
            search,
            sort = 'newest',
            minPrice,
            maxPrice,
            brands,
            minRating
        } = query;

        const page = parseInt(_page, 10) || 1;
        const limit = parseInt(_limit, 10) || 10;

        // Handle sort options
        let sortOptions = {};
        switch (sort) {
            case 'price_low':
                sortOptions = { 'price.current': 1 };
                break;
            case 'price_high':
                sortOptions = { 'price.current': -1 };
                break;
            case 'rating':
                sortOptions = {
                    'metadata.rating.average': -1,
                    'metadata.rating.count': -1
                };
                break;
            case 'popular':
                sortOptions = { 'metadata.views': -1 };
                break;
            case 'oldest':
                sortOptions = { createdAt: 1 };
                break;
            case 'newest':
            default:
                sortOptions = { createdAt: -1 };
                break;
        }

        // Build filter
        const filter = { status: 'active' };

        // Handle category filter
        if (category) {
            if (mongoose.Types.ObjectId.isValid(category) && /^[0-9a-fA-F]{24}$/.test(category)) {
                filter.category = category;
            } else {
                // Find category by name or slug
                const categoryDoc = await MarketCategory.findOne({
                    $or: [
                        { name: { $regex: new RegExp(`^${category}$`, 'i') } },
                        { slug: category.toLowerCase() }
                    ]
                });
                if (categoryDoc) {
                    filter.category = categoryDoc._id;
                } else {
                    // Return empty results if category not found
                    return {
                        products: [],
                        pagination: {
                            total: 0,
                            pages: 0,
                            currentPage: page,
                            limit
                        }
                    };
                }
            }
        }

        // Add other filters - BROAD SEARCH across multiple fields
        if (search) {
            const searchRegex = { $regex: search, $options: 'i' };
            const searchConditions = [];

            // Direct product field searches
            searchConditions.push(
                { name: searchRegex },                    // Product name
                { description: searchRegex },             // Product description
                { brand: searchRegex },                   // Brand/manufacturer
                { 'inventory.sku': searchRegex },         // SKU/product code
                { slug: searchRegex }                     // Product URL slug
            );

            // Search by seller business name
            const matchingSellers = await MarketUser.find({
                $or: [
                    { businessName: searchRegex },        // Seller business name
                    { fullName: searchRegex },            // Seller full name
                    { email: searchRegex }                // Seller email
                ],
                role: 'seller'
            }).select('_id');
            if (matchingSellers.length > 0) {
                searchConditions.push({ 
                    sellerId: { $in: matchingSellers.map(s => s._id) } 
                });
            }

            // Search by category name and slug
            const matchingCategories = await MarketCategory.find({
                $or: [
                    { name: searchRegex },                // Category name
                    { slug: searchRegex }                 // Category URL slug
                ]
            }).select('_id');
            if (matchingCategories.length > 0) {
                searchConditions.push({ 
                    category: { $in: matchingCategories.map(c => c._id) } 
                });
            }

            // Apply OR conditions - find products matching ANY of the search criteria
            filter.$or = searchConditions;
        }
        if (minPrice || maxPrice) {
            filter['price.current'] = {};
            if (minPrice) filter['price.current'].$gte = parseFloat(minPrice);
            if (maxPrice) filter['price.current'].$lte = parseFloat(maxPrice);
        }

        // Brand filter (sellers) - supports multiple brands
        if (brands) {
            const brandArray = Array.isArray(brands) ? brands : brands.split(',');
            // Find sellers by businessName
            const sellers = await MarketUser.find({
                businessName: { $in: brandArray.map(b => new RegExp(`^${b.trim()}$`, 'i')) },
                role: 'seller'
            }).select('_id');

            if (sellers.length > 0) {
                filter.sellerId = { $in: sellers.map(s => s._id) };
            } else {
                // Return empty results if no sellers found
                return {
                    products: [],
                    pagination: {
                        total: 0,
                        pages: 0,
                        currentPage: page,
                        limit
                    }
                };
            }
        }

        // Rating filter
        if (minRating) {
            filter['metadata.rating.average'] = { $gte: parseFloat(minRating) };
        }

        // Get ALL products matching the filter (without pagination) to shuffle across entire platform
        const allProducts = await MarketProduct.find(filter)
            .populate('category', 'name')
            .populate('sellerId', 'businessName isTrustedSeller')
            .sort(sortOptions)
            .lean(); // Use lean() for better performance with large datasets

        // Get total count
        const total = allProducts.length;

        // Shuffling behavior:
        // By default, we shuffle to provide discovery across the platform.
        // HOWEVER, if the user explicitly requested a specific sort (e.g. price, rating, popularity),
        // we MUST respect that sort and DISABLLE shuffling.
        let finalProducts = [...allProducts];
        const isDefaultSort = !query.sort || query.sort === 'newest' || query.sort === 'random';

        if (isDefaultSort) {
            finalProducts = this.shuffleArray(finalProducts);
        }

        // Apply pagination to the results
        const skip = (page - 1) * limit;
        const paginatedProducts = finalProducts.slice(skip, skip + limit);

        const response = {
            products: paginatedProducts,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        };

        // Log response summary
        console.log('✅ Public Products Response:', {
            timestamp: new Date().toISOString(),
            productsCount: paginatedProducts.length,
            totalProducts: total,
            filters: { category, search, minPrice, maxPrice, brands, minRating, sort },
            pagination: response.pagination
        });

        return response;
    }


    async updateProduct(productId, sellerId, updates, files = null) {
        const product = await MarketProduct.findOne({ _id: productId, sellerId });

        if (!product) {
            throw { status: 404, message: 'Product not found' };
        }

        const allowedFields = ['name', 'description', 'price', 'discount', 'images'];

        const filteredUpdates = {};
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = updates[key];
            }
        }

        if (files && files.length > 0) {
            const uploadToCloudinary = require('../utils/cloudinary').uploadToCloudinary;
            const imageUploads = await Promise.all(
                files.map(async (file) => {
                    const result = await uploadToCloudinary(file, 'products');
                    return {
                        url: result.secure_url,
                        publicId: result.public_id,
                        isDefault: false
                    };
                })
            );

            const existingImages = product.images || [];
            const newImages = [...existingImages, ...imageUploads];
            filteredUpdates.images = newImages;
        }

        // Re-apply platform fee whenever the price is updated
        if (filteredUpdates.price && filteredUpdates.price.current != null) {
            const rawSellerPrice = filteredUpdates.price.current;
            const feeResult = await applyPlatformFee(rawSellerPrice);
            filteredUpdates.price = {
                ...filteredUpdates.price,
                current: feeResult.buyerPrice,
                sellerPrice: feeResult.sellerPrice,
            };
        }

        Object.assign(product, filteredUpdates);
        const updatedProduct = await product.save();

        discordLogger.productLog('Updated', productId, product.name, {
            updatedFields: Object.keys(filteredUpdates).join(', '),
            sellerId: sellerId
        });

        return updatedProduct;
    }

    async migrateProductPrices() {
        // Find all products where sellerPrice has never been set (pre-fee-system products)
        const legacy = await MarketProduct.find({
            'price.sellerPrice': { $exists: false },
            status: { $in: ['active', 'inactive', 'draft'] }
        }).lean();

        if (legacy.length === 0) {
            return { updated: 0, skipped: 0, errors: 0, total: 0, details: [] };
        }

        // Fetch settings once for all products instead of once per product
        const settings = await RewardSettings.getSettings();
        const tiers = settings.pricingFees || [];

        const applyFee = (sellerPrice) => {
            const tier = tiers.find(
                (t) => sellerPrice >= t.minPrice && (t.maxPrice == null || sellerPrice <= t.maxPrice)
            );
            if (!tier) return { buyerPrice: sellerPrice, sellerPrice, feePercent: 0, feeAmount: 0 };
            const feeAmount = Math.round(sellerPrice * (tier.feePercent / 100));
            return { buyerPrice: sellerPrice + feeAmount, sellerPrice, feePercent: tier.feePercent, feeAmount };
        };

        let updated = 0, skipped = 0, errors = 0;
        const details = [];

        for (const product of legacy) {
            try {
                const originalPrice = product.price?.current;
                if (!originalPrice || originalPrice <= 0) {
                    skipped++;
                    continue;
                }

                const feeResult = applyFee(originalPrice);

                await MarketProduct.updateOne(
                    { _id: product._id },
                    {
                        $set: {
                            'price.current': feeResult.buyerPrice,
                            'price.sellerPrice': feeResult.sellerPrice,
                        }
                    }
                );

                details.push({
                    productId: product._id,
                    name: product.name,
                    sellerPrice: feeResult.sellerPrice,
                    buyerPrice: feeResult.buyerPrice,
                    feePercent: feeResult.feePercent,
                    feeAmount: feeResult.feeAmount,
                });
                updated++;
            } catch (err) {
                errors++;
                console.error(`Migration failed for product ${product._id}:`, err.message);
            }
        }

        return { updated, skipped, errors, total: legacy.length, details };
    }

    async deleteProduct(productId, sellerId) {
        try {
            // Check for valid MongoDB ObjectId
            if (!mongoose.Types.ObjectId.isValid(productId)) {
                throw {
                    status: 400,
                    code: 'INVALID_ID',
                    message: 'Invalid product ID format'
                };
            }

            // Find product and check seller ownership
            const product = await MarketProduct.findOne({
                _id: productId,
                sellerId: sellerId
            });

            if (!product) {
                throw {
                    status: 404,
                    code: 'NOT_FOUND',
                    message: 'Product not found or you do not have permission to delete it'
                };
            }

            // Check if product has any active orders
            const hasActiveOrders = await MarketOrder.exists({
                'items.productId': productId,
                status: { $in: ['pending', 'processing', 'shipped'] }
            });

            if (hasActiveOrders) {
                throw {
                    status: 400,
                    code: 'ACTIVE_ORDERS',
                    message: 'Cannot delete product with active orders'
                };
            }

            // Store product details before deletion for response
            const productDetails = {
                id: product._id,
                name: product.name,
                deletedAt: new Date()
            };

            // Delete the product from database
            await MarketProduct.deleteOne({ _id: productId });

            return {
                success: true,
                message: 'Product permanently deleted successfully',
                data: productDetails
            };
        } catch (error) {
            // Log the full error for debugging
            console.error('Product deletion error:', {
                error,
                stack: error.stack,
                productId,
                sellerId
            });

            // Handle known errors
            if (error.code) {
                throw error;
            }

            // Handle MongoDB errors
            if (error.name === 'MongoError') {
                throw {
                    status: 500,
                    code: 'DB_ERROR',
                    message: 'Database operation failed'
                };
            }

            // Handle unexpected errors
            throw {
                status: 500,
                code: 'UNKNOWN_ERROR',
                message: 'Failed to delete product',
                details: error.message
            };
        }
    }

    async getProductById(productId) {
        // Add validation for ObjectId
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            throw {
                status: 400,
                message: 'Invalid product ID format'
            };
        }

        const product = await MarketProduct.findById(productId)
            .populate('category', 'name')
            .populate('sellerId', 'businessName isTrustedSeller');

        if (!product) {
            throw { status: 404, message: 'Product not found' };
        }

        // Increment view count
        product.metadata.views += 1;
        await product.save();

        return product;
    }

    async getPublicProductById(productId) {
        const product = await MarketProduct.findOne({
            _id: productId,
            status: 'active'
        })
            .populate('category', 'name')
            .populate('sellerId', 'businessName isTrustedSeller');

        if (!product) {
            throw { status: 404, message: 'Product not found' };
        }

        // Increment view count
        product.metadata.views += 1;
        await product.save();

        return product;
    }

    async getRelatedProducts(productId, limit = 4) {
        const product = await MarketProduct.findById(productId);
        if (!product) {
            throw { status: 404, message: 'Product not found' };
        }

        // Find products in the same category, excluding the current product
        const relatedProducts = await MarketProduct.find({
            _id: { $ne: productId },
            category: product.category,
            status: 'active'
        })
            .populate('category', 'name')
            .populate('sellerId', 'businessName isTrustedSeller')
            .limit(limit)
            .sort('-metadata.views');  // Sort by most viewed

        return relatedProducts;
    }

    async getOtherProductsBySeller(productId, sellerId, limit = 4) {
        // Find products by the same seller, excluding current product
        const products = await MarketProduct.find({
            _id: { $ne: productId },
            sellerId: sellerId,
            status: 'active'
        })
            .populate('category', 'name')
            .populate('sellerId', 'businessName isTrustedSeller')
            .limit(limit)
            .sort('-createdAt');

        return products;
    }

    async getPublicSellerProducts(sellerId, query = {}) {
        const {
            page: _page = 1,
            limit: _limit = 12,
            excludeProduct,
            sort = '-createdAt'
        } = query;

        const page = parseInt(_page, 10) || 1;
        const limit = parseInt(_limit, 10) || 12;

        // Check if seller exists and is verified
        const seller = await MarketUser.findOne({
            _id: sellerId,
            role: 'seller',
            isVerified: true,
            adminVerified: true
        });

        if (!seller) {
            throw { status: 404, message: 'Seller not found' };
        }

        // Build filter
        const filter = {
            sellerId,
            status: 'active'
        };

        // Exclude specific product if provided
        if (excludeProduct) {
            filter._id = { $ne: excludeProduct };
        }

        // Get all matching products first so we can shuffle across the entire seller catalog
        const allProducts = await MarketProduct.find(filter)
            .populate('category', 'name')
            .populate('sellerId', 'businessName isTrustedSeller')
            .sort(sort)
            .lean();

        const total = allProducts.length;

        // Shuffle seller products globally, then apply pagination
        const shuffledAllProducts = this.shuffleArray(allProducts);
        const skip = (page - 1) * limit;
        const paginatedProducts = shuffledAllProducts.slice(skip, skip + limit);

        return {
            seller: {
                businessName: seller.businessName,
                businessAddress: seller.businessAddress,
                isTrustedSeller: seller.isTrustedSeller || false
            },
            products: paginatedProducts,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        };
    }

    async getSellerDashboardStats(sellerId) {
        const MarketOrderItem = require('../models/MarketOrderItem');
        const sellerObjId = new mongoose.Types.ObjectId(sellerId);

        // Total earnings — use sellerPrice (what the seller actually earns after platform fee)
        const salesAgg = await MarketOrderItem.aggregate([
            { $match: { sellerId: sellerObjId } },
            {
                $lookup: {
                    from: 'marketorders',
                    localField: 'orderId',
                    foreignField: '_id',
                    as: 'order'
                }
            },
            { $unwind: '$order' },
            { $match: { 'order.payment.status': 'completed' } },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $multiply: [{ $ifNull: ['$sellerPrice', '$price'] }, '$quantity'] } }
                }
            }
        ]);

        // Count unique orders for this seller
        const orderIds = await MarketOrderItem.distinct('orderId', { sellerId: sellerObjId });

        // Count unique customers across those orders
        const uniqueCustomersAgg = await MarketOrder.aggregate([
            { $match: { _id: { $in: orderIds } } },
            { $group: { _id: { $cond: [{ $ifNull: ['$customerId', false] }, '$customerId', '$guestEmail'] } } },
            { $count: 'total' }
        ]);

        const totalSales = salesAgg[0]?.total || 0;
        const totalProducts = await MarketProduct.countDocuments({ sellerId });
        const totalOrders = orderIds.length;
        const totalCustomers = uniqueCustomersAgg[0]?.total || 0;

        return {
            totalSales,
            totalOrders,
            totalProducts,
            totalCustomers
        };
    }

    async updateProductStatus(productId, sellerId, status) {
        try {
            const validStatuses = ['draft', 'active', 'inactive'];
            if (!validStatuses.includes(status)) {
                throw {
                    status: 400,
                    message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                };
            }

            const product = await MarketProduct.findOne({
                _id: productId,
                sellerId
            });

            if (!product) {
                throw { status: 404, message: 'Product not found' };
            }

            product.status = status;
            await product.save();

            return {
                id: product._id,
                name: product.name,
                status: product.status,
                updatedAt: product.updatedAt
            };
        } catch (error) {
            throw {
                status: error.status || 500,
                message: error.message
            };
        }
    }

    async getPopularProducts(limit = 4) {
        try {
            // Get products sorted by rating, views and sales
            const products = await MarketProduct.find({
                status: 'active',
                'metadata.rating.count': { $gt: 0 } // Only products with ratings
            })
                .populate('category', 'name')
                .populate('sellerId', 'businessName isTrustedSeller')
                .sort({
                    'metadata.rating.average': -1, // Highest rated first
                    'metadata.sales': -1,         // Most sales second
                    'metadata.views': -1          // Most viewed third
                })
                .limit(limit);

            // Format response with badges and labels
            const formattedProducts = products.map(product => ({
                id: product._id,
                name: product.name,
                slug: product.slug,
                description: product.description,
                price: {
                    current: product.price.current,
                    discount: product.price.discount || 0,
                    compareAt: product.price.compareAt
                },
                category: {
                    id: product.category._id,
                    name: product.category.name
                },
                seller: {
                    id: product.sellerId._id,
                    businessName: product.sellerId.businessName,
                    isTrustedSeller: product.sellerId.isTrustedSeller || false
                },
                rating: product.metadata.rating,
                badge: this.getProductBadge(product),
                image: product.images.find(img => img.isDefault)?.url || product.images[0]?.url,
                inventory: {
                    quantity: product.inventory?.quantity ?? 0,
                    lowStockAlert: product.inventory?.lowStockAlert ?? 5
                },
                stats: {
                    sales: product.metadata.sales,
                    views: product.metadata.views
                }
            }));

            return {
                products: formattedProducts,
                total: formattedProducts.length
            };
        } catch (error) {
            throw {
                status: 500,
                message: 'Failed to fetch popular products',
                error: error.message
            };
        }
    }

    getProductBadge(product) {
        if (product.metadata.sales > 100) return 'Best Seller';
        if (product.metadata.rating.average >= 4.5) return 'Top Rated';
        if (product.price.discount > 20) return 'On Sale';
        if (new Date() - product.createdAt < 1000 * 60 * 60 * 24 * 7) return 'New Arrival';
        return null;
    }

    async getTrendingProducts(limit = 4) {
        try {
            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            // Get products sorted by recent views, sales and ratings
            const products = await MarketProduct.find({
                status: 'active',
                updatedAt: { $gte: oneWeekAgo }
            })
                .populate('category', 'name')
                .populate('sellerId', 'businessName isTrustedSeller')
                .sort({
                    'metadata.views': -1,       // Most viewed first
                    'metadata.sales': -1,       // Most sales second
                    'metadata.rating.average': -1 // Highest rated third
                })
                .limit(limit);

            // Format and enrich response
            const formattedProducts = products.map(product => ({
                id: product._id,
                name: product.name,
                slug: product.slug,
                description: product.description,
                price: {
                    current: product.price.current,
                    discount: product.price.discount || 0,
                    compareAt: product.price.compareAt
                },
                category: {
                    id: product.category._id,
                    name: product.category.name
                },
                seller: {
                    id: product.sellerId._id,
                    businessName: product.sellerId.businessName,
                    isTrustedSeller: product.sellerId.isTrustedSeller || false
                },
                image: product.images.find(img => img.isDefault)?.url || product.images[0]?.url,
                badge: this.getTrendingBadge(product),
                // Parity with the popular feed so cards can show stock state.
                inventory: {
                    quantity: product.inventory?.quantity ?? 0,
                    lowStockAlert: product.inventory?.lowStockAlert ?? 5
                },
                stats: {
                    rating: product.metadata.rating,
                    views: product.metadata.views,
                    sales: product.metadata.sales
                },
                trending: {
                    isHot: product.metadata.views > 1000,
                    isTrending: product.metadata.sales > 50,
                    lastUpdated: product.updatedAt
                }
            }));

            return {
                products: formattedProducts,
                total: formattedProducts.length
            };
        } catch (error) {
            throw {
                status: 500,
                message: 'Failed to fetch trending products',
                error: error.message
            };
        }
    }

    // Helper method for trending badges
    getTrendingBadge(product) {
        if (product.metadata.views > 1000) return 'Hot';
        if (product.metadata.sales > 50) return 'Trending';
        if (Date.now() - product.createdAt < 1000 * 60 * 60 * 24 * 3) return 'New';
        if (product.price.discount > 25) return 'Best Deal';
        return null;
    }

    // Helper method to shuffle array (Fisher-Yates algorithm)
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // Whether a product's flash deal is currently running.
    isDealLive(product) {
        const deal = product && product.deal;
        if (!deal || !deal.active) return false;
        if (!(product.price && product.price.discount > 0)) return false;
        const now = Date.now();
        if (deal.startsAt && now < new Date(deal.startsAt).getTime()) return false;
        if (deal.endsAt && now > new Date(deal.endsAt).getTime()) return false;
        if (deal.stockLimit != null && (deal.soldCount || 0) >= deal.stockLimit) return false;
        return true;
    }

    // GET /products/deals — active, in-window flash sales, soonest-ending first.
    async getDeals(query = {}) {
        const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
        const now = new Date();

        const candidates = await MarketProduct.find({
            status: 'active',
            'deal.active': true,
            'price.discount': { $gt: 0 },
            $and: [
                { $or: [{ 'deal.startsAt': { $exists: false } }, { 'deal.startsAt': null }, { 'deal.startsAt': { $lte: now } }] },
                { $or: [{ 'deal.endsAt': { $exists: false } }, { 'deal.endsAt': null }, { 'deal.endsAt': { $gte: now } }] },
            ],
        })
            .populate('category', 'name')
            .populate('sellerId', 'businessName isTrustedSeller')
            .sort({ 'deal.endsAt': 1 })
            .lean();

        // Final guard for the stock cap (can't express cleanly in the query).
        const products = candidates
            .filter((p) => p.deal.stockLimit == null || (p.deal.soldCount || 0) < p.deal.stockLimit)
            .slice(0, limit);

        return { products, total: products.length };
    }

    // GET /products/suggestions?q= — lightweight typeahead for the search box.
    // Returns category, brand and product-name matches (products carry an image
    // + id so the UI can deep-link straight to the product).
    async getSearchSuggestions(query = {}) {
        const q = (query.q || '').trim();
        if (q.length < 1) return { suggestions: [] };

        const limit = Math.min(Math.max(parseInt(query.limit, 10) || 8, 1), 20);
        const regex = { $regex: q, $options: 'i' };

        const imageUrl = (images) => {
            if (!images || images.length === 0) return null;
            return (images.find((i) => i.isDefault) || images[0]).url || null;
        };

        const [products, categories] = await Promise.all([
            MarketProduct.find({ status: 'active', $or: [{ name: regex }, { brand: regex }] })
                .select('name brand images metadata.views')
                .sort('-metadata.views')
                .limit(limit)
                .lean(),
            MarketCategory.find({ name: regex }).select('name').limit(3).lean(),
        ]);

        const suggestions = [];
        const seen = new Set();

        for (const c of categories) {
            const key = `c:${c.name.toLowerCase()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            suggestions.push({ type: 'category', text: c.name });
        }

        for (const p of products) {
            const key = `p:${String(p._id)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            suggestions.push({
                type: 'product',
                text: p.name,
                productId: p._id,
                image: imageUrl(p.images),
            });
        }

        return { suggestions: suggestions.slice(0, limit + 3) };
    }

    // Record (or refresh) a signed-in user's view of a product.
    async recordProductView(userId, productId) {
        if (!userId || !mongoose.Types.ObjectId.isValid(productId)) return;
        await MarketRecentlyViewed.findOneAndUpdate(
            { userId, productId },
            { $set: { viewedAt: new Date() } },
            { upsert: true, new: true }
        );
    }

    // GET /products/recently-viewed — newest first.
    async getRecentlyViewed(userId, query = {}) {
        const limit = Math.min(Math.max(parseInt(query.limit, 10) || 12, 1), 50);
        const rows = await MarketRecentlyViewed.find({ userId })
            .sort('-viewedAt')
            .limit(limit)
            .lean();

        const ids = rows.map((r) => r.productId);
        if (ids.length === 0) return { products: [], total: 0 };

        const products = await MarketProduct.find({ _id: { $in: ids }, status: 'active' })
            .populate('category', 'name')
            .populate('sellerId', 'businessName isTrustedSeller')
            .lean();

        // Preserve recency order (find() doesn't honour the $in order).
        const byId = new Map(products.map((p) => [String(p._id), p]));
        const ordered = ids.map((id) => byId.get(String(id))).filter(Boolean);
        return { products: ordered, total: ordered.length };
    }

    // GET /products/for-you — personalised from the user's viewed + ordered
    // categories, with a trending fallback for new users.
    async getForYou(userId, query = {}) {
        const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 50);

        // Seed products = recently viewed + previously ordered.
        const recents = await MarketRecentlyViewed.find({ userId }).sort('-viewedAt').limit(40).lean();
        const recentIds = recents.map((r) => String(r.productId));

        const myOrders = await MarketOrder.find({ customerId: userId }).select('_id').lean();
        const orderItemDocs = myOrders.length
            ? await MarketOrderItem.find({ orderId: { $in: myOrders.map((o) => o._id) } }).select('productId').lean()
            : [];
        const orderedIds = orderItemDocs.map((i) => String(i.productId));

        const seedIds = [...new Set([...recentIds, ...orderedIds])];

        const populate = (q) => q
            .populate('category', 'name')
            .populate('sellerId', 'businessName isTrustedSeller');

        let products = [];
        if (seedIds.length > 0) {
            const seeds = await MarketProduct.find({ _id: { $in: seedIds } }).select('category').lean();
            const categoryIds = [...new Set(seeds.map((p) => String(p.category)).filter(Boolean))];

            if (categoryIds.length > 0) {
                const candidates = await populate(MarketProduct.find({
                    status: 'active',
                    category: { $in: categoryIds },
                    _id: { $nin: seedIds },
                }))
                    .sort({ 'metadata.rating.average': -1, 'metadata.views': -1 })
                    .limit(limit * 2)
                    .lean();
                products = this.shuffleArray(candidates).slice(0, limit);
            }
        }

        // Top up (or fully populate for new users) with popular active products.
        if (products.length < limit) {
            const exclude = [...seedIds, ...products.map((p) => String(p._id))];
            const fill = await populate(MarketProduct.find({
                status: 'active',
                _id: { $nin: exclude },
            }))
                .sort('-metadata.views')
                .limit(limit - products.length)
                .lean();
            products = [...products, ...fill];
        }

        return { products, total: products.length };
    }

}

module.exports = new ProductService();
