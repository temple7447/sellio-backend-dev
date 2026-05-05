const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();
const { MarketCustomer } = require('../src/models/MarketUser');
const walletService = require('../src/services/wallet.service');

async function creditBuyerWallet() {
    try {
        console.log(chalk.blue('Connecting to MongoDB...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('✓ Connected to MongoDB'));

        const buyer = await MarketCustomer.findOne({ email: 'buyer@example.com' });
        if (!buyer) {
            console.log(chalk.red('✗ Buyer account not found'));
            return;
        }

        console.log(chalk.blue(`\nCrediting wallet for: ${buyer.email}`));
        const result = await walletService.credit(buyer._id, 3000, 'Manual wallet credit', {
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

creditBuyerWallet();
