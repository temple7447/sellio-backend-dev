const { MarketUser, MarketSeller, MarketCustomer } = require('../models/MarketUser');
const MarketProduct = require('../models/MarketProduct');
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

    async registerCustomer(data, file) {
        // Validate required fields
        const requiredFields = ['email', 'password', 'fullName', 'phoneNumber'];
        for (const field of requiredFields) {
            if (!data[field]) {
                throw { 
                    status: 400, 
                    message: `Missing required field: ${field}` 
                };
            }
        }

        // Check for existing user
        const existingUser = await MarketUser.findOne({ email: data.email });
        if (existingUser) {
            throw { status: 400, message: 'Email already registered' };
        }

        // Handle optional profile image upload
        let profileImage = null;
        if (file) {
            try {
                const result = await uploadToCloudinary(file, 'customer-profiles');
                profileImage = result.secure_url;
            } catch (error) {
                throw { 
                    status: 400, 
                    message: 'File upload failed',
                    error: error.message 
                };
            }
        }

        // Create new customer instance
        const customer = new MarketCustomer({
            email: data.email,
            password: data.password,
            fullName: data.fullName,
            phoneNumber: data.phoneNumber,
            role: 'customer',
            profileImage,
            shippingAddresses: [],
            metadata: {
                lastLogin: null,
                totalOrders: 0
            }
        });

        // Generate and save OTP
        const otp = this.generateOTP();
        await new MarketOTP({ 
            email: data.email, 
            otp, 
            userType: 'customer' 
        }).save();
        
        // Send OTP email
        const emailResult = await sendOTP(data.email, otp);
        if (!emailResult.success) {
            throw { 
                status: 500, 
                message: 'Failed to send OTP email',
                error: emailResult.error
            };
        }

        await customer.save();

        return {
            message: 'Registration successful. Please verify your email.',
            email: customer.email,
            profileImage: profileImage,
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

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, role: user.role }, 
            config.JWT_SECRET, 
            { expiresIn: '24h' }
        );

        // Format user response based on role
        const userResponse = {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            phoneNumber: user.phoneNumber,
            role: user.role,
            isVerified: true,
            profileImage: user.profileImage || null,
            ...(user.role === 'seller' ? {
                businessName: user.businessName,
                businessAddress: user.businessAddress,
                adminVerified: user.adminVerified || false,
                governmentId: user.governmentId
            } : user.role === 'customer' ? {
                shippingAddresses: user.shippingAddresses || [],
                metadata: {
                    lastLogin: new Date(),
                    totalOrders: user.metadata?.totalOrders || 0
                }
            } : {
                permissions: user.permissions || []
            })
        };

        // Update last login for customers
        if (user.role === 'customer') {
            user.metadata = {
                ...user.metadata,
                lastLogin: new Date()
            };
            await user.save();
        }

        return {
            success: true,
            message: 'Email verified and logged in successfully',
            data: {
                token,
                user: userResponse
            }
        };
    }

    async login(credentials) {
        const { email, password } = credentials;
        const user = await MarketUser.findOne({ email });

        if (!user || !(await user.comparePassword(password))) {
            throw { status: 401, message: 'Invalid credentials' };
        }

        // Generate token
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
            } : user.role === 'customer' ? {
                shippingAddresses: user.shippingAddresses || []
            } : {
                permissions: user.permissions || []
            })
        };

        // Update last login for customers
        if (user.role === 'customer') {
            user.metadata = {
                ...user.metadata,
                lastLogin: new Date()
            };
            await user.save();
        }

        return { token, user: userResponse };
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

    async getPublicSellerProfile(sellerId, requestingUserId = null) {
        const seller = await MarketUser.findOne({ 
            _id: sellerId, 
            role: 'seller',
            isVerified: true,
            adminVerified: true
        });

        if (!seller) {
            throw { status: 404, message: 'Seller not found' };
        }

        // Get requesting user if ID provided
        let requestingUser = null;
        if (requestingUserId) {
            requestingUser = await MarketUser.findById(requestingUserId);
        }

        // Get seller's products count
        const totalProducts = await MarketProduct.countDocuments({
            sellerId: seller._id,
            status: 'active'
        });

        // Calculate average rating from products
        const ratingStats = await MarketProduct.aggregate([
            { $match: { sellerId: seller._id, status: 'active' } },
            { 
                $group: {
                    _id: null,
                    averageRating: { $avg: '$metadata.rating.average' },
                    totalRatings: { $sum: '$metadata.rating.count' }
                }
            }
        ]);

        const response = {
            businessName: seller.businessName,
            businessAddress: seller.businessAddress,
            rating: {
                average: ratingStats[0]?.averageRating || 0,
                count: ratingStats[0]?.totalRatings || 0
            },
            totalProducts,
            joinedDate: seller.createdAt
        };

        // Only include bank account if requesting user is admin or the seller themselves
        const canViewBankDetails = requestingUser && (
            requestingUser.role === 'admin' || 
            requestingUser._id.toString() === sellerId
        );

        if (canViewBankDetails && seller.bankAccount) {
            response.bankAccount = {
                bankName: seller.bankAccount.bankName,
                accountNumber: seller.bankAccount.accountNumber,
                accountName: seller.bankAccount.accountName
            };
        }

        return response;
    }

    async updateSellerProfile(sellerId, updates, imageFile) {
        const seller = await MarketUser.findOne({ 
            _id: sellerId, 
            role: 'seller' 
        });

        if (!seller) {
            throw { status: 404, message: 'Seller not found' };
        }

        // Validate allowed updates - add bank account fields
        const allowedUpdates = [
            'fullName', 
            'businessName', 
            'businessAddress', 
            'phoneNumber',
            'bankAccount.bankName',
            'bankAccount.accountNumber',
            'bankAccount.accountName'
        ];

        const updateKeys = Object.keys(updates);
        
        const isValidOperation = updateKeys.every(key => 
            allowedUpdates.includes(key) || key.startsWith('bankAccount.')
        );

        if (!isValidOperation) {
            throw { 
                status: 400, 
                message: 'Invalid updates',
                allowedUpdates 
            };
        }

        // Validate bank account number if provided
        if (updates['bankAccount.accountNumber']) {
            const accountNumber = updates['bankAccount.accountNumber'];
            if (!/^\d{10}$/.test(accountNumber)) {
                throw {
                    status: 400,
                    message: 'Invalid account number. Must be 10 digits'
                };
            }
        }

        // Handle profile image upload
        if (imageFile) {
            const result = await uploadToCloudinary(imageFile, 'profile-images');
            updates.profileImage = result.secure_url;
        }

        // Apply updates including nested bank account fields
        Object.keys(updates).forEach(key => {
            if (key.startsWith('bankAccount.')) {
                const bankField = key.split('.')[1];
                if (!seller.bankAccount) seller.bankAccount = {};
                seller.bankAccount[bankField] = updates[key];
            } else {
                seller[key] = updates[key];
            }
        });

        await seller.save();

        return {
            message: 'Profile updated successfully',
            profile: {
                fullName: seller.fullName,
                businessName: seller.businessName,
                businessAddress: seller.businessAddress,
                phoneNumber: seller.phoneNumber,
                profileImage: seller.profileImage,
                bankAccount: seller.bankAccount ? {
                    bankName: seller.bankAccount.bankName,
                    accountNumber: seller.bankAccount.accountNumber,
                    accountName: seller.bankAccount.accountName
                } : null
            }
        };
    }

    async updateAdminProfile(adminId, updates, imageFile) {
        const admin = await MarketUser.findOne({ 
            _id: adminId, 
            role: 'admin' 
        });

        if (!admin) {
            throw { status: 404, message: 'Admin not found' };
        }

        // Validate allowed updates
        const allowedUpdates = ['fullName', 'phoneNumber'];
        const updateKeys = Object.keys(updates);
        
        const isValidOperation = updateKeys.every(key => allowedUpdates.includes(key));
        if (!isValidOperation) {
            throw { 
                status: 400, 
                message: 'Invalid updates',
                allowedUpdates 
            };
        }

        // Handle profile image upload
        if (imageFile) {
            const result = await uploadToCloudinary(imageFile, 'profile-images');
            updates.profileImage = result.secure_url;
        }

        // Apply updates
        Object.assign(admin, updates);
        await admin.save();

        return {
            message: 'Profile updated successfully',
            profile: {
                fullName: admin.fullName,
                phoneNumber: admin.phoneNumber,
                profileImage: admin.profileImage
            }
        };
    }

    async updateCustomerProfile(customerId, updates, imageFile) {
        const customer = await MarketUser.findOne({ 
            _id: customerId, 
            role: 'customer' 
        });

        if (!customer) {
            throw { status: 404, message: 'Customer not found' };
        }

        // Validate allowed updates
        const allowedUpdates = ['fullName', 'phoneNumber'];
        const updateKeys = Object.keys(updates);
        
        const isValidOperation = updateKeys.every(key => allowedUpdates.includes(key));
        if (!isValidOperation) {
            throw { 
                status: 400, 
                message: 'Invalid updates',
                allowedUpdates 
            };
        }

        // Handle profile image upload if provided
        if (imageFile) {
            const result = await uploadToCloudinary(imageFile, 'profile-images');
            updates.profileImage = result.secure_url;
        }

        // Apply updates
        Object.assign(customer, updates);
        await customer.save();

        return {
            message: 'Profile updated successfully',
            profile: {
                fullName: customer.fullName,
                phoneNumber: customer.phoneNumber,
                profileImage: customer.profileImage,
                email: customer.email // Include email in response
            }
        };
    }

    async getTopSellers(limit = 6) {
        try {
            // Find verified and active sellers
            const sellers = await MarketUser.find({
                role: 'seller',
                isVerified: true,
                adminVerified: true
            }).limit(parseInt(limit));

            // Get product and rating stats for each seller
            const sellerStats = await Promise.all(sellers.map(async (seller) => {
                // Get total products count
                const totalProducts = await MarketProduct.countDocuments({
                    sellerId: seller._id,
                    status: 'active'
                });

                // Calculate average rating from products
                const ratingStats = await MarketProduct.aggregate([
                    { 
                        $match: { 
                            sellerId: seller._id,
                            status: 'active'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            averageRating: { $avg: '$metadata.rating.average' },
                            totalRatings: { $sum: '$metadata.rating.count' }
                        }
                    }
                ]);

                return {
                    id: seller._id,
                    businessName: seller.businessName,
                    businessAddress: seller.businessAddress,
                    rating: {
                        average: parseFloat((ratingStats[0]?.averageRating || 0).toFixed(1)),
                        count: ratingStats[0]?.totalRatings || 0
                    },
                    totalProducts,
                    logo: seller.profileImage || null,
                    slug: seller.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                };
            }));

            // Sort by rating and number of products
            return sellerStats.sort((a, b) => {
                // First sort by rating
                if (b.rating.average !== a.rating.average) {
                    return b.rating.average - a.rating.average;
                }
                // Then by number of products if ratings are equal
                return b.totalProducts - a.totalProducts;
            });

        } catch (error) {
            throw {
                status: 500,
                message: 'Failed to fetch top sellers',
                error: error.message
            };
        }
    }

    async getPublicSellers(query = {}) {
        try {
            const { page = 1, limit = 12, search, sort = 'rating' } = query;
            const skip = (page - 1) * limit;

            // Build filter for sellers
            const filter = {
                role: 'seller',
                isVerified: true,
                businessName: { $exists: true, $ne: '' }, // Ensure business name exists
                businessAddress: { $exists: true, $ne: '' } // Ensure business address exists
            };

            // Add search filter if provided
            if (search) {
                filter.$or = [
                    { businessName: { $regex: search, $options: 'i' } },
                    { businessAddress: { $regex: search, $options: 'i' } }
                ];
            }

            // Get sellers with pagination and select more fields
            const [sellers, total] = await Promise.all([
                MarketUser.find(filter)
                    .select('businessName businessAddress profileImage createdAt adminVerified')
                    .lean() // Use lean for better performance
                    .skip(skip)
                    .limit(limit),
                MarketUser.countDocuments(filter)
            ]);

            if (!sellers || !Array.isArray(sellers)) {
                console.error('No sellers found in database');
                return this.getEmptyResponse(page, limit);
            }

            console.log(`Found ${sellers.length} sellers before stats`);

            // Get stats for each seller
            const sellersWithStats = await Promise.all(sellers.map(async (seller) => {
                try {
                    // Get active products count and ratings in parallel
                    const [totalProducts, ratingStats] = await Promise.all([
                        MarketProduct.countDocuments({
                            sellerId: seller._id,
                            status: 'active'
                        }),
                        MarketProduct.aggregate([
                            { 
                                $match: { 
                                    sellerId: seller._id,
                                    status: 'active'
                                }
                            },
                            {
                                $group: {
                                    _id: null,
                                    averageRating: { $avg: '$metadata.rating.average' },
                                    totalRatings: { $sum: '$metadata.rating.count' }
                                }
                            }
                        ])
                    ]);

                    return {
                        id: seller._id,
                        businessName: seller.businessName,
                        businessAddress: seller.businessAddress,
                        logo: seller.profileImage || null,
                        status: seller.adminVerified ? 'verified' : 'pending',
                        rating: {
                            average: parseFloat((ratingStats[0]?.averageRating || 0).toFixed(1)),
                            count: ratingStats[0]?.totalRatings || 0
                        },
                        totalProducts,
                        joinedDate: seller.createdAt,
                        slug: this.generateSlug(seller.businessName)
                    };
                } catch (error) {
                    console.error(`Failed to get stats for seller ${seller._id}:`, error);
                    return null;
                }
            }));

            // Filter and sort valid sellers
            const validSellers = sellersWithStats.filter(seller => 
                seller !== null && seller.businessName && seller.businessAddress
            );
            const sortedSellers = this.sortSellers(validSellers, sort);

            return {
                success: true,
                sellers: sortedSellers,
                pagination: {
                    total,
                    pages: Math.ceil(total / limit),
                    currentPage: parseInt(page),
                    limit: parseInt(limit)
                }
            };
        } catch (error) {
            console.error('Error in getPublicSellers:', error);
            throw {
                status: error.status || 500,
                message: error.message || 'Failed to fetch sellers',
                error: error.stack
            };
        }
    }

    // Helper method for empty response
    getEmptyResponse(page, limit) {
        return {
            success: true,
            sellers: [],
            pagination: {
                total: 0,
                pages: 0,
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        };
    }

    // Helper method to generate slug
    generateSlug(name) {
        return name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    // Helper method to sort sellers
    sortSellers(sellers, sortBy = 'rating') {
        switch (sortBy) {
            case 'products':
                return sellers.sort((a, b) => b.totalProducts - a.totalProducts);
            case 'rating':
                return sellers.sort((a, b) => b.rating.average - a.rating.average);
            case 'newest':
                return sellers.sort((a, b) => new Date(b.joinedDate) - new Date(a.joinedDate));
            case 'oldest':
                return sellers.sort((a, b) => new Date(a.joinedDate) - new Date(b.joinedDate));
            default:
                return sellers;
        }
    }

    async forgotPassword(email) {
        const user = await MarketUser.findOne({ email });
        if (!user) {
            throw { status: 404, message: 'User not found' };
        }
        // Generate OTP
        const otp = this.generateOTP();
        // Remove any existing OTPs for this user
        await MarketOTP.deleteMany({ email });
        // Save new OTP
        await new MarketOTP({ email, otp, userType: user.role }).save();
        // Send OTP email
        const emailResult = await sendOTP(email, otp);
        if (!emailResult.success) {
            throw {
                status: 500,
                message: 'Failed to send OTP email',
                error: emailResult.error
            };
        }
        return {
            message: 'Password reset OTP sent successfully',
            email,
            emailSent: {
                success: true,
                messageId: emailResult.messageId
            }
        };
    }

    async verifyPasswordResetOTP({ email, otp }) {
        const otpRecord = await MarketOTP.findOne({
            email,
            otp,
            createdAt: { $gt: new Date(Date.now() - 5 * 60 * 1000) }
        });
        if (!otpRecord) {
            throw { status: 400, message: 'Invalid or expired OTP' };
        }
        return { success: true, message: 'OTP verified successfully' };
    }

    async resetPassword({ email, otp, newPassword }) {
        const otpRecord = await MarketOTP.findOne({
            email,
            otp,
            createdAt: { $gt: new Date(Date.now() - 5 * 60 * 1000) }
        });
        if (!otpRecord) {
            throw { status: 400, message: 'Invalid or expired OTP' };
        }
        const user = await MarketUser.findOne({ email });
        if (!user) {
            throw { status: 404, message: 'User not found' };
        }
        user.password = newPassword;
        await user.save();
        await MarketOTP.deleteOne({ _id: otpRecord._id });
        return { success: true, message: 'Password reset successful' };
    }

    async addBankInfo(sellerId, bankData) {
        try {
            const seller = await MarketUser.findOne({ 
                _id: sellerId, 
                role: 'seller' 
            });

            if (!seller) {
                throw { status: 404, message: 'Seller not found' };
            }

            // Validate required fields
            const requiredFields = ['bankName', 'accountNumber', 'accountName'];
            for (const field of requiredFields) {
                if (!bankData[field]) {
                    throw { 
                        status: 400, 
                        message: `Missing required field: ${field}`
                    };
                }
            }

            // Validate account number (assuming Nigerian bank account number)
            if (!/^\d{10}$/.test(bankData.accountNumber)) {
                throw {
                    status: 400,
                    message: 'Invalid account number. Must be 10 digits'
                };
            }

            // Update bank information
            seller.bankAccount = {
                bankName: bankData.bankName,
                accountNumber: bankData.accountNumber,
                accountName: bankData.accountName
            };

            await seller.save();

            return {
                success: true,
                message: 'Bank information added successfully',
                data: {
                    bankName: seller.bankAccount.bankName,
                    accountNumber: seller.bankAccount.accountNumber,
                    accountName: seller.bankAccount.accountName
                }
            };
        } catch (error) {
            throw {
                status: error.status || 500,
                message: error.message
            };
        }
    }
}

module.exports = new AuthService();
