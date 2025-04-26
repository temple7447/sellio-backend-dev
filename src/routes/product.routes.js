const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('../utils/cloudinary');
const { auth, isVerified, isSeller } = require('../middleware/auth');
const MarketProduct = require('../models/MarketProduct');
const chalk = require('chalk');

const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         price:
 *           type: object
 *           properties:
 *             current:
 *               type: number
 *             discount:
 *               type: number
 *         category:
 *           type: string
 *         inventory:
 *           type: object
 *           properties:
 *             quantity:
 *               type: number
 *             sku:
 *               type: string
 */

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create a new product
 *     security:
 *       - BearerAuth: []
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               category:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Product created successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/', auth, isSeller, isVerified, upload.array('images', 5), async (req, res) => {
    try {
        const imageUrls = [];
        
        // Upload images to Cloudinary
        for (const file of req.files) {
            const result = await cloudinary.uploader.upload(file.buffer.toString('base64'), {
                folder: 'products'
            });
            imageUrls.push({ url: result.secure_url, isDefault: imageUrls.length === 0 });
        }

        const product = new MarketProduct({
            ...req.body,
            sellerId: req.user._id,
            images: imageUrls
        });

        await product.save();
        console.log(chalk.green(`✓ Product created: ${product.name}`));
        res.status(201).json(product);
    } catch (error) {
        console.error(chalk.red('✗ Product creation failed:'), error);
        res.status(400).json({ message: error.message });
    }
});

/**
 * @swagger
 * /api/products/my-products:
 *   get:
 *     summary: Get seller's products
 *     security:
 *       - BearerAuth: []
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: List of products
 *       401:
 *         description: Unauthorized
 */
router.get('/my-products', auth, isSeller, async (req, res) => {
    try {
        const products = await MarketProduct.find({ sellerId: req.user._id });
        res.json(products);
    } catch (error) {
        console.error(chalk.red('✗ Product fetch failed:'), error);
        res.status(500).json({ message: error.message });
    }
});

// Update product
router.patch('/:id', auth, isSeller, async (req, res) => {
    try {
        const product = await MarketProduct.findOne({ 
            _id: req.params.id, 
            sellerId: req.user._id 
        });
        
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        Object.keys(req.body).forEach(update => {
            product[update] = req.body[update];
        });

        await product.save();
        console.log(chalk.blue(`✓ Product updated: ${product.name}`));
        res.json(product);
    } catch (error) {
        console.error(chalk.red('✗ Product update failed:'), error);
        res.status(400).json({ message: error.message });
    }
});

// Delete product
router.delete('/:id', auth, isSeller, async (req, res) => {
    try {
        const product = await MarketProduct.findOneAndDelete({ 
            _id: req.params.id, 
            sellerId: req.user._id 
        });
        
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        console.log(chalk.yellow(`✓ Product deleted: ${product.name}`));
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error(chalk.red('✗ Product deletion failed:'), error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
