const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketUser',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        current: {
            type: Number,
            required: true,
            min: 0
        },
        discount: {
            type: Number,
            min: 0,
            max: 100
        },
        compareAt: Number
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketCategory',
        required: true
    },
    inventory: {
        quantity: {
            type: Number,
            default: 0,
            min: 0
        },
        sku: {
            type: String,
            unique: true,
            sparse: true
        },
        lowStockAlert: {
            type: Number,
            default: 5
        }
    },
    images: [{
        url: String,
        isDefault: Boolean
    }],
    status: {
        type: String,
        enum: ['draft', 'active', 'inactive', 'deleted'],
        default: 'draft'
    },
    metadata: {
        rating: {
            average: {
                type: Number,
                default: 0
            },
            count: {
                type: Number,
                default: 0
            }
        },
        views: {
            type: Number,
            default: 0
        },
        sales: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true
});

// Generate slug before saving
productSchema.pre('save', function(next) {
    if (this.isModified('name')) {
        this.slug = this.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    }
    next();
});

module.exports = mongoose.model('MarketProduct', productSchema);
