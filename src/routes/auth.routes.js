const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const otpGenerator = require('otp-generator');
const multer = require('multer');
const chalk = require('chalk');
const cloudinary = require('../utils/cloudinary');
const { sendOTP } = require('../utils/email');
const config = require('../config/config');
const { MarketUser, MarketSeller } = require('../models/MarketUser');
const MarketOTP = require('../models/MarketOTP');

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
router.post('/register/seller', upload.single('governmentId'), async (req, res) => {
    try {
        const { email } = req.body;
        const existingUser = await MarketUser.findOne({ email });
        
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Upload ID to Cloudinary
        const result = await cloudinary.uploader.upload(req.file.buffer.toString('base64'), {
            folder: 'government_ids',
        });

        const seller = new MarketSeller({
            ...req.body,
            role: 'seller',
            governmentId: result.secure_url,
        });

        // Generate and save OTP
        const otp = otpGenerator.generate(6, { digits: true, alphabets: false, upperCase: false });
        await new MarketOTP({ email, otp, userType: 'seller' }).save();
        
        // Send OTP email
        await sendOTP(email, otp);
        await seller.save();

        console.log(chalk.green('✓ Seller registered successfully'));
        res.status(201).json({ message: 'Registration successful. Please verify your email.' });
    } catch (error) {
        console.error(chalk.red('✗ Registration failed:', error));
        res.status(400).json({ message: error.message });
    }
});

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
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const otpRecord = await MarketOTP.findOne({ email, otp });
        
        if (!otpRecord) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        const user = await MarketUser.findOne({ email });
        user.isVerified = true;
        await user.save();
        await MarketOTP.deleteOne({ email, otp });

        const token = jwt.sign({ id: user._id, role: user.role }, config.JWT_SECRET, { expiresIn: '24h' });
        console.log(chalk.green('✓ User verified successfully'));
        res.json({ token });
    } catch (error) {
        console.error(chalk.red('✗ OTP verification failed:', error));
        res.status(400).json({ message: error.message });
    }
});

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
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await MarketUser.findOne({ email });

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (user.role === 'customer') {
            return res.status(403).json({ message: 'Customer login not allowed' });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, config.JWT_SECRET, { expiresIn: '24h' });
        console.log(chalk.green(`✓ ${user.role} logged in successfully`));
        res.json({ token, role: user.role });
    } catch (error) {
        console.error(chalk.red('✗ Login failed:', error));
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
