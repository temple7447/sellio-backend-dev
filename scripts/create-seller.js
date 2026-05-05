const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const { MarketSeller } = require('../src/models/MarketUser');

async function createSellerAccount() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        const sellerData = {
            email: 'seller@example.com',
            password: 'password123',
            fullName: 'Test Seller',
            phoneNumber: '08087654321',
            businessName: 'Test Business Store',
            businessAddress: '123 Business Street, Lagos',
            governmentId: 'NG1234567890',
            role: 'seller',
            isVerified: true,
            adminVerified: true,
            bankAccount: {
                bankName: 'Guaranty Trust Bank (GTBank)',
                bankCode: '058',
                accountNumber: '0123456789',
                accountName: 'TEST SELLER BUSINESS'
            }
        };

        let seller = await MarketSeller.findOne({ email: sellerData.email });
        if (seller) {
            console.log(chalk.yellow(`\nSeller account already exists: ${sellerData.email}`));
            console.log(chalk.cyan('\n📋 Account Details:'));
            console.log(`  Email: ${seller.email}`);
            console.log(`  Password: password123`);
            console.log(`  Business: ${seller.businessName}`);
            console.log(`  Verified: ${seller.isVerified ? '✅' : '❌'}`);
            console.log(`  Admin Verified: ${seller.adminVerified ? '✅' : '❌'}`);
            if (seller.bankAccount) {
                console.log(`  Bank: ${seller.bankAccount.bankName}`);
                console.log(`  Account: ${seller.bankAccount.accountNumber}`);
            }
        } else {
            seller = new MarketSeller(sellerData);
            await seller.save();
            console.log(chalk.green('✓ Seller account created successfully!'));
            console.log(chalk.cyan('\n📋 Account Details:'));
            console.log(`  Email: ${seller.email}`);
            console.log(`  Password: password123`);
            console.log(`  Business: ${seller.businessName}`);
            console.log(`  Verified: ${seller.isVerified ? '✅' : '❌'}`);
            console.log(`  Admin Verified: ${seller.adminVerified ? '✅' : '❌'}`);
            console.log(`  Bank: ${seller.bankAccount.bankName}`);
            console.log(`  Account: ${seller.bankAccount.accountNumber}`);
        }

        console.log(chalk.cyan('\n✓ This seller is ready to:'));
        console.log('  • Withdraw funds (3% fee)');
        console.log('  • Sell products');
        console.log('  • Purchase trusted badge\n');

    } catch (error) {
        console.error(chalk.red('Error creating seller account:'), error.message);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

createSellerAccount();
