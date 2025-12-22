const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketUser',
        required: true,
        index: true
    },
    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true
    },
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true
    },
    street: {
        type: String,
        required: [true, 'Street address is required'],
        trim: true
    },
    city: {
        type: String,
        required: [true, 'City is required'],
        trim: true
    },
    state: {
        type: String,
        required: [true, 'State is required'],
        trim: true
    },
    country: {
        type: String,
        required: [true, 'Country is required'],
        trim: true,
        default: 'Nigeria'
    },
    zipCode: {
        type: String,
        trim: true
    },
    isDefault: {
        type: Boolean,
        default: false
    },
    label: {
        type: String,
        default: 'Home',
        enum: ['Home', 'Office', 'Other']
    }
}, {
    timestamps: true
});

// Ensure only one default address per user - we'll handle this in the service for better control
// but keeping the index for performance on queries.
addressSchema.index({ userId: 1, isDefault: 1 });

module.exports = mongoose.model('MarketAddress', addressSchema);
