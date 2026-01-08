const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const MarketCategory = require('../src/models/MarketCategory');

async function editCategory() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log(chalk.yellow('Usage: node scripts/edit-category.js <name_or_id> <field=value> [field2=value2] ...'));
        console.log(chalk.gray('Fields: name, description, image, isActive (true/false), order (number), parent (id)'));
        process.exit(1);
    }

    const identifier = args[0];
    const updateArgs = args.slice(1);

    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        // Find category
        let category;
        if (mongoose.Types.ObjectId.isValid(identifier)) {
            category = await MarketCategory.findById(identifier);
        } else {
            category = await MarketCategory.findOne({ name: { $regex: new RegExp(`^${identifier}$`, 'i') } });
        }

        if (!category) {
            console.log(chalk.red(`✗ Category "${identifier}" not found.`));
            process.exit(1);
        }

        console.log(chalk.blue(`Found category: ${category.name} (${category._id})`));

        // Prepare updates
        const updates = {};
        updateArgs.forEach(arg => {
            const [key, value] = arg.split('=');
            if (key && value !== undefined) {
                // Type conversion
                if (key === 'isActive') {
                    updates[key] = value.toLowerCase() === 'true';
                } else if (key === 'order') {
                    updates[key] = parseInt(value);
                } else if (key === 'parent' && value.toLowerCase() === 'null') {
                    updates[key] = null;
                } else {
                    updates[key] = value;
                }
            }
        });

        if (Object.keys(updates).length === 0) {
            console.log(chalk.yellow('No valid updates provided.'));
            process.exit(0);
        }

        // Apply updates
        Object.assign(category, updates);
        await category.save();

        console.log(chalk.green(`✓ Category updated successfully!`));
        console.log(chalk.gray('Updated fields:'), updates);

    } catch (error) {
        console.error(chalk.red('✗ Error editing category:'), error.message);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

editCategory();
