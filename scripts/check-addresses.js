require('dotenv').config();
const mongoose = require('mongoose');

async function checkAddresses() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/campus-trade');
        const usersWithAddresses = await mongoose.connection.collection('marketusers').find({
            shippingAddresses: { $exists: true }
        }).toArray();

        console.log(`Total users with shippingAddresses field: ${usersWithAddresses.length}`);
        if (usersWithAddresses.length > 0) {
            console.log('Sample user addresses:', JSON.stringify(usersWithAddresses[0].shippingAddresses, null, 2));
        }

        const roleCount = await mongoose.connection.collection('marketusers').countDocuments({ role: 'customer' });
        console.log(`Total customer roles: ${roleCount}`);

    } catch (error) {
        console.error('Check failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkAddresses();
