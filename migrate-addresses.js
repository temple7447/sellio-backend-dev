require('dotenv').config();
const mongoose = require('mongoose');
const { MarketUser, MarketCustomer } = require('./src/models/MarketUser');
const MarketAddress = require('./src/models/MarketAddress');
const config = require('./src/config/config');

async function migrateAddresses() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/campus-trade');
        console.log('Connected successfully.');

        // Find all customers with shipping addresses
        // Since we removed it from the schema, we might need to use a raw query or find them via MarketUser
        const customers = await mongoose.connection.collection('marketusers').find({
            role: 'customer',
            shippingAddresses: { $exists: true, $not: { $size: 0 } }
        }).toArray();

        console.log(`Found ${customers.length} customers with addresses to migrate.`);

        let migratedCount = 0;
        for (const customer of customers) {
            console.log(`Migrating addresses for customer: ${customer.email} (${customer._id})`);

            const addresses = customer.shippingAddresses;
            for (const addr of addresses) {
                const newAddress = new MarketAddress({
                    userId: customer._id,
                    fullName: addr.fullName,
                    phoneNumber: addr.phoneNumber,
                    street: addr.street,
                    city: addr.city,
                    state: addr.state,
                    country: addr.country || 'Nigeria',
                    zipCode: addr.zipCode,
                    isDefault: addr.isDefault || false,
                    label: 'Home' // Default label for migrated addresses
                });

                await newAddress.save();
                migratedCount++;
            }
        }

        console.log(`Migration complete! Successfully migrated ${migratedCount} addresses.`);

        // Optional: Remove the field from the collection after migration
        // Note: Use with caution.
        // await mongoose.connection.collection('marketusers').updateMany(
        //     { role: 'customer' },
        //     { $unset: { shippingAddresses: "" } }
        // );
        // console.log('Cleaned up shippingAddresses field from MarketUser collection.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

migrateAddresses();
