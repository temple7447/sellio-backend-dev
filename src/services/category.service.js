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
}

module.exports = new CategoryService();
