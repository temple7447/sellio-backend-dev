const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const { MarketUser, MarketSeller, MarketCustomer } = require('../src/models/MarketUser');
const MarketProduct = require('../src/models/MarketProduct');
const MarketCategory = require('../src/models/MarketCategory');

async function createTestData() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        // Get existing category
        const category = await MarketCategory.findOne({ name: 'Electronics. km' });
        if (!category) {
            console.log(chalk.yellow('No Electronics category found'));
            process.exit(1);
        }
        const catId = category._id;
        console.log(chalk.green(`✓ Using category: ${category.name}`));

        // Create Seller
        const sellerEmail = 'seller@test.com';
        let seller = await MarketUser.findOne({ email: sellerEmail });
        if (!seller) {
            seller = new MarketSeller({
                email: sellerEmail,
                password: 'seller123',
                fullName: 'Test Seller',
                phoneNumber: '08123456789',
                businessName: 'Test Electronics Store',
                businessAddress: '123 Test Street, Lagos',
                governmentId: 'https://via.placeholder.com/150',
                adminVerified: true,
                isVerified: true
            });
            await seller.save();
            console.log(chalk.green(`✓ Created seller: ${sellerEmail} / seller123`));
        } else {
            console.log(chalk.yellow(`Seller ${sellerEmail} already exists`));
        }

        // Create Buyer
        const buyerEmail = 'buyer@test.com';
        let buyer = await MarketUser.findOne({ email: buyerEmail });
        if (!buyer) {
            buyer = new MarketCustomer({
                email: buyerEmail,
                password: 'buyer123',
                fullName: 'Test Buyer',
                phoneNumber: '08012345678',
                isVerified: true
            });
            await buyer.save();
            console.log(chalk.green(`✓ Created buyer: ${buyerEmail} / buyer123`));
        } else {
            console.log(chalk.yellow(`Buyer ${buyerEmail} already exists`));
        }

        // Create 12 Products
        const products = [
            { name: 'iPhone 14 Pro', desc: 'Latest Apple flagship phone', price: 850000 },
            { name: 'Samsung Galaxy S23', desc: 'Premium Android smartphone', price: 650000 },
            { name: 'MacBook Air M2', desc: 'Lightweight powerful laptop', price: 1200000 },
            { name: 'Dell XPS 15', desc: 'High-performance ultrabook', price: 1100000 },
            { name: 'Sony WH-1000XM5', desc: 'Premium noise-canceling headphones', price: 280000 },
            { name: 'AirPods Pro 2', desc: 'True wireless earbuds with ANC', price: 180000 },
            { name: 'iPad Air 5', desc: 'Powerful tablet for work and play', price: 450000 },
            { name: 'Apple Watch Series 8', desc: 'Smart fitness watch', price: 350000 },
            { name: 'PlayStation 5', desc: 'Next-gen gaming console', price: 450000 },
            { name: 'Nintendo Switch OLED', desc: 'Handheld gaming console', price: 280000 },
            { name: 'Canon EOS R6', desc: 'Professional mirrorless camera', price: 1500000 },
            { name: 'LG 55" OLED TV', desc: 'Premium smart television', price: 900000 }
        ];

        for (const p of products) {
            let existing = await MarketProduct.findOne({ name: p.name, sellerId: seller._id });
            if (!existing) {
                const product = new MarketProduct({
                    name: p.name,
                    description: p.desc,
                    price: { current: p.price },
                    inventory: { quantity: 10 },
                    status: 'active',
                    sellerId: seller._id,
                    category: catId,
                    images: [{ url: 'https://via.placeholder.com/300', isDefault: true }]
                });
                await product.save();
                console.log(chalk.green(`✓ Created product: ${p.name}`));
            } else {
                console.log(chalk.yellow(`Product ${p.name} already exists`));
            }
        }

        console.log(chalk.blue('\n=== Test Data Created Successfully ==='));
        console.log(chalk.green('Seller: ') + 'seller@test.com / seller123');
        console.log(chalk.green('Buyer:  ') + 'buyer@test.com / buyer123');
        console.log(chalk.green('Products: 12 items created'));

    } catch (error) {
        console.error(chalk.red('Error:'), error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

createTestData();
