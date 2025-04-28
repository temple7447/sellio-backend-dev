const { MarketUser, MarketSeller } = require('../models/MarketUser');
const MarketOTP = require('../models/MarketOTP');
const { sendOTP } = require('../utils/email');
const { uploadToCloudinary } = require('../utils/cloudinary');
const otpGenerator = require('otp-generator');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

class AuthService {
    // Helper method to generate 6-digit OTP
    generateOTP() {
        return otpGenerator.generate(6, {
            digits: true,
            alphabets: false,
            upperCase: false,
            specialChars: false
        });
    }

    async registerSeller(data, file) {
        // Validate required fields
        if (!data.email || !data.password || !data.fullName || 
            !data.businessName || !data.phoneNumber || !data.businessAddress) {
            throw { 
                status: 400, 
                message: 'Missing required fields',
                required: ['email', 'password', 'fullName', 'businessName', 'phoneNumber', 'businessAddress']
            };
        }

        // Check if file was uploaded
        if (!file) {
            throw { 
                status: 400, 
                message: 'Government ID file is required',
                accepted: ['image/jpeg', 'image/png', 'image/jpg']
            };
        }

        // Check for existing user
        const existingUser = await MarketUser.findOne({ email: data.email });
        if (existingUser) {
            throw { status: 400, message: 'Email already registered' };
        }

        // Upload ID to Cloudinary
        let cloudinaryResult;
        try {
            cloudinaryResult = await uploadToCloudinary(file, 'government_ids');
        } catch (error) {
            throw { 
                status: 400, 
                message: 'File upload failed',
                error: error.message 
            };
        }

        // Create seller with Cloudinary URL
        const seller = new MarketSeller({
            ...data,
            role: 'seller',
            governmentId: cloudinaryResult.secure_url,
        });

        // Generate and save OTP
        const otp = this.generateOTP();
        await new MarketOTP({ email: data.email, otp, userType: 'seller' }).save();
        
        // Send OTP email
        const emailSent = await sendOTP(data.email, otp);
        if (!emailSent) {
            throw { status: 500, message: 'Failed to send OTP email' };
        }

        await seller.save();

        return {
            message: 'Registration successful. Please verify your email.',
            email: seller.email,
            governmentId: cloudinaryResult.secure_url
        };
    }

    async verifyOTP(data) {
        const { email, otp } = data;
        const otpRecord = await MarketOTP.findOne({ 
            email, 
            otp,
            createdAt: { $gt: new Date(Date.now() - 5 * 60 * 1000) } // OTP valid for 5 minutes
        });
        
        if (!otpRecord) {
            throw { status: 400, message: 'Invalid or expired OTP' };
        }

        const user = await MarketUser.findOne({ email });
        user.isVerified = true;
        await user.save();
        await MarketOTP.deleteOne({ _id: otpRecord._id });

        const token = jwt.sign({ id: user._id, role: user.role }, config.JWT_SECRET, { expiresIn: '24h' });
        return { token, message: 'Email verified successfully' };
    }

    async login(credentials) {
        const { email, password } = credentials;
        const user = await MarketUser.findOne({ email });

        if (!user || !(await user.comparePassword(password))) {
            throw { status: 401, message: 'Invalid credentials' };
        }

        if (user.role === 'customer') {
            throw { status: 403, message: 'Customer login not allowed' };
        }

        const token = jwt.sign(
            { id: user._id, role: user.role }, 
            config.JWT_SECRET, 
            { expiresIn: '24h' }
        );

        return { 
            token, 
            role: user.role,
            user: {
                email: user.email,
                fullName: user.fullName,
                isVerified: user.isVerified
            }
        };
    }

    async getProfile(userId) {
        return await MarketUser.findById(userId).select('-password');
    }
}

module.exports = new AuthService();
