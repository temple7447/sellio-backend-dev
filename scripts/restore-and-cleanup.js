const mongoose = require('mongoose');
require('dotenv').config();
const MarketProduct = require('../src/models/MarketProduct');
const { MarketUser } = require('../src/models/MarketUser');

async function restoreAndCleanup() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ Connected to MongoDB');

        // 1. Change draft products back to active
        const drafts = await MarketProduct.find({ 
            name: { $in: [
                'Louis Vuitton Bag', 'Plum laundry and bathing soap', 'Polly Foam',
                'SELLIO BRANDED CAP', 'Soft Fibre Pillow', 'Pure radiance',
                'Polly Foam Super Pillow', 'FEMALE BRANDED POLO'
            ]}
        });
        
        for (const product of drafts) {
            product.status = 'active';
            await product.save();
            console.log(`✓ Restored "${product.name}" to active`);
        }
        console.log(`\n✓ Total products restored: ${drafts.length}`);

        // 2. Delete the 12 test products
        const testProductNames = [
            'iPhone 14 Pro', 'Samsung Galaxy S23', 'MacBook Air M2', 'Dell XPS 15',
            'Sony WH-1000XM5', 'AirPods Pro 2', 'iPad Air 5', 'Apple Watch Series 8',
            'PlayStation 5', 'Nintendo Switch OLED', 'Canon EOS R6', 'LG 55" OLED TV'
        ];

        const seller = await MarketUser.findOne({ email: 'seller@test.com' });
        
        const deletedProducts = await MarketProduct.deleteMany({
            sellerId: seller._id,
            name: { $in: testProductNames }
        });
        console.log(`\n✓ Deleted ${deletedProducts.deletedCount} test products`);

        // 3. Delete test users
        const deletedUsers = await MarketUser.deleteMany({
            email: { $in: ['seller@test.com', 'buyer@test.com'] }
        });
        console.log(`✓ Deleted ${deletedUsers.deletedCount} test users`);

        console.log('\n✓ Cleanup complete!');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

restoreAndCleanup();
