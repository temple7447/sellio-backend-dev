const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const { MarketUser } = require('../src/models/MarketUser');
const walletService = require('../src/services/wallet.service');

async function creditSellerWallet() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        const seller = await MarketUser.findOne({ email: 'seller@example.com' });
        if (!seller) {
            console.log(chalk.red('✗ Seller not found'));
            return;
        }

        console.log(chalk.blue(`\nCrediting wallet for: ${seller.email} (${seller.businessName})`));
        const result = await walletService.credit(seller._id, 3000, 'Manual wallet credit', {
            type: 'deposit',
            paymentGateway: 'system'
        });

        console.log(chalk.green(`\n✓ Wallet credited successfully!`));
        console.log(chalk.green(`Balance before: ₦${result.balanceBefore.toLocaleString()}`));
        console.log(chalk.green(`Amount added: ₦3,000`));
        console.log(chalk.green(`New balance: ₦${result.balanceAfter.toLocaleString()}`));

    } catch (error) {
        console.error(chalk.red('Error crediting wallet:'), error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

creditSellerWallet();
