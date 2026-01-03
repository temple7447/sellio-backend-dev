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
    },
    profileImage: {
        type: String,
        default: null
    },
    referralCode: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        uppercase: true
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketUser',
        default: null
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    deletedAt: {
        type: Date,
        default: null
    },
    anonymizedAt: {
        type: Date,
        default: null
    },
    deletionReason: {
        type: String,
        default: null
    }
}, {
    timestamps: true,
    discriminatorKey: 'role'
});

// Helper function to generate referral code (SELLIO-XXXX format)
const generateReferralCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `SELLIO-${code}`;
};

// Generate unique referral code before saving
userSchema.pre('save', async function (next) {
    // Hash password if modified
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }

    // Generate referral code if it doesn't exist
    if (!this.referralCode) {
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;

        while (!isUnique && attempts < maxAttempts) {
            const newCode = generateReferralCode();
            const existingUser = await this.constructor.findOne({ referralCode: newCode });

            if (!existingUser) {
                this.referralCode = newCode;
                isUnique = true;
            }
            attempts++;
        }

        if (!isUnique) {
            return next(new Error('Failed to generate unique referral code'));
        }
    }

    next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Index for referral code lookups
userSchema.index({ referralCode: 1 });

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
    },
    bankAccount: {
        bankName: {
            type: String,
            trim: true
        },
        bankCode: {
            type: String,
            trim: true
        },
        accountNumber: {
            type: String,
            trim: true,
            match: [/^\d{10}$/, 'Account number must be 10 digits']
        },
        accountName: {
            type: String,
            trim: true
        },
        recipientCode: {
            type: String,
            trim: true
        }
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
    metadata: {
        lastLogin: Date,
        totalOrders: {
            type: Number,
            default: 0
        }
    }
}));

module.exports = { MarketUser, MarketSeller, MarketAdmin, MarketCustomer };
