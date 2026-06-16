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
        // The original price the seller entered before the platform fee was added.
        // Sellers are credited this amount when a buyer completes an order.
        sellerPrice: {
            type: Number,
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
    brand: {
        type: String,
        trim: true
    },
    inventory: {
        quantity: {
            type: Number,
            default: 0,
            min: 0
        },
        sku: {
            type: String,
            sparse: true,  // Allows multiple null/undefined values
            index: true,   // Index the field
            unique: false, // Remove unique constraint
            trim: true
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
        enum: ['draft', 'active', 'inactive'],  // Remove 'deleted' status
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
    },
    // Time-boxed flash sale. The discount itself lives in `price.discount` so
    // every pricing path stays correct; this only adds the countdown window and
    // scarcity (how many of the allocated units are gone).
    deal: {
        active: {
            type: Boolean,
            default: false
        },
        startsAt: Date,
        endsAt: Date,
        // Units allocated to the flash sale (optional — omit for no cap).
        stockLimit: {
            type: Number,
            min: 0
        },
        soldCount: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    // Optional product variations (Temu-style). `options` lists the choosable
    // dimensions (e.g. Color, Size); `variants` are the concrete combinations,
    // each with its own stock and optional price/image. Products without
    // variants behave exactly as before (base price + inventory.quantity).
    options: [{
        name: { type: String, trim: true },      // e.g. "Color"
        values: [{ type: String, trim: true }]   // e.g. ["Red", "Blue"]
    }],
    variants: [{
        attributes: [{
            name: { type: String, trim: true },   // "Color"
            value: { type: String, trim: true }    // "Red"
        }],
        // Absolute buyer-facing price for this variant. Falls back to
        // price.current when omitted.
        price: { type: Number, min: 0 },
        stock: { type: Number, default: 0, min: 0 },
        sku: { type: String, trim: true },
        image: { type: String }
    }]
}, {
    timestamps: true
});

// Generate slug before saving
productSchema.pre('save', function (next) {
    if (this.isModified('name')) {
        this.slug = this.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    }
    next();
});

// Remove or comment out the SKU auto-generation middleware
// productSchema.pre('save', async function(next) {
//     if (!this.sku) {
//         const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
//         const timestamp = Date.now().toString(36).toUpperCase();
//         this.sku = `P-${randomPart}-${timestamp}`;
//     }
//     next();
// });

module.exports = mongoose.model('MarketProduct', productSchema);
