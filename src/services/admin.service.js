const { MarketUser } = require('../models/MarketUser');
const config = require('../config/config');
const jwt = require('jsonwebtoken');

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

        const filter = {};
        if (query.role) filter.role = query.role;
        if (query.isVerified !== undefined) {
            filter.isVerified = query.isVerified === 'true';
        }

        const [users, total] = await Promise.all([
            MarketUser.find(filter)
                .select('-password')
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 }),
            MarketUser.countDocuments(filter)
        ]);

        return {
            users,
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
