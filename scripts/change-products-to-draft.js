const mongoose = require('mongoose');
require('dotenv').config();
const MarketProduct = require('../src/models/MarketProduct');

async function changeProductsToDraft() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ Connected to MongoDB');

        const products = await MarketProduct.find({ status: 'active' }).limit(8);
        
        for (const product of products) {
            product.status = 'draft';
            await product.save();
            console.log(`✓ Changed "${product.name}" to draft`);
        }

        console.log(`\n✓ Total products changed to draft: ${products.length}`);
        
        const remaining = await MarketProduct.countDocuments({ status: 'active' });
        console.log(`Remaining active products: ${remaining}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

changeProductsToDraft();
