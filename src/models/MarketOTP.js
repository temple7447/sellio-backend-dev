const mongoose = require('mongoose');

const marketOTPSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    otp: {
        type: String,
        required: true
    },
    userType: {
        type: String,
        enum: ['seller', 'admin'],
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 300 // OTP expires after 5 minutes
    }
});

module.exports = mongoose.model('MarketOTP', marketOTPSchema);
