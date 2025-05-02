const MarketCategory = require('../models/MarketCategory');
const chalk = require('chalk');

class CategoryService {
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

    async createCategory(categoryData) {
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

        // Create new category
        const category = new MarketCategory({
            ...categoryData,
            slug: MarketCategory.generateSlug(name)
        });

        return await category.save();
    }
}

module.exports = new CategoryService();
