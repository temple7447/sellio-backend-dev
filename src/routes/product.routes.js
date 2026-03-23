const express = require('express');
const router = express.Router();
const chalk = require('chalk');
const multer = require('multer');
const { auth, isVerified, isSeller, isAdmin, isAdminVerified } = require('../middleware/auth');
const productController = require('../controllers/product.controller');
const productService = require('../services/product.service');

const upload = multer({ storage: multer.memoryStorage() });


// Create product
router.post('/', auth, isSeller, isVerified, isAdminVerified, upload.array('images', 5), productController.createProduct);


// Public endpoints
router.get('/public', productController.getPublicProducts);
router.get('/trending', productController.getTrendingProducts);
router.get('/popular', productController.getPopularProducts);
router.get('/public/:id', productController.getPublicProductById);
router.get('/public/seller/:sellerId/products', productController.getPublicSellerProducts);


// Seller endpoints - single consolidated endpoint with pagination & search
router.get('/seller/products', auth, isSeller, async (req, res) => {
    try {
        const result = await productService.getSellerProducts(req.user._id, req.query);
        res.json(result);
    } catch (error) {
        console.error(chalk.red('✗ Product fetch failed:', error));
        res.status(500).json({ message: error.message });
    }
});

// Seller dashboard
router.get('/seller/dashboard', auth, isSeller, productController.getSellerDashboardStats);

// Get public seller products
router.get('/seller/:sellerId/public', async (req, res) => {
    try {
        const result = await productService.getPublicSellerProducts(
            req.params.sellerId,
            req.query
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// Admin endpoints
router.get('/admin/list', auth, isAdmin, productController.getAdminProducts);
router.get('/admin/active', auth, isAdmin, productController.getActiveAdminProducts);
router.delete('/admin/:id', auth, isAdmin, productController.adminDeleteProduct);
router.patch('/admin/:id/status', auth, isAdmin, productController.adminUpdateProductStatus);
router.put('/admin/:id', auth, isAdmin, productController.adminUpdateProduct);


// Product operations
router.get('/related/:productId', async (req, res) => {
    try {
        const relatedProducts = await productService.getRelatedProducts(
            req.params.productId,
            parseInt(req.query.limit) || 4
        );
        res.json(relatedProducts);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
});

router.get('/:productId/seller/:sellerId/others', productController.getOtherProductsBySeller);
router.get('/:id', auth, productController.getProductById);
router.patch('/:id', auth, isSeller, upload.array('images', 5), productController.updateProduct);
router.delete('/:id', auth, isSeller, productController.deleteProduct);
router.patch('/:id/status', auth, isSeller, productController.updateProductStatus);


module.exports = router;
