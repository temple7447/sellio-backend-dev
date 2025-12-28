const { MarketUser } = require('../models/MarketUser');
const config = require('../config/config');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const MarketProduct = require('../models/MarketProduct');
class AdminService {
    async registerAdmin(data) {
        if (data.setupKey !== config.ADMIN_SETUP_KEY) {
            throw { status: 401, message: 'Invalid setup key' };
        }

        const adminExists = await MarketUser.findOne({ role: 'admin' });
        if (adminExists) {
            throw { status: 403, message: 'Admin already registered' };
        }

        const admin = new MarketUser({
            ...data,
            role: 'admin',
            isVerified: true,
            permissions: ['manage_sellers', 'manage_customers', 'manage_products', 'manage_categories', 'manage_orders']
        });

        await admin.save();
        const token = jwt.sign({ id: admin._id, role: admin.role }, config.JWT_SECRET, { expiresIn: '24h' });

        return {
            message: 'Admin registration successful',
            token,
            email: admin.email
        };
    }

    async getAllUsers(query) {
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 10;
        const skip = (page - 1) * limit;

        const filter = { isDeleted: { $ne: true } }; // Exclude deleted users
        if (query.role) filter.role = query.role;
        if (query.isVerified !== undefined) {
            filter.isVerified = query.isVerified === 'true';
        }

        if (query.search) {
            const searchRegex = new RegExp(query.search, 'i');
            filter.$or = [
                { email: searchRegex },
                { fullName: searchRegex },
                { businessName: searchRegex }
            ];
        }

        const [users, total] = await Promise.all([
            MarketUser.find(filter)
                .select('-password')
                .populate({
                    path: 'role',
                    select: 'businessName businessAddress governmentId adminVerified'
                })
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 }),
            MarketUser.countDocuments(filter)
        ]);

        const formattedUsers = users.map(user => ({
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            phoneNumber: user.phoneNumber,
            role: user.role,
            isVerified: user.isVerified,
            createdAt: user.createdAt,
            ...(user.role === 'seller' && {
                businessName: user.businessName,
                businessAddress: user.businessAddress,
                governmentId: user.governmentId,
                adminVerified: user.adminVerified,
                hasBankInfo: !!(user.bankAccount && (user.bankAccount.bankName || user.bankAccount.accountNumber || user.bankAccount.accountName)),
                bankAccount: user.bankAccount ? {
                    bankName: user.bankAccount.bankName || null,
                    accountNumber: user.bankAccount.accountNumber || null,
                    accountName: user.bankAccount.accountName || null
                } : null
            })
        }));

        return {
            users: formattedUsers,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                currentPage: page,
                limit
            }
        };
    }

    async verifySeller(sellerId) {
        const seller = await MarketUser.findOne({ _id: sellerId, role: 'seller' });
        if (!seller) {
            throw { status: 404, message: 'Seller not found' };
        }

        seller.adminVerified = true;
        await seller.save();

        return {
            message: 'Seller verified successfully',
            seller: {
                email: seller.email,
                businessName: seller.businessName,
                adminVerified: seller.adminVerified
            }
        };
    }

    async deleteUser(userId, reason = 'Admin deleted') {
        // Find the user
        const user = await MarketUser.findById(userId);
        if (!user) {
            throw { status: 404, message: 'User not found' };
        }

        // Check if user is already deleted
        if (user.isDeleted) {
            throw { status: 400, message: 'User is already deleted' };
        }

        // Cannot delete admin users
        if (user.role === 'admin') {
            throw { status: 403, message: 'Cannot delete admin users' };
        }

        // Prepare anonymized data
        const anonymizedData = {
            email: `deleted_${userId}@anonymized.local`,
            fullName: 'Deleted User',
            phoneNumber: '0000000000',
            profileImage: null,
            isDeleted: true,
            deletedAt: new Date(),
            anonymizedAt: new Date(),
            deletionReason: reason
        };

        // Role-specific anonymization
        if (user.role === 'seller') {
            anonymizedData.businessName = 'Deleted Business';
            anonymizedData.businessAddress = 'Anonymized';
            anonymizedData.governmentId = null;
            anonymizedData['bankAccount.bankName'] = null;
            anonymizedData['bankAccount.accountNumber'] = null;
            anonymizedData['bankAccount.accountName'] = null;
        }

        // Update user with anonymized data
        await MarketUser.findByIdAndUpdate(userId, anonymizedData);

        return {
            message: 'User soft deleted and anonymized successfully',
            deletedUser: {
                id: userId,
                originalEmail: user.email,
                role: user.role,
                deletedAt: anonymizedData.deletedAt,
                reason: reason
            }
        };
    }

    async adminUpdateProductStatus(productId, status) {
        try {
            const validStatuses = ['draft', 'active', 'inactive', 'banned'];
            if (!validStatuses.includes(status)) {
                throw {
                    status: 400,
                    message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                };
            }

            const product = await MarketProduct.findById(productId)
                .populate('sellerId', 'businessName email');

            if (!product) {
                throw { status: 404, message: 'Product not found' };
            }

            product.status = status;
            await product.save();

            return {
                id: product._id,
                name: product.name,
                status: product.status,
                seller: {
                    id: product.sellerId._id,
                    businessName: product.sellerId.businessName,
                    email: product.sellerId.email
                },
                updatedAt: product.updatedAt
            };
        } catch (error) {
            throw {
                status: error.status || 500,
                message: error.message
            };
        }
    }


    async adminDeleteProduct(productId) {
        try {
            if (!mongoose.Types.ObjectId.isValid(productId)) {
                throw {
                    status: 400,
                    code: 'INVALID_ID',
                    message: 'Invalid product ID format'
                };
            }

            const product = await MarketProduct.findById(productId);

            if (!product) {
                throw {
                    status: 404,
                    code: 'NOT_FOUND',
                    message: 'Product not found'
                };
            }

            // Store product details before deletion
            const productDetails = {
                id: product._id,
                name: product.name,
                sellerId: product.sellerId,
                deletedAt: new Date()
            };

            // Delete the product
            await MarketProduct.deleteOne({ _id: productId });

            return {
                success: true,
                message: 'Product deleted successfully by admin',
                data: productDetails
            };
        } catch (error) {
            console.error('Admin product deletion error:', {
                error,
                productId
            });

            if (error.code) throw error;

            throw {
                status: 500,
                code: 'DELETION_ERROR',
                message: 'Failed to delete product',
                details: error.message
            };
        }
    }


    async getAdminProducts(query) {
        const {
            status,
            page = 1,
            limit = 10,
            sellerId,
            category,
            search,
            sort = '-createdAt'
        } = query;
        const skip = (page - 1) * limit;

        // Build filter
        const filter = {};
        if (status) filter.status = status;
        if (sellerId) filter.sellerId = sellerId;
        if (category) filter.category = category;
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const [products, total] = await Promise.all([
            MarketProduct.find(filter)
                .populate('sellerId', 'businessName email')
                .populate('category', 'name')
                .skip(skip)
                .limit(limit)
                .sort(sort),
            MarketProduct.countDocuments(filter)
        ]);

        return {
            products,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                currentPage: page,
                limit
            }
        };
    }

    async getActiveAdminProducts(query) {
        const {
            page = 1,
            limit = 10,
            sort = '-createdAt'
        } = query;
        const skip = (page - 1) * limit;

        // Build filter for active products only
        const filter = { status: 'active' };

        const [products, total] = await Promise.all([
            MarketProduct.find(filter)
                .populate('sellerId', 'businessName email')
                .populate('category', 'name')
                .skip(skip)
                .limit(limit)
                .sort(sort),
            MarketProduct.countDocuments(filter)
        ]);

        // Format response
        const formattedProducts = products.map(product => ({
            id: product._id,
            name: product.name,
            price: product.price,
            category: product.category,
            seller: product.sellerId,
            inventory: product.inventory,
            images: product.images,
            status: product.status,
            metadata: product.metadata,
            createdAt: product.createdAt
        }));

        return {
            products: formattedProducts,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        };
    }

    async adminUpdateProduct(productId, updates) {
        try {
            const product = await MarketProduct.findById(productId)
                .populate('sellerId', 'businessName email');

            if (!product) {
                throw { status: 404, message: 'Product not found' };
            }

            // Allow updating specific fields
            const allowedUpdates = [
                'name',
                'description',
                'price',
                'status',
                'category',
                'inventory'
            ];

            // Filter out invalid update fields
            Object.keys(updates).forEach(key => {
                if (!allowedUpdates.includes(key)) {
                    delete updates[key];
                }
            });

            // Apply updates
            Object.assign(product, updates);
            await product.save();

            return {
                id: product._id,
                name: product.name,
                seller: {
                    id: product.sellerId._id,
                    businessName: product.sellerId.businessName,
                    email: product.sellerId.email
                },
                updatedFields: Object.keys(updates),
                updatedAt: product.updatedAt
            };
        } catch (error) {
            throw {
                status: error.status || 500,
                message: error.message
            };
        }
    }

    async adminUpdateUser(userId, updates) {
        try {
            const user = await MarketUser.findById(userId);
            if (!user) {
                throw { status: 404, message: 'User not found' };
            }

            // Define allowed updates based on user role
            const allowedUpdates = {
                seller: ['businessName', 'businessAddress', 'phoneNumber', 'fullName', 'email', 'adminVerified', 'isVerified'],
                customer: ['fullName', 'phoneNumber', 'email', 'isVerified'],
                admin: ['fullName', 'phoneNumber', 'email']
            };

            // Filter out invalid update fields based on user role
            Object.keys(updates).forEach(key => {
                if (!allowedUpdates[user.role].includes(key)) {
                    delete updates[key];
                }
            });

            // Protect admin role modification
            if (user.role === 'admin' && updates.role) {
                delete updates.role;
            }

            // Apply updates
            Object.assign(user, updates);
            await user.save();

            return {
                id: user._id,
                email: user.email,
                role: user.role,
                fullName: user.fullName,
                updatedFields: Object.keys(updates),
                ...(user.role === 'seller' && {
                    businessName: user.businessName,
                    businessAddress: user.businessAddress,
                    adminVerified: user.adminVerified
                })
            };
        } catch (error) {
            throw {
                status: error.status || 500,
                message: error.message
            };
        }
    }
    async getSellerBankInfo(sellerId) {
        const seller = await MarketUser.findOne({ _id: sellerId, role: 'seller' });
        if (!seller) {
            throw { status: 404, message: 'Seller not found' };
        }
        const bank = seller.bankAccount || null;
        return {
            success: true,
            seller: {
                id: seller._id,
                email: seller.email,
                businessName: seller.businessName
            },
            hasBankInfo: !!bank,
            bankAccount: bank ? {
                bankName: bank.bankName || null,
                accountNumber: bank.accountNumber || null,
                accountName: bank.accountName || null
            } : null
        };
    }

    // Reward Settings Management
    async getRewardSettings() {
        const RewardSettings = require('../models/RewardSettings');
        const settings = await RewardSettings.getSettings();
        return settings;
    }

    async updateRewardSettings(adminId, updates) {
        const RewardSettings = require('../models/RewardSettings');

        // Validate updates
        const allowedUpdates = [
            'referralBonus.enabled',
            'referralBonus.amount',
            'cashback.enabled',
            'cashback.amount',
            'cashback.minimumPurchase'
        ];

        const updateKeys = Object.keys(updates);
        const isValidOperation = updateKeys.every(key => allowedUpdates.includes(key));

        if (!isValidOperation) {
            throw {
                status: 400,
                message: 'Invalid updates',
                allowedUpdates
            };
        }

        // Validate numeric values
        if (updates['referralBonus.amount'] !== undefined && updates['referralBonus.amount'] < 0) {
            throw { status: 400, message: 'Referral bonus amount must be >= 0' };
        }
        if (updates['cashback.amount'] !== undefined && updates['cashback.amount'] < 0) {
            throw { status: 400, message: 'Cashback amount must be >= 0' };
        }
        if (updates['cashback.minimumPurchase'] !== undefined && updates['cashback.minimumPurchase'] < 0) {
            throw { status: 400, message: 'Minimum purchase must be >= 0' };
        }

        // Get current settings
        let settings = await RewardSettings.getSettings();

        // Apply updates
        Object.keys(updates).forEach(key => {
            const keys = key.split('.');
            if (keys.length === 2) {
                settings[keys[0]][keys[1]] = updates[key];
            }
        });

        settings.lastUpdatedBy = adminId;
        await settings.save();

        return {
            message: 'Reward settings updated successfully',
            settings
        };
    }

    async getReferrals(query) {
        const MarketReferral = require('../models/MarketReferral');
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 10;
        const skip = (page - 1) * limit;

        const [referrals, total] = await Promise.all([
            MarketReferral.find()
                .populate('referrerId', 'email fullName businessName role')
                .populate('referredUserId', 'email fullName phoneNumber createdAt')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            MarketReferral.countDocuments()
        ]);

        const formattedReferrals = referrals.map(ref => ({
            referredUser: {
                id: ref.referredUserId?._id,
                email: ref.referredUserId?.email,
                fullName: ref.referredUserId?.fullName,
                phoneNumber: ref.referredUserId?.phoneNumber,
                signupDate: ref.signupDate || ref.referredUserId?.createdAt
            },
            referrer: {
                id: ref.referrerId?._id,
                email: ref.referrerId?.email,
                fullName: ref.referrerId?.fullName,
                businessName: ref.referrerId?.businessName,
                role: ref.referrerId?.role
            },
            bonus: {
                amount: ref.bonusAmount,
                status: ref.status === 'bonus_paid' ? 'paid' : 'pending',
                paidAt: ref.completionDate,
                transactionId: ref.transactionId,
                message: ref.status === 'bonus_paid' ? 'Paid' : (ref.status === 'failed' ? 'Payout Failed' : 'Pending email verification')
            }
        }));

        return {
            referrals: formattedReferrals,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                currentPage: page,
                limit
            }
        };
    }
}

module.exports = new AdminService();
