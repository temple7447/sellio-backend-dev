const mongoose = require('mongoose');

const adPlacementSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: /^[a-z0-9_]+$/
    },
    label: {
        type: String,
        required: true,
        trim: true
    },
    dailyRate: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    minimumBudget: {
        type: Number,
        default: 1000,
        min: 0
    }
}, { timestamps: true });

adPlacementSchema.index({ key: 1 });
adPlacementSchema.index({ isActive: 1 });

module.exports = mongoose.model('AdPlacement', adPlacementSchema);
