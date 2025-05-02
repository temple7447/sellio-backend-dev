const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    fullName: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: true,
        enum: ['seller', 'admin', 'customer']  // Add customer role
    },
    isVerified: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    discriminatorKey: 'role'
});

// Password hashing middleware
userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const MarketUser = mongoose.model('MarketUser', userSchema);

// Seller specific fields
const MarketSeller = MarketUser.discriminator('seller', new mongoose.Schema({
    businessName: {
        type: String,
        required: true
    },
    businessAddress: {
        type: String,
        required: true
    },
    governmentId: {
        type: String,
        required: true
    },
    adminVerified: {
        type: Boolean,
        default: false
    }
}));

// Admin specific fields
const MarketAdmin = MarketUser.discriminator('admin', new mongoose.Schema({
    permissions: [{
        type: String,
        enum: ['manage_sellers', 'manage_customers', 'manage_products', 'manage_categories', 'manage_orders']
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}));

// Add Customer specific schema
const MarketCustomer = MarketUser.discriminator('customer', new mongoose.Schema({
    shippingAddresses: [{
        fullName: String,
        phoneNumber: String,
        street: String,
        city: String,
        state: String,
        country: String,
        zipCode: String,
        isDefault: Boolean
    }],
    metadata: {
        lastLogin: Date,
        totalOrders: {
            type: Number,
            default: 0
        }
    }
}));

module.exports = { MarketUser, MarketSeller, MarketAdmin, MarketCustomer };
