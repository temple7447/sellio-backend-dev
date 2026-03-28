require('dotenv').config();
const mongoose = require('mongoose');
const { MarketUser } = require('../src/models/MarketUser');
const WalletTransaction = require('../src/models/WalletTransaction');

async function checkBuyerWallet() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sellio-marketplace');
        
        // Find all customers with non-zero balance
        console.log('\n=== ALL CUSTOMERS WITH WALLET BALANCE ===');
        const customers = await MarketUser.find({ 
            role: 'customer',
            'wallet.balance': { $gt: 0 }
        }).select('email fullName wallet.balance');
        
        if (customers.length === 0) {
            console.log('No customers with balance > 0 found');
        } else {
            customers.forEach(c => {
                console.log(`- ${c.email} (${c.fullName}): ₦${c.wallet?.balance || 0}`);
            });
        }
        
        // Also check all users with non-zero balance
        console.log('\n=== ALL USERS WITH WALLET BALANCE > 0 ===');
        const allUsers = await MarketUser.find({ 
            'wallet.balance': { $gt: 0 }
        }).select('email fullName role wallet.balance');
        
        if (allUsers.length === 0) {
            console.log('No users with balance > 0 found');
        } else {
            allUsers.forEach(u => {
                console.log(`- ${u.email} (${u.role}): ₦${u.wallet?.balance || 0}`);
            });
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await mongoose.connection.close();
    }
}

checkBuyerWallet();
