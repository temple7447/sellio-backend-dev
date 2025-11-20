const MarketProduct = require('../models/MarketProduct');
const MarketCategory = require('../models/MarketCategory');
const { MarketUser } = require('../models/MarketUser');
const { uploadToCloudinary } = require('../utils/cloudinary');
const mongoose = require('mongoose');
const MarketOrder = require('../models/MarketOrder');

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

            // Validate and parse price
            const price = {
                current: parseFloat(productData.price) || 0,
                discount: parseFloat(productData.discount) || 0
            };

            if (price.current <= 0) {
                throw { status: 400, message: 'Price must be greater than 0' };
            }

            if (price.discount < 0 || price.discount > 100) {
                throw { status: 400, message: 'Discount must be between 0 and 100' };
            }

            // Validate inventory
            const inventory = {
                quantity: parseInt(productData.initialInventory) || 0,
                lowStockAlert: parseInt(productData.lowStockAlert) || 5
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

            // Create and save the product
            const product = new MarketProduct({
                name: productData.name,
                description: productData.description,
                price: {
                    current: price.current,
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
            
            // Return populated product
            return await MarketProduct.findById(savedProduct._id)
                .populate('category', 'name')
                .populate('sellerId', 'businessName');

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
        const { page = 1, limit = 10, status, sort = '-createdAt' } = query;
        const skip = (page - 1) * limit;

        const filter = { sellerId };
        if (status && status !== 'all') {
            filter.status = status;
        }

        try {
            const [products, total] = await Promise.all([
                MarketProduct.find(filter)
                    .populate('category', 'name')
                    .populate('sellerId', 'businessName')
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
                    currentPage: page,
                    limit
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
            page = 1, 
            limit = 10, 
            category, 
            search,
            sort = 'newest',
            minPrice,
            maxPrice,
            brands,
            minRating
        } = query;
        
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

        const skip = (page - 1) * limit;

        // Build filter
        const filter = { status: 'active' };
        
        // Handle category filter
        if (category) {
            if (mongoose.Types.ObjectId.isValid(category)) {
                filter.category = category;
            } else {
                // Find category by name first
                const categoryDoc = await MarketCategory.findOne({ 
                    name: { $regex: new RegExp(`^${category}$`, 'i') }
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

        // Add other filters
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
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

        // Get products with pagination using sort options
        const [products, total] = await Promise.all([
            MarketProduct.find(filter)
                .populate('category', 'name')
                .populate('sellerId', 'businessName')
                .skip(skip)
                .limit(limit)
                .sort(sortOptions),
            MarketProduct.countDocuments(filter)
        ]);

        // Shuffle/randomize products array to avoid showing them in upload order
        const shuffledProducts = this.shuffleArray([...products]);

        const response = {
            products: shuffledProducts,
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
            productsCount: products.length,
            totalProducts: total,
            filters: { category, search, minPrice, maxPrice, brands, minRating, sort },
            pagination: response.pagination
        });
        
        return response;
    }


    async updateProduct(productId, sellerId, updates) {
        const product = await MarketProduct.findOne({ _id: productId, sellerId });
        
        if (!product) {
            throw { status: 404, message: 'Product not found' };
        }

        Object.assign(product, updates);
        return await product.save();
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
            .populate('sellerId', 'businessName');
            
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
        .populate('sellerId', 'businessName');

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
        .populate('sellerId', 'businessName')
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
        .populate('sellerId', 'businessName')
        .limit(limit)
        .sort('-createdAt');

        return products;
    }

    async getPublicSellerProducts(sellerId, query = {}) {
        const { 
            page = 1, 
            limit = 12, 
            excludeProduct,
            sort = '-createdAt' 
        } = query;
        const skip = (page - 1) * limit;

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

        const [products, total] = await Promise.all([
            MarketProduct.find(filter)
                .populate('category', 'name')
                .populate('sellerId', 'businessName')
                .skip(skip)
                .limit(limit)
                .sort(sort),
            MarketProduct.countDocuments(filter)
        ]);

        return {
            seller: {
                businessName: seller.businessName,
                businessAddress: seller.businessAddress
            },
            products,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                currentPage: page,
                limit
            }
        };
    }

    async getSellerDashboardStats(sellerId) {
        // Overall, all-time stats for the seller (no month-based calculations)
        // Totals are computed across the full dataset.

        // Aggregate total sales from PAID orders only (payment.status = 'completed')
        const salesAgg = await MarketOrder.aggregate([
            { $match: { 'items.sellerId': new mongoose.Types.ObjectId(sellerId), 'payment.status': 'completed' } },
            { $unwind: '$items' },
            { $match: { 'items.sellerId': new mongoose.Types.ObjectId(sellerId) } },
            { $group: { _id: null, total: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } }
        ]);

        // Count unique customers (registered + guests) across all time
        const uniqueCustomersAgg = await MarketOrder.aggregate([
            { $match: { 'items.sellerId': new mongoose.Types.ObjectId(sellerId) } },
            { $group: { _id: { $cond: [ { $ifNull: ['$customerId', false] }, '$customerId', '$guestEmail' ] } } },
            { $count: 'total' }
        ]);

        const totalSales = salesAgg[0]?.total || 0;
        const totalProducts = await MarketProduct.countDocuments({ sellerId });
        const totalOrders = await MarketOrder.countDocuments({ 'items.sellerId': sellerId });
        const totalCustomers = uniqueCustomersAgg[0]?.total || 0;

        // Return only overall totals (no monthly growth or overview)
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
            .populate('sellerId', 'businessName')
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
                    businessName: product.sellerId.businessName
                },
                rating: product.metadata.rating,
                badge: this.getProductBadge(product),
                image: product.images.find(img => img.isDefault)?.url || product.images[0]?.url,
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
            .populate('sellerId', 'businessName')
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
                    businessName: product.sellerId.businessName
                },
                image: product.images.find(img => img.isDefault)?.url || product.images[0]?.url,
                badge: this.getTrendingBadge(product),
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

  

  
}

module.exports = new ProductService();
