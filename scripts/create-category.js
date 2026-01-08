const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const MarketCategory = require('../src/models/MarketCategory');

async function createCategory() {
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.log(chalk.yellow('Usage: node scripts/create-category.js <name> [description] [image_url] [parent_id]'));
        process.exit(1);
    }

    const [name, description, image, parent] = args;

    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        // Check if category already exists
        const existing = await MarketCategory.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existing) {
            console.log(chalk.red(`✗ Category "${name}" already exists.`));
            process.exit(1);
        }

        const category = new MarketCategory({
            name,
            description: description || '',
            image: image || null,
            parent: parent || null,
            isActive: true
        });

        await category.save();
        console.log(chalk.green(`✓ Category "${name}" created successfully!`));
        console.log(chalk.gray(`ID: ${category._id}`));
        console.log(chalk.gray(`Slug: ${category.slug}`));

    } catch (error) {
        console.error(chalk.red('✗ Error creating category:'), error.message);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

createCategory();
