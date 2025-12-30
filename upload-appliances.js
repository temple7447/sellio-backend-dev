const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const { MarketUser } = require('./src/models/MarketUser');
const MarketProduct = require('./src/models/MarketProduct');
const MarketCategory = require('./src/models/MarketCategory');

async function uploadAppliances() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        // 1. Get Home Appliances Category
        const categoryName = 'Home Appliances';
        let category = await MarketCategory.findOne({ name: categoryName });
        if (!category) {
            console.log(chalk.yellow(`Category "${categoryName}" not found. Creating it...`));
            category = new MarketCategory({
                name: categoryName,
                description: 'Kitchen and home gadgets',
                isActive: true
            });
            await category.save();
        }
        console.log(chalk.green(`✓ Using category: ${category.name} (${category._id})`));

        // 2. Get Seller
        const sellerEmail = 'test_seller1@example.com';
        const seller = await MarketUser.findOne({ email: sellerEmail });
        if (!seller) {
            throw new Error(`Seller with email ${sellerEmail} not found. Please run populate-data.js first.`);
        }
        console.log(chalk.green(`✓ Using seller: ${seller.fullName} (${seller._id})`));

        // 3. Define Products
        const applianceProducts = [
            {
                name: 'LG Smart Inverter Microwave',
                description: 'Powerful 1200W microwave with smart inverter technology for even heating and defrosting.',
                price: { current: 150000 },
                inventory: { quantity: 15 },
                brand: 'LG',
                images: [{ url: 'https://images.unsplash.com/photo-1574265353302-b30fedbf13c8?auto=format&fit=crop&q=80&w=800', isDefault: true }]
            },
            {
                name: 'Samsung Double Door Refrigerator',
                description: 'Energy-efficient 500L refrigerator with Twin Cooling Plus technology and digital inverter compressor.',
                price: { current: 850000 },
                inventory: { quantity: 5 },
                brand: 'Samsung',
                images: [{ url: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&q=80&w=800', isDefault: true }]
            },
            {
                name: 'Philips Air Fryer XXL',
                description: 'Healthy cooking with up to 90% less fat. Large capacity for the whole family.',
                price: { current: 120000 },
                inventory: { quantity: 20 },
                brand: 'Philips',
                images: [{ url: 'https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&q=80&w=800', isDefault: true }]
            },
            {
                name: 'Breville Barista Express Espresso Machine',
                description: 'Manual espresso machine with integrated grinder for fresh, café-quality coffee at home.',
                price: { current: 350000 },
                inventory: { quantity: 8 },
                brand: 'Breville',
                images: [{ url: 'https://images.unsplash.com/photo-1510972585698-4416d845170d?auto=format&fit=crop&q=80&w=800', isDefault: true }]
            }
        ];

        // 4. Upload Products
        console.log(chalk.blue('\nUploading products...'));
        for (const prodData of applianceProducts) {
            const existingProduct = await MarketProduct.findOne({ name: prodData.name, sellerId: seller._id });
            if (existingProduct) {
                console.log(chalk.yellow(`Product "${prodData.name}" already exists for this seller. Skipping.`));
                continue;
            }

            const product = new MarketProduct({
                ...prodData,
                sellerId: seller._id,
                category: category._id,
                status: 'active'
            });

            await product.save();
            console.log(chalk.green(`✓ Uploaded: ${prodData.name}`));
        }

        console.log(chalk.blue('\nProduct upload completed successfully!'));
    } catch (error) {
        console.error(chalk.red('Error uploading products:'), error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

uploadAppliances();
