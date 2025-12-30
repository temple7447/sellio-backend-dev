const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const MarketProduct = require('../src/models/MarketProduct');
const MarketCategory = require('../src/models/MarketCategory');

async function verifyUpload() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const category = await MarketCategory.findOne({ name: 'Home Appliances' });
        if (!category) {
            console.error(chalk.red('Category not found'));
            return;
        }

        const count = await MarketProduct.countDocuments({ category: category._id });
        console.log(chalk.green(`Total products in Home Appliances: ${count}`));

        const products = await MarketProduct.find({ category: category._id }).select('name price');
        products.forEach(p => {
            console.log(chalk.blue(`- ${p.name}: ₦${p.price.current.toLocaleString()}`));
        });

    } catch (error) {
        console.error(chalk.red('Verification error:'), error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

verifyUpload();
