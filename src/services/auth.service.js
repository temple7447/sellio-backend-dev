const { MarketUser, MarketSeller } = require('../models/MarketUser');
const MarketOTP = require('../models/MarketOTP');
const { uploadToCloudinary } = require('../utils/cloudinary');
const { sendOTP } = require('../utils/email');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const otpGenerator = require('otp-generator');

class AuthService {
    async registerSeller(data, file) {
        if (!file) {
            throw { status: 400, message: 'Government ID file is required' };
        }

        const existingUser = await MarketUser.findOne({ email: data.email });
        if (existingUser) {
            throw { status: 400, message: 'Email already registered' };
        }

        const result = await uploadToCloudinary(file, 'government_ids');
        
        const seller = new MarketSeller({
            ...data,
            role: 'seller',
            governmentId: result.secure_url,
        });

        const otp = otpGenerator.generate(6, { digits: true, alphabets: false, upperCase: false });
        await new MarketOTP({ email: data.email, otp, userType: 'seller' }).save();
        
        if (!(await sendOTP(data.email, otp))) {
            throw { status: 500, message: 'Failed to send OTP email' };
        }

        await seller.save();
        return {
            message: 'Registration successful. Please verify your email.',
            email: seller.email
        };
    }

    // Add other service methods...
}

module.exports = new AuthService();
