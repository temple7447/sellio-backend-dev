const mongoose = require('mongoose');
const chalk = require('chalk');
const config = require('../src/config/config');
const MarketCategory = require('../src/models/MarketCategory');

async function deleteCategory() {
    try {
        console.log(chalk.blue('Connecting to MongoDB to delete category...'));
        await mongoose.connect(process.env.MONGODB_URI || config.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        const categoryName = 'Test Category';
        const category = await MarketCategory.findOne({ name: categoryName });

        if (!category) {
            console.log(chalk.yellow(`⚠ Category '${categoryName}' not found.`));
            process.exit(0);
        }

        console.log(chalk.blue(`Found category: ${category.name} (${category._id})`));

        // Check if there are any products in this category
        const MarketProduct = require('../src/models/MarketProduct');
        const productCount = await MarketProduct.countDocuments({ category: category._id });

        if (productCount > 0) {
            console.log(chalk.yellow(`⚠ Category has ${productCount} products. Deleting products first...`));
            await MarketProduct.deleteMany({ category: category._id });
            console.log(chalk.green(`✓ Deleted ${productCount} products.`));
        }

        await MarketCategory.findByIdAndDelete(category._id);
        console.log(chalk.green(`✓ Successfully deleted category '${categoryName}'`));

        process.exit(0);
    } catch (error) {
        console.error(chalk.red('❌ Error deleting category:'), error.message);
        process.exit(1);
    }
}

deleteCategory();
