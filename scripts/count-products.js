const mongoose = require('mongoose');
const chalk = require('chalk');
const config = require('../src/config/config');
const MarketProduct = require('../src/models/MarketProduct');

async function countProducts() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(config.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        console.log(chalk.blue('Counting products...'));
        const count = await MarketProduct.countDocuments();

        console.log(chalk.green('--------------------------------'));
        console.log(chalk.white('Total Products on Platform:'), chalk.yellow(count));
        console.log(chalk.green('--------------------------------'));

        await mongoose.connection.close();
        console.log(chalk.blue('Connection closed.'));
        process.exit(0);
    } catch (error) {
        console.error(chalk.red('✗ Error:'), error.message);
        process.exit(1);
    }
}

countProducts();
