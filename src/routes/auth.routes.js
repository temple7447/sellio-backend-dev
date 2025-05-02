const express = require('express');
const router = express.Router();
const multer = require('multer');
const { auth, isAdmin, isSeller } = require('../middleware/auth');
const authController = require('../controllers/auth.controller');
const adminController = require('../controllers/admin.controller');

const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * /api/auth/register/seller:
 *   post:
 *     summary: Register a new seller
 *     tags: [Auth]
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               fullName:
 *                 type: string
 *               businessName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               businessAddress:
 *                 type: string
 *               governmentId:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Registration successful
 *       400:
 *         description: Bad request
 */
router.post('/register/seller', upload.single('governmentId'), authController.registerSeller);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid OTP
 */
router.post('/verify-otp', authController.verifyOTP);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *       401:
 *         description: Unauthorized
 */
router.get('/profile', auth, authController.getProfile);

/**
 * @swagger
 * /api/auth/profile/seller:
 *   patch:
 *     summary: Update seller profile
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               businessName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               businessAddress:
 *                 type: string
 *               governmentId:
 *                 type: string
 *                 format: binary
 */
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

/**
 * @swagger
 * /api/auth/profile/admin:
 *   patch:
 *     summary: Update admin profile
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 */
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

/**
 * @swagger
 * /api/auth/profile/seller/update:
 *   put:
 *     summary: Update seller profile with optional image
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               businessName:
 *                 type: string
 *               businessAddress:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               profileImage:
 *                 type: string
 *                 format: binary
 */
router.put('/profile/seller/update', 
    auth, 
    isSeller, 
    upload.single('profileImage'), 
    authController.updateSellerProfile
);

/**
 * @swagger
 * /api/auth/profile/admin/update:
 *   put:
 *     summary: Update admin profile with optional image
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               profileImage:
 *                 type: string
 *                 format: binary
 */
router.put('/profile/admin/update',
    auth,
    isAdmin,
    upload.single('profileImage'),
    authController.updateAdminProfile
);

/**
 * @swagger
 * /api/auth/register/admin:
 *   post:
 *     summary: One-time admin registration
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               fullName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               setupKey:
 *                 type: string
 */
router.post('/register/admin', adminController.registerAdmin);

/**
 * @swagger
 * /api/auth/admin/users:
 *   get:
 *     summary: Get all users (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [seller, admin]
 *       - in: query
 *         name: isVerified
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.get('/admin/users', auth, isAdmin, adminController.getAllUsers);

/**
 * @swagger
 * /api/auth/resend-otp:
 *   post:
 *     summary: Resend OTP for email verification
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: New OTP sent successfully
 *       400:
 *         description: User already verified
 *       404:
 *         description: User not found
 *       500:
 *         description: Email sending failed
 */
router.post('/resend-otp', authController.resendOTP);

/**
 * @swagger
 * /api/auth/admin/verify-seller/{sellerId}:
 *   patch:
 *     summary: Verify a seller (Admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sellerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Seller verified successfully
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Seller not found
 */
router.patch('/admin/verify-seller/:sellerId', auth, isAdmin, adminController.verifySeller);

/**
 * @swagger
 * /api/auth/seller/{sellerId}/public:
 *   get:
 *     summary: Get public seller/vendor profile
 *     tags: [Sellers]
 *     parameters:
 *       - in: path
 *         name: sellerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Seller public profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 businessName:
 *                   type: string
 *                 businessAddress:
 *                   type: string
 *                 rating:
 *                   type: object
 *                   properties:
 *                     average:
 *                       type: number
 *                     count:
 *                       type: number
 *                 totalProducts:
 *                   type: number
 *                 joinedDate:
 *                   type: string
 *                   format: date-time
 *             example:
 *               businessName: "Electronics Store"
 *               businessAddress: "123 Market Street, Lagos"  
 *               rating:
 *                 average: 4.5
 *                 count: 28
 *               totalProducts: 156
 *               joinedDate: "2023-01-15T08:00:00.000Z"
 */
router.get('/seller/:sellerId/public', authController.getPublicSellerProfile);

/**
 * @swagger
 * /api/auth/register/customer:
 *   post:
 *     summary: Register a new customer
 *     tags: [Auth]
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullName
 *               - phoneNumber
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               fullName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               profileImage:
 *                 type: string
 *                 format: binary
 */
router.post('/register/customer', upload.single('profileImage'), authController.registerCustomer);

module.exports = router;
