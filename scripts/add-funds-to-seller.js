require('dotenv').config();
const mongoose = require('mongoose');
const { MarketUser } = require('../src/models/MarketUser');
const MarketWallet = require('../src/models/MarketWallet');
const WalletTransaction = require('../src/models/WalletTransaction');

const EMAIL = 'seller@example.com';
const AMOUNT = 20000;

async function addFunds() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find the user by email
        const user = await MarketUser.findOne({ email: EMAIL });
        
        if (!user) {
            console.error(`User with email ${EMAIL} not found`);
            process.exit(1);
        }

        console.log(`Found user: ${user.email} (${user.role})`);

        // Find or create wallet
        let wallet = await MarketWallet.findOne({ userId: user._id });
        
        if (!wallet) {
            wallet = await MarketWallet.create({ 
                userId: user._id,
                balance: 0,
                currency: 'NGN'
            });
            console.log('Created new wallet for user');
        }

        const balanceBefore = wallet.balance;
        const balanceAfter = balanceBefore + AMOUNT;

        // Update wallet balance
        wallet.balance = balanceAfter;
        wallet.lastTransactionAt = new Date();
        await wallet.save();

        // Record transaction
        const transaction = await WalletTransaction.create({
            userId: user._id,
            type: 'deposit',
            amount: AMOUNT,
            balanceBefore,
            balanceAfter,
            reference: `MANUAL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            description: 'Manual credit by admin',
            status: 'completed',
            paymentGateway: 'manual'
        });

        console.log(`\nSuccessfully added ${AMOUNT} NGN to ${EMAIL}`);
        console.log(`Balance before: ${balanceBefore} NGN`);
        console.log(`Balance after: ${balanceAfter} NGN`);
        console.log(`Transaction reference: ${transaction.reference}`);

        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
        process.exit(0);
        
    } catch (error) {
        console.error('Error:', error.message);
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
        }
        process.exit(1);
    }
}

addFunds();
