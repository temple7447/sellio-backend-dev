const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const { MarketUser } = require('../src/models/MarketUser');
const MarketProduct = require('../src/models/MarketProduct');
const MarketCategory = require('../src/models/MarketCategory');

const products = [
    { name: 'Wireless Bluetooth Earbuds', desc: 'True wireless stereo earbuds with charging case', price: 4500, brand: 'Xiaomi', qty: 50 },
    { name: 'USB-C Fast Charger 20W', desc: 'Fast charging adapter with PD support', price: 3500, brand: 'Samsung', qty: 100 },
    { name: 'Phone Grip Stand', desc: 'Adjustable ring grip and kickstand for phones', price: 1500, brand: 'Generic', qty: 200 },
    { name: 'Screen Protector Tempered Glass', desc: 'HD clear tempered glass for 6.1" phones', price: 2000, brand: 'Generic', qty: 150 },
    { name: 'Silicone Phone Case', desc: 'Soft silicone protective case with camera cover', price: 3000, brand: 'Generic', qty: 120 },
    { name: 'Laptop Cooling Pad', desc: 'USB-powered cooling pad with dual fans', price: 8500, brand: 'Havit', qty: 30 },
    { name: 'Mechanical Keyboard', desc: 'RGB backlit mechanical keyboard with blue switches', price: 25000, brand: 'Redragon', qty: 25 },
    { name: 'Wireless Mouse', desc: 'Ergonomic wireless mouse with silent clicks', price: 7500, brand: 'Logitech', qty: 40 },
    { name: 'HDMI Cable 2m', desc: 'High-speed HDMI 2.1 cable 4K@60Hz', price: 3500, brand: 'UGREEN', qty: 80 },
    { name: 'Power Bank 20000mAh', desc: 'High capacity power bank with dual USB output', price: 18000, brand: 'Oraimo', qty: 35 },
    { name: 'Smart Watch Fitness Tracker', desc: 'Fitness tracker with heart rate and SpO2 monitor', price: 35000, brand: 'Xiaomi', qty: 20 },
    { name: 'Webcam 1080p', desc: 'Full HD webcam with built-in microphone', price: 22000, brand: 'Logitech', qty: 15 },
    { name: 'Phone Tripod Selfie Stick', desc: 'Extendable Bluetooth selfie stick with tripod', price: 5500, brand: 'Generic', qty: 60 },
    { name: 'Portable Bluetooth Speaker', desc: 'Waterproof portable speaker with deep bass', price: 28000, brand: 'JBL', qty: 18 },
    { name: 'Memory Card 128GB', desc: 'High-speed microSDXC UHS-I U3', price: 12000, brand: 'SanDisk', qty: 45 },
    { name: 'Wireless Charging Pad', desc: 'Qi fast wireless charger 15W', price: 9500, brand: 'Samsung', qty: 30 },
    { name: 'Laptop Backpack', desc: 'Water-resistant laptop backpack 15.6"', price: 45000, brand: 'Generic', qty: 25 },
    { name: 'USB Hub 4-Port', desc: 'USB 3.0 4-port hub with individual switches', price: 6500, brand: 'UGREEN', qty: 55 },
    { name: 'Desktop Monitor Stand', desc: 'Adjustable monitor riser with storage drawer', price: 38000, brand: 'Generic', qty: 12 },
    { name: 'Gaming Mouse Pad XXL', desc: 'Large extended mouse pad with stitched edges', price: 5500, brand: 'Razer', qty: 40 },
];

async function run() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB\n'));

        const seller = await MarketUser.findOne({ email: 'seller@marketplace.com' });
        if (!seller) {
            console.log(chalk.red('✗ Seller not found. Run seed-full-flow.js first.'));
            process.exit(1);
        }

        const category = await MarketCategory.findOne({ name: 'Electronics' });
        if (!category) {
            console.log(chalk.red('✗ Category not found. Run seed-full-flow.js first.'));
            process.exit(1);
        }

        console.log(chalk.yellow(`Creating ${products.length} products for ${seller.businessName}...\n`));

        let created = 0, skipped = 0;
        for (const p of products) {
            const existing = await MarketProduct.findOne({ name: p.name, sellerId: seller._id });
            if (existing) {
                console.log(chalk.yellow(`  ⏭  "${p.name}" already exists`));
                skipped++;
                continue;
            }
            const product = new MarketProduct({
                name: p.name,
                description: p.desc,
                price: { current: p.price },
                inventory: { quantity: p.qty },
                status: 'active',
                brand: p.brand,
                sellerId: seller._id,
                category: category._id,
                images: [{ url: 'https://via.placeholder.com/400', isDefault: true }]
            });
            await product.save();
            console.log(chalk.green(`  ✓ ₦${p.price.toLocaleString()} — ${p.name}`));
            created++;
        }

        console.log(chalk.blue(`\n══════════════════════════════════════════`));
        console.log(chalk.blue(`  Created: ${created}  |  Skipped: ${skipped}`));
        console.log(chalk.blue(`  Price range: ₦1,500 — ₦45,000`));
        console.log(chalk.blue(`══════════════════════════════════════════`));

    } catch (error) {
        console.error(chalk.red('Error:'), error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

run();
