const mongoose = require('mongoose');
require('dotenv').config();

async function checkCategories() {
    await mongoose.connect(process.env.MONGODB_URI);
    const MarketCategory = require('../src/models/MarketCategory');
    const categories = await MarketCategory.find({});
    console.log('Categories in DB:', categories.map(c => ({ name: c.name, slug: c.slug })));
    await mongoose.connection.close();
}

checkCategories();
