const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const { MarketUser } = require('../src/models/MarketUser');
const MarketProduct = require('../src/models/MarketProduct');
const MarketCategory = require('../src/models/MarketCategory');

async function uploadBudgetItems() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        // 1. Get or Create "Stationery & Essentials" Category
        const categoryName = 'Stationery & Essentials';
        let category = await MarketCategory.findOne({ name: categoryName });
        if (!category) {
            console.log(chalk.yellow(`Category "${categoryName}" not found. Creating it...`));
            category = new MarketCategory({
                name: categoryName,
                description: 'Affordable daily essentials and stationery',
                isActive: true
            });
            await category.save();
        }
        console.log(chalk.green(`✓ Using category: ${category.name} (${category._id})`));

        // 2. Get Seller
        const sellerEmail = 'test_seller1@example.com';
        const seller = await MarketUser.findOne({ email: sellerEmail });
        if (!seller) {
            throw new Error(`Seller with email ${sellerEmail} not found.`);
        }
        console.log(chalk.green(`✓ Using seller: ${seller.fullName} (${seller._id})`));

        // 3. Define Products (Price < 1000 Naira)
        const budgetProducts = [
            {
                name: 'Pilot G2 Gel Pen (Blue)',
                description: 'Smooth writing long-lasting gel pen. Perfect for exams.',
                price: { current: 850 },
                inventory: { quantity: 100 },
                brand: 'Pilot',
                images: [{ url: 'https://images.unsplash.com/photo-1585336139118-132f70e4a7dd?auto=format&fit=crop&q=80&w=800', isDefault: true }]
            },
            {
                name: 'A4 Exercise Book (80 Leaves)',
                description: 'Standard exercise book for student notes.',
                price: { current: 400 },
                inventory: { quantity: 200 },
                brand: 'Generic',
                images: [{ url: 'https://images.unsplash.com/photo-1586075010633-24701bc6e2b4?auto=format&fit=crop&q=80&w=800', isDefault: true }]
            },
            {
                name: 'Scientific Calculator Battery',
                description: 'Replacement button cell for most scientific calculators.',
                price: { current: 300 },
                inventory: { quantity: 50 },
                brand: 'Energizer',
                images: [{ url: 'https://images.unsplash.com/photo-1590218758810-7494f699d7a2?auto=format&fit=crop&q=80&w=800', isDefault: true }]
            },
            {
                name: 'Deli Eraser (Premium)',
                description: 'Soft rubber eraser that leaves no stains.',
                price: { current: 150 },
                inventory: { quantity: 150 },
                brand: 'Deli',
                images: [{ url: 'https://images.unsplash.com/photo-1624388339733-4f134586d302?auto=format&fit=crop&q=80&w=800', isDefault: true }]
            }
        ];

        // 4. Upload Products
        console.log(chalk.blue('\nUploading budget products...'));
        for (const prodData of budgetProducts) {
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
            console.log(chalk.green(`✓ Uploaded: ${prodData.name} - ₦${prodData.price.current}`));
        }

        console.log(chalk.blue('\nBudget product upload completed successfully!'));
    } catch (error) {
        console.error(chalk.red('Error uploading products:'), error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

uploadBudgetItems();
