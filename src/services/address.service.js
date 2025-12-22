const MarketAddress = require('../models/MarketAddress');

class AddressService {
    async getAddresses(userId) {
        try {
            return await MarketAddress.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
        } catch (error) {
            throw { status: 500, message: 'Failed to fetch addresses', error: error.message };
        }
    }

    async getAddressById(addressId, userId) {
        try {
            const address = await MarketAddress.findOne({ _id: addressId, userId });
            if (!address) {
                throw { status: 404, message: 'Address not found' };
            }
            return address;
        } catch (error) {
            throw { status: error.status || 500, message: error.message };
        }
    }

    async createAddress(userId, addressData) {
        try {
            const finalAddressData = { ...addressData };
            // If this is the first address, make it default
            const count = await MarketAddress.countDocuments({ userId });
            if (count === 0) {
                finalAddressData.isDefault = true;
            } else if (finalAddressData.isDefault) {
                // If setting this as default, unset others
                await MarketAddress.updateMany({ userId }, { isDefault: false });
            }

            const address = new MarketAddress({
                ...finalAddressData,
                userId
            });

            await address.save();
            return address;
        } catch (error) {
            throw { status: 400, message: 'Failed to create address', error: error.message };
        }
    }

    async updateAddress(addressId, userId, addressData) {
        try {
            if (addressData.isDefault) {
                await MarketAddress.updateMany({ userId, _id: { $ne: addressId } }, { isDefault: false });
            }

            const address = await MarketAddress.findOneAndUpdate(
                { _id: addressId, userId },
                { $set: addressData },
                { new: true, runValidators: true }
            );

            if (!address) {
                throw { status: 404, message: 'Address not found' };
            }

            // If we unset default on the ONLY address, set it back to true
            if (!address.isDefault) {
                const hasDefault = await MarketAddress.findOne({ userId, isDefault: true });
                if (!hasDefault) {
                    address.isDefault = true;
                    await address.save();
                }
            }

            return address;
        } catch (error) {
            throw { status: error.status || 400, message: error.message };
        }
    }

    async deleteAddress(addressId, userId) {
        try {
            const address = await MarketAddress.findOneAndDelete({ _id: addressId, userId });
            if (!address) {
                throw { status: 404, message: 'Address not found' };
            }

            // If we deleted the default address, set another one as default
            if (address.isDefault) {
                const anotherAddress = await MarketAddress.findOne({ userId });
                if (anotherAddress) {
                    anotherAddress.isDefault = true;
                    await anotherAddress.save();
                }
            }

            return { success: true, message: 'Address deleted' };
        } catch (error) {
            throw { status: error.status || 500, message: error.message };
        }
    }

    async setDefaultAddress(addressId, userId) {
        try {
            await MarketAddress.updateMany({ userId }, { isDefault: false });
            const address = await MarketAddress.findOneAndUpdate(
                { _id: addressId, userId },
                { $set: { isDefault: true } },
                { new: true }
            );

            if (!address) {
                throw { status: 404, message: 'Address not found' };
            }

            return address;
        } catch (error) {
            throw { status: error.status || 500, message: error.message };
        }
    }
}

module.exports = new AddressService();
