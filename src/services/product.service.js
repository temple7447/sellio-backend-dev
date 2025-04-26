const MarketProduct = require('../models/MarketProduct');
const MarketCategory = require('../models/MarketCategory');
const { uploadToCloudinary } = require('../utils/cloudinary');

class ProductService {
    async createProduct(sellerId, productData, files) {
        // Validate price structure
        if (!productData.price || typeof productData.price !== 'object') {
            throw { 
                status: 400, 
                message: 'Invalid price structure. Expected: { current: number, discount?: number }' 
            };
        }

        // Convert price.current to number if it's a string
        if (typeof productData.price.current === 'string') {
            productData.price.current = parseFloat(productData.price.current);
        }

        if (!productData.price.current || isNaN(productData.price.current)) {
            throw { status: 400, message: 'Valid price.current is required' };
        }

        // Validate and get category
        if (!productData.category) {
            throw { status: 400, message: 'Category is required' };
        }

        try {
            // Try to find category by name first
            let category = await MarketCategory.findOne({ 
                name: { $regex: new RegExp(productData.category, 'i') }
            });

            if (!category) {
                // If not found by name, try by ID
                category = await MarketCategory.findById(productData.category);
            }

            if (!category) {
                throw { status: 400, message: `Category '${productData.category}' not found` };
            }

            productData.category = category._id;
        } catch (error) {
            if (error.status) throw error;
            throw { status: 400, message: 'Invalid category' };
        }

        // Handle image upload
        const imageUrls = [];
        if (!files || files.length === 0) {
            throw { status: 400, message: 'At least one product image is required' };
        }

        for (const file of files) {
            const result = await uploadToCloudinary(file, 'products');
            imageUrls.push({ url: result.secure_url, isDefault: imageUrls.length === 0 });
        }

        const product = new MarketProduct({
            ...productData,
            sellerId,
            images: imageUrls,
            status: 'active'
        });

        return await product.save();
    }

    async getSellerProducts(sellerId) {
        return await MarketProduct.find({ sellerId });
    }

    async getPublicProducts(query) {
        const { page = 1, limit = 10, category } = query;
        const skip = (page - 1) * limit;

        const filter = { status: 'active' };
        if (category) filter.category = category;

        const [products, total] = await Promise.all([
            MarketProduct.find(filter)
                .skip(skip)
                .limit(limit)
                .populate('sellerId', 'businessName'),
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
        const { status, page = 1, limit = 10 } = query;
        const skip = (page - 1) * limit;

        const filter = {};
        if (status) filter.status = status;

        const [products, total] = await Promise.all([
            MarketProduct.find(filter)
                .populate('sellerId', 'businessName email')
                .populate('category')
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 }),
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
}

module.exports = new ProductService();
