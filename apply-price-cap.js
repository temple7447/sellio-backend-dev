const mongoose = require('mongoose');
const chalk = require('chalk');
const config = require('./src/config/config');
const MarketProduct = require('./src/models/MarketProduct');

async function capPrices() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(config.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        console.log(chalk.blue('Updating products with price > 1000...'));

        const result = await MarketProduct.updateMany(
            { 'price.current': { $gt: 1000 } },
            { $set: { 'price.current': 1000 } }
        );

        console.log(chalk.green(`✓ Successfully updated ${result.modifiedCount} products.`));
        console.log(chalk.yellow(`(Matched ${result.matchedCount} products)`));

        await mongoose.disconnect();
        console.log(chalk.blue('Disconnected from MongoDB.'));
        process.exit(0);
    } catch (error) {
        console.error(chalk.red('✗ Error capping prices:'), error);
        process.exit(1);
    }
}

capPrices();
