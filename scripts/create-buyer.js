const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const { MarketCustomer } = require('../src/models/MarketUser');

async function createBuyerAccount() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        const buyerData = {
            email: 'buyer@example.com',
            password: 'password123',
            fullName: 'Test Buyer',
            phoneNumber: '08012345678',
            role: 'customer',
            isVerified: true
        };

        let buyer = await MarketCustomer.findOne({ email: buyerData.email });
        if (buyer) {
            console.log(chalk.yellow(`Buyer account already exists: ${buyerData.email}`));
            console.log(chalk.green(`Email: ${buyer.email}`));
            console.log(chalk.green(`Password: password123`));
        } else {
            buyer = new MarketCustomer(buyerData);
            await buyer.save();
            console.log(chalk.green('✓ Buyer account created successfully!'));
            console.log(chalk.green(`Email: ${buyer.email}`));
            console.log(chalk.green(`Password: password123`));
        }

    } catch (error) {
        console.error(chalk.red('Error creating buyer account:'), error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

createBuyerAccount();
