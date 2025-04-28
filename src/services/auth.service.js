const { MarketUser, MarketSeller } = require('../models/MarketUser');
const MarketOTP = require('../models/MarketOTP');
const { sendOTP } = require('../utils/email');
const { uploadToCloudinary } = require('../utils/cloudinary');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

class AuthService {
    // Helper method to generate 6-digit OTP
    generateOTP() {
        // Generate a random 6-digit number
        const min = 100000; // Minimum 6-digit number
        const max = 999999; // Maximum 6-digit number
        return Math.floor(Math.random() * (max - min + 1) + min).toString();
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
        
        // Send OTP email with enhanced response handling
        const emailResult = await sendOTP(data.email, otp);
        if (!emailResult.success) {
            throw { 
                status: 500, 
                message: 'Failed to send OTP email',
                error: emailResult.error
            };
        }

        await seller.save();

        return {
            message: 'Registration successful. Please check your email for OTP.',
            email: seller.email,
            governmentId: cloudinaryResult.secure_url,
            emailSent: {
                success: true,
                messageId: emailResult.messageId
            }
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

        // Format response based on user role
        const userResponse = {
            email: user.email,
            fullName: user.fullName,
            phoneNumber: user.phoneNumber,
            role: user.role,
            isVerified: user.isVerified,
            ...(user.role === 'seller' ? {
                businessName: user.businessName,
                businessAddress: user.businessAddress,
                adminVerified: user.adminVerified || false
            } : {
                adminVerified: true, // Admins are always verified
                permissions: user.permissions || []
            })
        };

        return { 
            token,
            user: userResponse
        };
    }

    async getProfile(userId) {
        return await MarketUser.findById(userId).select('-password');
    }

    async resendOTP(email) {
        const user = await MarketUser.findOne({ email });
        if (!user) {
            throw { status: 404, message: 'User not found' };
        }

        if (user.isVerified) {
            throw { status: 400, message: 'User is already verified' };
        }

        // Generate new OTP
        const otp = this.generateOTP();
        
        // Delete any existing OTP for this email
        await MarketOTP.deleteMany({ email });
        
        // Save new OTP
        await new MarketOTP({ email, otp, userType: user.role }).save();
        
        // Send new OTP email
        const emailResult = await sendOTP(email, otp);
        if (!emailResult.success) {
            throw { 
                status: 500, 
                message: 'Failed to send OTP email',
                error: emailResult.error
            };
        }

        return {
            message: 'New OTP sent successfully',
            email,
            emailSent: {
                success: true,
                messageId: emailResult.messageId
            }
        };
    }
}

module.exports = new AuthService();
