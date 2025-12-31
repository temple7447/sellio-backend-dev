const MarketCategory = require('../models/MarketCategory');
const MarketProduct = require('../models/MarketProduct'); // Add this import
const { uploadToCloudinary } = require('../utils/cloudinary');
const chalk = require('chalk');

class CategoryService {
    // Category to Unsplash image mapping
    categoryImages = {
        'Electronics': 'https://images.unsplash.com/photo-1498049794561-7780e7231661',
        'Fashion': 'https://images.unsplash.com/photo-1445205170230-053b83016050',
        'Gadgets': 'https://images.unsplash.com/photo-1519558260268-cde7e03a0152',
        'Footwear': 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2',
        'Bags': 'https://images.unsplash.com/photo-1584917865442-de89df76afd3',
        'Services': 'https://images.unsplash.com/photo-1521791136064-7986c2920216',
        'Equipment': 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc',
        'Beauty': 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9',
        // Default image if category not found in mapping
        'default': 'https://images.unsplash.com/photo-1472851294608-062f824d29cc'
    };

    // Add popular category background images
    popularCategoryImages = {
        'Electronics': {
            url: 'https://images.unsplash.com/photo-1498049794561-7780e7231661',
            title: 'Phones & Accessories',
            subtitle: '152 products'
        },
        'Computers': {
            url: 'https://images.unsplash.com/photo-1519558260268-cde7e03a0152',
            title: 'Laptops & Computers',
            subtitle: '89 products'
        },
        'Fashion': {
            url: 'https://images.unsplash.com/photo-1445205170230-053b83016050',
            title: 'Fashion & Clothing',
            subtitle: '234 products'
        },
        'Food': {
            url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3',
            title: 'Food & Groceries',
            subtitle: '167 products'
        }
    };

    async seedCategories() {
        const defaultCategories = [
            { name: 'Electronics', description: 'Electronic devices and accessories' },
            { name: 'Clothings', description: 'Fashion and apparel' },
            { name: 'Gadgets', description: 'Tech gadgets and accessories' },
            { name: 'Shoes', description: 'Footwear collection' },
            { name: 'Bag', description: 'Bags and luggage' },
            { name: 'Services', description: 'Professional services' },
            { name: 'Equipments', description: 'Tools and equipment' },
            { name: 'Beauty', description: 'Beauty and personal care' }
        ];

        try {
            // Drop existing indices to prevent duplicate key errors
            await MarketCategory.collection.dropIndexes();

            // Create new indices
            await MarketCategory.collection.createIndex({ name: 1 }, { unique: true });
            await MarketCategory.collection.createIndex({ slug: 1 }, { unique: true });

            // Process each category
            for (const category of defaultCategories) {
                const slug = MarketCategory.generateSlug(category.name);

                // Try to find existing category
                const existingCategory = await MarketCategory.findOne({
                    $or: [{ name: category.name }, { slug }]
                });

                if (!existingCategory) {
                    await MarketCategory.create({
                        ...category,
                        slug,
                        isActive: true
                    });
                }
            }

            console.log(chalk.green('✓ Categories seeded successfully'));
        } catch (error) {
            if (error.code === 11000) {
                console.log(chalk.yellow('⚠ Some categories already exist, skipping duplicates'));
            } else {
                console.error(chalk.red('✗ Category seeding failed:', error));
            }
        }
    }

    async getAllCategories(query = {}) {
        try {
            const { page = 1, limit = 20, isActive, sort = 'order' } = query;
            const skip = (page - 1) * limit;

            // Build filter
            const filter = {};
            if (isActive !== undefined) {
                filter.isActive = isActive === 'true';
            }

            // Filter out categories without active products
            const activeCategoryIds = await MarketProduct.distinct('category', { status: 'active' });
            filter._id = { $in: activeCategoryIds };

            // Get categories with pagination
            const [categories, total] = await Promise.all([
                MarketCategory.find(filter)
                    .populate('parent', 'name')
                    .sort(sort)
                    .skip(skip)
                    .limit(limit)
                    .select('name description slug isActive order parent image'),
                MarketCategory.countDocuments(filter)
            ]);

            // Format the response
            return {
                categories: categories.map(cat => ({
                    id: cat._id,
                    name: cat.name,
                    slug: cat.slug,
                    description: cat.description,
                    isActive: cat.isActive,
                    order: cat.order,
                    parent: cat.parent ? {
                        id: cat.parent._id,
                        name: cat.parent.name
                    } : null,
                    image: cat.image || null
                })),
                pagination: {
                    total,
                    pages: Math.ceil(total / limit),
                    currentPage: page,
                    limit
                }
            };
        } catch (error) {
            throw {
                status: 500,
                message: 'Failed to fetch categories',
                error: error.message
            };
        }
    }

