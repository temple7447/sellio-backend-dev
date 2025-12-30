const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const { MarketUser, MarketSeller, MarketAdmin, MarketCustomer } = require('../src/models/MarketUser');
const MarketProduct = require('../src/models/MarketProduct');
const MarketCategory = require('../src/models/MarketCategory');

async function populateData() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        // 1. Ensure Categories exist
        const categories = [
            { name: 'Electronics', description: 'Gadgets and electronic devices' },
            { name: 'Mobile Phones', description: 'Smartphones and accessories' },
            { name: 'Computers', description: 'Laptops, desktops and peripherals' },
            { name: 'Home Appliances', description: 'Kitchen and home gadgets' }
        ];

        const createdCategories = {};
        for (const catData of categories) {
            let category = await MarketCategory.findOne({ name: catData.name });
            if (!category) {
                category = new MarketCategory({ ...catData, isActive: true });
                await category.save();
                console.log(chalk.green(`✓ Created category: ${catData.name}`));
            } else {
                console.log(chalk.yellow(`Category ${catData.name} already exists`));
            }
            createdCategories[catData.name] = category;
        }

        const electronicsCategory = createdCategories['Electronics'];

        // 1.5 Create Super Admin
        const adminData = {
            email: 'starukido@gmail.com',
            password: 'admin',
            fullName: 'Super Admin',
            phoneNumber: '0000000000',
            role: 'admin',
            isVerified: true,
            permissions: ['manage_sellers', 'manage_customers', 'manage_products', 'manage_categories', 'manage_orders']
        };

        let admin = await MarketUser.findOne({ email: adminData.email });
        if (!admin) {
            admin = new MarketAdmin(adminData);
            await admin.save();
            console.log(chalk.green(`✓ Created super admin: ${adminData.email}`));
        } else {
            console.log(chalk.yellow(`Super admin ${adminData.email} already exists`));
        }

        // 2. Create Initial 3 Sellers
        const initialSellersData = [
            {
                email: 'test_seller1@example.com', password: 'password123', fullName: 'John Doe',
                phoneNumber: '08123456789', businessName: 'John Electronics', businessAddress: '123 Main St, Lagos',
                governmentId: 'https://via.placeholder.com/150', adminVerified: true, isVerified: true
            },
            {
                email: 'test_seller2@example.com', password: 'password123', fullName: 'Jane Smith',
                phoneNumber: '08123456790', businessName: 'Jane Gadgets', businessAddress: '456 Side St, Abuja',
                governmentId: 'https://via.placeholder.com/150', adminVerified: true, isVerified: true
            },
            {
                email: 'test_seller3@example.com', password: 'password123', fullName: 'Bob Brown',
                phoneNumber: '08123456791', businessName: 'Bob Tech', businessAddress: '789 Back St, Ibadan',
                governmentId: 'https://via.placeholder.com/150', adminVerified: true, isVerified: true
            }
        ];

        const allSellers = [];

        for (const data of initialSellersData) {
            let seller = await MarketUser.findOne({ email: data.email });
            if (!seller) {
                seller = new MarketSeller(data);
                await seller.save();
                console.log(chalk.green(`✓ Created initial seller: ${data.email}`));
            } else {
                console.log(chalk.yellow(`Seller ${data.email} already exists`));
            }
            allSellers.push(seller);
        }

        // 2.5 Create 5 Additional Bulk Sellers
        for (let i = 1; i <= 5; i++) {
            const bulkSellerData = {
                email: `bulk_seller${i}@example.com`,
                password: 'password123',
                fullName: `Bulk Seller ${i}`,
                phoneNumber: `0900000000${i}`,
                businessName: `Bulk Business ${i}`,
                businessAddress: `${i}00 Bulk Street, City`,
                governmentId: 'https://via.placeholder.com/150',
                adminVerified: true,
                isVerified: true
            };

            let seller = await MarketUser.findOne({ email: bulkSellerData.email });
            if (!seller) {
                seller = new MarketSeller(bulkSellerData);
                await seller.save();
                console.log(chalk.green(`✓ Created bulk seller: ${bulkSellerData.email}`));
            } else {
                console.log(chalk.yellow(`Bulk seller ${bulkSellerData.email} already exists`));
            }
            allSellers.push(seller);
        }

        // 3. Create 20 Customers
        console.log(chalk.blue('\nCreating 20 customers...'));
        for (let i = 1; i <= 20; i++) {
            const customerData = {
                email: `customer${i}@example.com`,
                password: 'password123',
                fullName: `Test Customer ${i}`,
                phoneNumber: `070000000${i.toString().padStart(2, '0')}`,
                role: 'customer',
                isVerified: true
            };

            let customer = await MarketUser.findOne({ email: customerData.email });
            if (!customer) {
                customer = new MarketCustomer(customerData);
                await customer.save();
                if (i % 5 === 0) console.log(chalk.green(`✓ Created ${i} customers so far...`));
            }
        }

        // 4. Create unique products for all sellers (old and new)
        console.log(chalk.blue('\nPopulating products for all sellers...'));

        const productTemplates = [
            { name: 'iPhone 13', desc: 'Latest Apple iPhone', price: 900000, cat: 'Mobile Phones' },
            { name: 'MacBook Pro', desc: 'Powerful work laptop', price: 1500000, cat: 'Computers' },
            { name: 'Samsung S22', desc: 'Flagship Android phone', price: 600000, cat: 'Mobile Phones' },
            { name: 'Sony Headphones', desc: 'Noise cancelling headphones', price: 120000, cat: 'Electronics' },
            { name: 'Dell XPS 13', desc: 'Ultra-thin laptop', price: 1100000, cat: 'Computers' },
            { name: 'Magic Mouse', desc: 'Ergonomic wireless mouse', price: 45000, cat: 'Electronics' },
            { name: 'AirPods Pro', desc: 'True wireless earbuds', price: 150000, cat: 'Electronics' },
            { name: 'iPad Air', desc: 'Slim and powerful tablet', price: 400000, cat: 'Electronics' }
        ];

        for (let i = 0; i < allSellers.length; i++) {
            const seller = allSellers[i];
            // Each seller gets at least one product
            const template = productTemplates[i % productTemplates.length];
            const productName = `${template.name} - ${seller.businessName}`;

            let product = await MarketProduct.findOne({ name: productName, sellerId: seller._id });
            if (!product) {
                product = new MarketProduct({
                    name: productName,
                    description: template.desc,
                    price: { current: template.price },
                    inventory: { quantity: 10 },
                    status: 'active',
                    sellerId: seller._id,
                    category: createdCategories[template.cat]._id,
                    images: [{ url: 'https://via.placeholder.com/300', isDefault: true }]
                });
                await product.save();
                console.log(chalk.green(`✓ Product "${productName}" created for ${seller.email}`));
            } else {
                // Update existing product quantity to 10
                product.inventory.quantity = 10;
                product.status = 'active';
                await product.save();
                console.log(chalk.yellow(`✓ Updated product "${productName}" stock limit to 10`));
            }
        }

        console.log(chalk.blue('\nBulk data population completed successfully!'));
    } catch (error) {
        console.error(chalk.red('Error populating data:'), error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

populateData();

