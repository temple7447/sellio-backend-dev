const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const { MarketUser, MarketSeller, MarketCustomer, MarketAdmin } = require('../src/models/MarketUser');
const MarketProduct = require('../src/models/MarketProduct');
const MarketCategory = require('../src/models/MarketCategory');

async function run() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB\n'));

        // 1. Create or get an admin
        console.log(chalk.yellow('─── Step 1: Create Admin ───'));
        let admin = await MarketUser.findOne({ role: 'admin' });
        if (!admin) {
            admin = new MarketUser({
                email: 'admin@campustrade.com',
                password: 'Admin@12345678',
                fullName: 'Super Admin',
                phoneNumber: '08000000000',
                role: 'admin',
                isVerified: true
            });
            await admin.save();
            console.log(chalk.green('✓ Admin created'));
        } else {
            console.log(chalk.yellow('✓ Admin already exists'));
        }
        console.log(chalk.cyan(`   Email: admin@campustrade.com / Password: Admin@12345678`));

        // 2. Create a category
        console.log(chalk.yellow('\n─── Step 2: Create Category ───'));
        let category = await MarketCategory.findOne({ name: 'Electronics' });
        if (!category) {
            category = new MarketCategory({
                name: 'Electronics',
                description: 'Electronic devices and accessories',
                isActive: true
            });
            await category.save();
            console.log(chalk.green('✓ Category "Electronics" created'));
        } else {
            console.log(chalk.yellow('✓ Category "Electronics" already exists'));
        }

        // 3. Create a seller (NOT admin-verified yet)
        console.log(chalk.yellow('\n─── Step 3: Create Seller (unverified) ───'));
        let seller = await MarketUser.findOne({ email: 'seller@marketplace.com' });
        if (!seller) {
            seller = new MarketSeller({
                email: 'seller@marketplace.com',
                password: 'Seller@123',
                fullName: 'John Doe',
                phoneNumber: '08011111111',
                businessName: 'John Electronics Store',
                businessAddress: '42 Tech Avenue, Lagos',
                governmentId: 'https://via.placeholder.com/150',
                isVerified: true,
                adminVerified: false
            });
            await seller.save();
            console.log(chalk.green('✓ Seller created (awaiting admin verification)'));
        } else {
            console.log(chalk.yellow('✓ Seller already exists'));
        }
        console.log(chalk.cyan(`   Email: seller@marketplace.com / Password: Seller@123`));

        // 4. Create a buyer
        console.log(chalk.yellow('\n─── Step 4: Create Buyer ───'));
        let buyer = await MarketUser.findOne({ email: 'buyer@marketplace.com' });
        if (!buyer) {
            buyer = new MarketCustomer({
                email: 'buyer@marketplace.com',
                password: 'Buyer@123',
                fullName: 'Jane Buyer',
                phoneNumber: '08022222222',
                isVerified: true
            });
            await buyer.save();
            console.log(chalk.green('✓ Buyer created'));
        } else {
            console.log(chalk.yellow('✓ Buyer already exists'));
        }
        console.log(chalk.cyan(`   Email: buyer@marketplace.com / Password: Buyer@123`));

        // 5. Admin verifies the seller
        console.log(chalk.yellow('\n─── Step 5: Admin Verifies Seller ───'));
        const sellerToVerify = await MarketUser.findOne({ _id: seller._id, role: 'seller' });
        if (sellerToVerify && !sellerToVerify.adminVerified) {
            sellerToVerify.adminVerified = true;
            await sellerToVerify.save();
            console.log(chalk.green('✓ Seller verified by admin'));
        } else if (sellerToVerify && sellerToVerify.adminVerified) {
            console.log(chalk.yellow('✓ Seller was already verified'));
        } else {
            console.log(chalk.red('✗ Seller not found'));
        }

        // 6. Seller posts an item
        console.log(chalk.yellow('\n─── Step 6: Seller Posts an Item ───'));
        const productData = {
            name: 'iPhone 15 Pro Max',
            description: 'Latest Apple iPhone 15 Pro Max, 256GB storage, Deep Purple color. Brand new condition with original accessories.',
            price: { current: 1200000, discount: 5 },
            category: category._id,
            brand: 'Apple',
            inventory: { quantity: 15, sku: 'IP15PM-256-DP', lowStockAlert: 3 },
            status: 'active',
            sellerId: seller._id,
            images: [{ url: 'https://via.placeholder.com/400', isDefault: true }]
        };

        let product = await MarketProduct.findOne({ name: productData.name, sellerId: seller._id });
        if (!product) {
            product = new MarketProduct(productData);
            await product.save();
            console.log(chalk.green('✓ Product "iPhone 15 Pro Max" posted by seller'));
        } else {
            console.log(chalk.yellow('✓ Product already exists'));
        }

        console.log(chalk.green(`   Price: ₦1,200,000 (5% discount applied)`));
        console.log(chalk.green(`   Status: ${product.status}`));
        console.log(chalk.green(`   Inventory: ${product.inventory.quantity} units`));

        // Summary
        console.log(chalk.blue('\n══════════════════════════════════════════'));
        console.log(chalk.blue('         ALL STEPS COMPLETED!'));
        console.log(chalk.blue('══════════════════════════════════════════\n'));
        console.log(chalk.white('Credentials:'));
        console.log(chalk.cyan('   Admin:  ') + 'admin@campustrade.com / Admin@12345678');
        console.log(chalk.cyan('   Seller: ') + 'seller@marketplace.com / Seller@123');
        console.log(chalk.cyan('   Buyer:  ') + 'buyer@marketplace.com / Buyer@123');
        console.log(chalk.cyan('   Product:') + ' iPhone 15 Pro Max (₦1,200,000)');

    } catch (error) {
        console.error(chalk.red('Error:'), error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

run();
