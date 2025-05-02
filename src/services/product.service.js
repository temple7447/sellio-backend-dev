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
                sku: productData.sku || null,
                lowStockAlert: parseInt(productData.lowStockAlert) || 5
            };

            if (inventory.quantity < 0) {
                throw { status: 400, message: 'Initial inventory cannot be negative' };
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
                inventory,
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
        const { 
            page = 1, 
            limit = 10, 
            category, 
            search,
            sort = '-createdAt',
            minPrice,
            maxPrice
        } = query;
        const skip = (page - 1) * limit;

        // Build filter
        const filter = { status: 'active' };
        if (category) filter.category = category;
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
    }

    async getAdminProducts(query) {
        const { 
            status, 
            page = 1, 
            limit = 10,
            sellerId,
            category,
            search,
            sort = '-createdAt'
        } = query;
        const skip = (page - 1) * limit;

        // Build filter
        const filter = {};
        if (status) filter.status = status;
        if (sellerId) filter.sellerId = sellerId;
        if (category) filter.category = category;
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const [products, total] = await Promise.all([
            MarketProduct.find(filter)
                .populate('sellerId', 'businessName email')
                .populate('category', 'name')
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
        const product = await MarketProduct.findOneAndDelete({ 
            _id: productId, 
            sellerId 
        });
        
        if (!product) {
            throw { status: 404, message: 'Product not found' };
        }

        return product;
    }

    async getProductById(productId) {
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
        const today = new Date();
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
        const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, today.getDate());

        // Get current month's statistics
        const [currentProducts, currentOrders] = await Promise.all([
            MarketProduct.countDocuments({ 
                sellerId,
                createdAt: { $gte: lastMonth }
            }),
            MarketOrder.countDocuments({
                'items.sellerId': sellerId,
                createdAt: { $gte: lastMonth }
            })
        ]);

        // Get previous month's statistics for comparison
        const [previousProducts, previousOrders] = await Promise.all([
            MarketProduct.countDocuments({
                sellerId,
                createdAt: { 
                    $gte: twoMonthsAgo,
                    $lt: lastMonth
                }
            }),
            MarketOrder.countDocuments({
                'items.sellerId': sellerId,
                createdAt: { 
                    $gte: twoMonthsAgo,
                    $lt: lastMonth
                }
            })
        ]);

        // Calculate total sales amount for current month
        const currentSales = await MarketOrder.aggregate([
            {
                $match: {
                    'items.sellerId': new mongoose.Types.ObjectId(sellerId),
                    'status': 'completed',
                    createdAt: { $gte: lastMonth }
                }
            },
            {
                $unwind: '$items'
            },
            {
                $match: {
                    'items.sellerId': new mongoose.Types.ObjectId(sellerId)
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
                }
            }
        ]);

        // Calculate total sales amount for previous month
        const previousSales = await MarketOrder.aggregate([
            {
                $match: {
                    'items.sellerId': new mongoose.Types.ObjectId(sellerId),
                    'status': 'completed',
                    createdAt: { 
                        $gte: twoMonthsAgo,
                        $lt: lastMonth
                    }
                }
            },
            {
                $unwind: '$items'
            },
            {
                $match: {
                    'items.sellerId': new mongoose.Types.ObjectId(sellerId)
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
                }
            }
        ]);

        // Get last 6 months sales overview
        const salesOverview = await MarketOrder.aggregate([
            {
                $match: {
                    'items.sellerId': new mongoose.Types.ObjectId(sellerId),
                    'status': 'completed',
                    createdAt: { 
                        $gte: new Date(today.getFullYear(), today.getMonth() - 6, 1)
                    }
                }
            },
            {
                $unwind: '$items'
            },
            {
                $match: {
                    'items.sellerId': new mongoose.Types.ObjectId(sellerId)
                }
            },
            {
                $group: {
                    _id: { 
                        month: { $month: '$createdAt' },
                        year: { $year: '$createdAt' }
                    },
                    amount: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);

        // Calculate growth percentages
        const totalProducts = await MarketProduct.countDocuments({ sellerId });
        const totalOrders = await MarketOrder.countDocuments({ 'items.sellerId': sellerId });
        const currentSalesTotal = currentSales[0]?.total || 0;
        const previousSalesTotal = previousSales[0]?.total || 0;

        const salesGrowth = previousSalesTotal ? 
            ((currentSalesTotal - previousSalesTotal) / previousSalesTotal) * 100 : 0;
        const productGrowth = previousProducts ? 
            ((currentProducts - previousProducts) / previousProducts) * 100 : 0;
        const orderGrowth = previousOrders ? 
            ((currentOrders - previousOrders) / previousOrders) * 100 : 0;

        return {
            totalSales: currentSalesTotal,
            totalOrders,
            totalProducts,
            salesGrowth,
            productGrowth,
            orderGrowth,
            salesOverview: salesOverview.map(item => ({
                month: new Date(2024, item._id.month - 1).toLocaleString('default', { month: 'short' }),
                amount: item.amount
            }))
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
}

module.exports = new ProductService();
