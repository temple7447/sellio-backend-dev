const express = require('express');
const router = express.Router();
const multer = require('multer');
const { auth, isAdmin, isSeller } = require('../middleware/auth');
const authController = require('../controllers/auth.controller');
const adminController = require('../controllers/admin.controller');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/register/seller', upload.single('governmentId'), authController.registerSeller);
router.post('/verify-otp', authController.verifyOTP);
router.post('/login', authController.login);
router.post('/admin/verify-login', authController.verifyAdminLoginOTP);
router.get('/profile', auth, authController.getProfile);
router.patch('/profile/seller', auth, isSeller, upload.single('governmentId'), async (req, res) => {
    try {
        const updates = { ...req.body };
        const allowedUpdates = ['businessName', 'phoneNumber', 'businessAddress', 'fullName'];
        const updateKeys = Object.keys(updates);

        const isValidOperation = updateKeys.every(update => allowedUpdates.includes(update));
        if (!isValidOperation) {
            return res.status(400).json({
                message: 'Invalid updates',
                allowedUpdates
            });
        }

        // Upload new government ID to Cloudinary if provided
        if (req.file) {
            const cloudinaryResult = await uploadToCloudinary(req.file, 'government_ids');
            updates.governmentId = cloudinaryResult.secure_url;
        }

        const seller = await MarketUser.findByIdAndUpdate(
            req.user._id,
            updates,
            { new: true, runValidators: true }
        ).select('-password');

        console.log(chalk.green('✓ Seller profile updated successfully'));
        res.json(seller);
    } catch (error) {
        console.error(chalk.red('✗ Profile update failed:', error));
        res.status(400).json({ message: error.message });
    }
});

router.patch('/profile/admin', auth, isAdmin, async (req, res) => {
    try {
        const updates = { ...req.body };
        const allowedUpdates = ['fullName', 'phoneNumber'];
        const updateKeys = Object.keys(updates);

        const isValidOperation = updateKeys.every(update => allowedUpdates.includes(update));
        if (!isValidOperation) {
            return res.status(400).json({
                message: 'Invalid updates',
                allowedUpdates
            });
        }

        const admin = await MarketUser.findByIdAndUpdate(
            req.user._id,
            updates,
            { new: true, runValidators: true }
        ).select('-password');

        console.log(chalk.green('✓ Admin profile updated successfully'));
        res.json(admin);
    } catch (error) {
        console.error(chalk.red('✗ Profile update failed:', error));
        res.status(400).json({ message: error.message });
    }
});

router.put('/profile/seller/update',
    auth,
    isSeller,
    upload.single('profileImage'),
    authController.updateSellerProfile
);

router.put('/profile/admin/update',
    auth,
    isAdmin,
    upload.single('profileImage'),
    authController.updateAdminProfile
);

router.put('/profile/customer/update',
    auth,
    upload.single('profileImage'),
    authController.updateCustomerProfile
);

router.post('/register/admin', adminController.registerAdmin);
router.get('/admin/users', auth, isAdmin, adminController.getAllUsers);
router.post('/resend-otp', authController.resendOTP);
router.patch('/admin/verify-seller/:sellerId', auth, isAdmin, adminController.verifySeller);
router.patch('/admin/sellers/:sellerId/trusted-badge', auth, isAdmin, adminController.toggleTrustedBadge);
router.get('/seller/:sellerId/public', authController.getPublicSellerProfile);
router.get('/sellers/top', authController.getTopSellers);
router.get('/sellers', authController.getPublicSellers);
router.post('/register/customer', upload.single('profileImage'), authController.registerCustomer);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-otp', authController.verifyPasswordResetOTP);
router.post('/reset-password', authController.resetPassword);
router.delete('/admin/users/:userId', auth, isAdmin, adminController.deleteUser);
router.put('/admin/users/:userId', auth, isAdmin, adminController.adminUpdateUser);
router.get('/admin/sellers/:sellerId/bank-info', auth, isAdmin, adminController.getSellerBankInfo);
router.get('/admin/users/:userId/bank-info', auth, isAdmin, adminController.getUserBankInfo);

// Universal bank information routes (available for all user roles)
router.post('/user/bank-info', auth, authController.addBankInfo);
router.get('/user/bank-info', auth, authController.getBankInfo);
router.put('/user/bank-info', auth, authController.updateBankInfo);

// Legacy routes (maintained for backward compatibility)
router.post('/seller/bank-info', auth, authController.addBankInfo);
router.get('/seller/bank-info', auth, authController.getBankInfo);
router.put('/seller/bank-info', auth, authController.updateBankInfo);

// Upload seller profile image (separate endpoint)
router.put('/seller/profile-image', auth, isSeller, upload.single('profileImage'), authController.uploadSellerProfileImage);

// Get referral code and link (available for all authenticated users)
router.get('/referral', auth, authController.getReferralCode);
router.get('/referral/stats', auth, authController.getReferralStats);

// Admin - Reward Settings Management
router.get('/admin/reward-settings', auth, isAdmin, adminController.getRewardSettings);
router.put('/admin/reward-settings', auth, isAdmin, adminController.updateRewardSettings);
router.get('/admin/referrals', auth, isAdmin, adminController.getReferrals);

// Admin - Pricing Fee Tiers (admin manage, public read for seller form)
router.get('/admin/pricing-fees', auth, isAdmin, adminController.getPricingFees);
router.put('/admin/pricing-fees', auth, isAdmin, adminController.updatePricingFees);
router.get('/public/pricing-fees', adminController.getPricingFees);

module.exports = router;
