const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const { MarketUser } = require('../src/models/MarketUser');

async function findSellers() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        const sellers = await MarketUser.find({ role: 'seller' }).limit(5);
        
        if (sellers.length === 0) {
            console.log(chalk.red('✗ No sellers found in database'));
            console.log(chalk.yellow('Run: node scripts/populate-data.js to create test sellers'));
        } else {
            console.log(chalk.blue('\n=== Sellers Found ==='));
            sellers.forEach((seller, i) => {
                console.log(chalk.green(`${i + 1}. ${seller.email} - ${seller.businessName || 'N/A'}`));
            });
        }

    } catch (error) {
        console.error(chalk.red('Error:'), error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

findSellers();
