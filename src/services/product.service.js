const MarketProduct = require('../models/MarketProduct');
const MarketCategory = require('../models/MarketCategory');
const { uploadToCloudinary } = require('../utils/cloudinary');

class ProductService {
    async createProduct(sellerId, productData, files) {
        // Validate all required fields
        const requiredFields = ['name', 'description', 'price'];
        for (const field of requiredFields) {
            if (!productData[field]) {
                throw { 
                    status: 400, 
                    message: `Missing required field: ${field}`,
                    required: requiredFields
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
            lowStockAlert: 5 // default value
        };

        if (inventory.quantity < 0) {
            throw { status: 400, message: 'Initial inventory cannot be negative' };
        }

        // Validate and process tags
        const tags = productData.tags ? 
            productData.tags.split(',').map(tag => tag.trim()).filter(Boolean) : 
            [];

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
            imageUrls.push({ 
                url: result.secure_url, 
                isDefault: imageUrls.length === 0 
            });
        }

        // Process category
        if (!productData.category) {
            throw { status: 400, message: 'Category is required' };
        }

        try {
            const category = await MarketCategory.findOne({ 
                name: { $regex: new RegExp(productData.category, 'i') }
            }) || await MarketCategory.findById(productData.category);

            if (!category) {
                throw { status: 400, message: `Category '${productData.category}' not found` };
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
                status: 'active',
                metadata: {
                    tags,
                    sku: inventory.sku
                }
            });

            const savedProduct = await product.save();
            
            // Return with populated category
            return await MarketProduct.findById(savedProduct._id)
                .populate('category', 'name')
                .populate('sellerId', 'businessName');

        } catch (error) {
            if (error.status) throw error;
            throw { status: 400, message: 'Invalid category or product data' };
        }
    }

    async getSellerProducts(sellerId, query = {}) {
        const { page = 1, limit = 10, status, sort = '-createdAt' } = query;
        const skip = (page - 1) * limit;

        const filter = { sellerId };
        if (status) filter.status = status;

        const [products, total] = await Promise.all([
            MarketProduct.find(filter)
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
}

module.exports = new ProductService();
