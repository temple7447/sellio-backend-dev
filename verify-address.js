require('dotenv').config();
const mongoose = require('mongoose');
const { MarketUser } = require('./src/models/MarketUser');
const addressService = require('./src/services/address.service');
const chalk = require('chalk');

async function verifyAddressRefactor() {
    try {
        console.log(chalk.blue('Connecting to MongoDB for verification...'));
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(chalk.green('Connected.'));

        // 1. Find a test customer
        const customer = await MarketUser.findOne({ role: 'customer' });
        if (!customer) {
            console.log(chalk.yellow('No customer found for testing. Skipping.'));
            return;
        }
        const userId = customer._id;
        console.log(chalk.blue(`Testing with customer: ${customer.email} (${userId})`));

        // 2. Create an address
        console.log('\n--- Testing Create Address ---');
        const addrData = {
            fullName: 'Test User',
            phoneNumber: '08012345678',
            street: '123 Test Lane',
            city: 'Lagos',
            state: 'Lagos',
            country: 'Nigeria',
            zipCode: '100001',
            label: 'Home'
        };
        const newAddress = await addressService.createAddress(userId, addrData);
        console.log(chalk.green('Created address ID:'), newAddress._id);
        console.log('Address isDefault:', newAddress.isDefault);

        // 3. Create a second address (should not be default by default)
        console.log('\n--- Testing Second Address ---');
        const addrData2 = {
            ...addrData,
            street: '456 Office Way',
            label: 'Office'
        };
        const secondAddress = await addressService.createAddress(userId, addrData2);
        console.log(chalk.green('Created second address ID:'), secondAddress._id);
        console.log('Second Address isDefault:', secondAddress.isDefault);

        // 4. Update address to be default
        console.log('\n--- Testing Set Default ---');
        await addressService.setDefaultAddress(secondAddress._id, userId);
        const updatedSecond = await addressService.getAddressById(secondAddress._id, userId);
        const updatedFirst = await addressService.getAddressById(newAddress._id, userId);
        console.log('Second Address isDefault (should be true):', updatedSecond.isDefault);
        console.log('First Address isDefault (should be false):', updatedFirst.isDefault);

        // 5. Get all addresses
        console.log('\n--- Testing Get All Addresses ---');
        const allAddresses = await addressService.getAddresses(userId);
        console.log(chalk.green(`Retrieved ${allAddresses.length} addresses.`));
        allAddresses.forEach(a => console.log(`- ${a.label}: ${a.street} (Default: ${a.isDefault})`));

        // 6. Delete an address
        console.log('\n--- Testing Delete Address ---');
        await addressService.deleteAddress(newAddress._id, userId);
        console.log(chalk.green('Deleted first address.'));
        const remaining = await addressService.getAddresses(userId);
        console.log(`Remaining addresses: ${remaining.length}`);

        // Cleanup: remove the test address
        await addressService.deleteAddress(secondAddress._id, userId);
        console.log(chalk.green('Cleanup: deleted second test address.'));

        console.log(chalk.bold.green('\nVerification successful! All address operations working as expected.'));

    } catch (error) {
        console.error(chalk.red('Verification failed:'), error);
    } finally {
        await mongoose.disconnect();
    }
}

verifyAddressRefactor();
