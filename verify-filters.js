const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const productService = require('./src/services/product.service');

async function verifyFilters() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.blue('\n--- Verifying Category Slug Filter ---'));

        // 1. Test filtering by slug
        const slugResult = await productService.getPublicProducts({ category: 'home-appliances' });
        console.log(chalk.green(`Products found with slug "home-appliances": ${slugResult.products.length}`));
        slugResult.products.forEach(p => console.log(`- ${p.name}`));

        console.log(chalk.blue('\n--- Verifying Sorting (Price Low to High) ---'));
        // 2. Test sorting by price low
        const sortResult = await productService.getPublicProducts({ sort: 'price_low' });
        console.log(chalk.green(`Sorting result (Price Low to High):`));
        sortResult.products.forEach(p => console.log(`- ${p.name}: ₦${p.price.current.toLocaleString()}`));

        // Check if sorted
        let isSorted = true;
        for (let i = 0; i < sortResult.products.length - 1; i++) {
            if (sortResult.products[i].price.current > sortResult.products[i + 1].price.current) {
                isSorted = false;
                break;
            }
        }
        console.log(isSorted ? chalk.green('✓ Correctly sorted by price') : chalk.red('✗ NOT sorted correctly by price'));

    } catch (error) {
        console.error(chalk.red('Verification error:'), error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

verifyFilters();