    async getCategoryStats() {
        try {
            // Get all active categories
            const categories = await MarketCategory.find({ isActive: true });

            // Get product counts for all categories
            const productStats = await MarketProduct.aggregate([
                {
                    $match: { status: 'active' }
                },
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 },
                        totalSales: { $sum: '$metadata.sales' }
                    }
                }
            ]);

            // Create stats map
            const statsMap = productStats.reduce((acc, curr) => {
                acc[curr._id.toString()] = {
                    count: curr.count,
                    sales: curr.totalSales
                };
                return acc;
            }, {});

            // Format response with enriched data
            const formattedCategories = categories.map(category => ({
                id: category._id,
                name: category.name,
                slug: category.slug,
                description: category.description,
                stats: {
                    products: statsMap[category._id.toString()]?.count || 0,
                    sales: statsMap[category._id.toString()]?.sales || 0
                },
                image: {
                    url: this.categoryImages[category.name] || this.categoryImages.default,
                    thumbnail: `${this.categoryImages[category.name] || this.categoryImages.default}?auto=format,compress&q=60&w=400&fit=crop`,
                    banner: `${this.categoryImages[category.name] || this.categoryImages.default}?auto=format,compress&q=80&w=1200&h=400&fit=crop`
                }
            }));

            // Sort by product count (highest first)
            formattedCategories.sort((a, b) => b.stats.products - a.stats.products);

            return {
                categories: formattedCategories,
                total: formattedCategories.length
            };

        } catch (error) {
            console.error('Category stats error:', error);
            throw {
                status: 500,
                message: 'Failed to fetch category statistics',
                error: error.message
            };
        }
    }

    async getPopularCategories(limit = 4) {
        try {
            // Get all active categories
            const categories = await MarketCategory.find({ isActive: true });

            // Get product counts for categories
            const productCounts = await MarketProduct.aggregate([
                {
                    $match: { status: 'active' }
                },
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 }
                    }
                }
            ]);

            // Create count map
            const countMap = productCounts.reduce((acc, curr) => {
                acc[curr._id.toString()] = curr.count;
                return acc;
            }, {});

            // Format and enrich categories with images and counts
            const enrichedCategories = categories.map(category => ({
                id: category._id,
                name: category.name,
                slug: category.slug,
                description: category.description,
                productCount: countMap[category._id.toString()] || 0,
                image: this.popularCategoryImages[category.name] || {
                    url: this.categoryImages.default,
                    title: category.name,
                    subtitle: `${countMap[category._id.toString()] || 0} products`
                },
                banner: `${this.popularCategoryImages[category.name]?.url || this.categoryImages.default}?auto=format,compress&q=80&w=1200&h=400&fit=crop`,
                thumbnail: `${this.popularCategoryImages[category.name]?.url || this.categoryImages.default}?auto=format,compress&q=60&w=400&fit=crop`
            }));

            // Sort by product count and get top categories
            const popularCategories = enrichedCategories
                .sort((a, b) => b.productCount - a.productCount)
                .slice(0, limit);

            return {
                categories: popularCategories,
                total: popularCategories.length
            };
        } catch (error) {
            throw {
                status: 500,
                message: 'Failed to fetch popular categories',
                error: error.message
            };
        }
    }

    async createCategory(categoryData, imageFile) {
        try {
            const { name } = categoryData;

            // Check for existing category
            const existingCategory = await MarketCategory.findOne({
                name: { $regex: new RegExp(`^${name}$`, 'i') }
            });

            if (existingCategory) {
                throw {
                    status: 400,
                    message: 'Category with this name already exists'
                };
            }

            // Upload image to Cloudinary if provided
            let imageUrl = null;
            if (imageFile) {
                const result = await uploadToCloudinary(imageFile, 'categories');
                if (!result || !result.secure_url) {
                    throw { status: 500, message: 'Failed to upload category image' };
                }
                imageUrl = result.secure_url;
            }

            // Create new category with image
            const category = new MarketCategory({
                ...categoryData,
                slug: MarketCategory.generateSlug(name),
                image: imageUrl
            });

            return await category.save();
        } catch (error) {
            if (error.status) {
                throw error;
            }
            throw {
                status: 500,
                message: 'Failed to create category',
                error: error.message
            };
        }
    }

    async deleteCategory(categoryId) {
        try {
            // Check if category exists
            const category = await MarketCategory.findById(categoryId);
            if (!category) {
                throw {
                    status: 404,
                    message: 'Category not found'
                };
            }

            // Check if category has products
            const hasProducts = await MarketProduct.exists({ category: categoryId });
            if (hasProducts) {
                throw {
                    status: 400,
                    message: 'Cannot delete category with existing products'
                };
            }

            // Delete the category
            await MarketCategory.findByIdAndDelete(categoryId);

            return {
                success: true,
                message: 'Category deleted successfully',
                data: {
                    id: category._id,
                    name: category.name
                }
            };
        } catch (error) {
            throw {
                status: error.status || 500,
                message: error.message || 'Failed to delete category'
            };
        }
    }
}

module.exports = new CategoryService();
