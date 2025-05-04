const express = require('express');
const router = express.Router();
const multer = require('multer');
const { auth, isVerified, isSeller, isAdmin, isAdminVerified } = require('../middleware/auth');
const productController = require('../controllers/product.controller');
const productService = require('../services/product.service');

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
 *             required:
 *               - name
 *               - description
 *               - price.current
 *               - category
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               'price[current]':
 *                 type: number
 *                 description: Current price of the product
 *               'price[discount]':
 *                 type: number
 *                 description: Discount percentage (0-100)
 *               category:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *           example:
 *             name: "Product Name"
 *             description: "Product Description"
 *             'price[current]': 99.99
 *             'price[discount]': 10
 *             category: "Electronics"
 *     responses:
 *       201:
 *         description: Product created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', auth, isSeller, isVerified, isAdminVerified, upload.array('images', 5), productController.createProduct);

/**
 * @swagger
 * /api/products/public:
 *   get:
 *     summary: Get public products with filters
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of public products
 */
router.get('/public', productController.getPublicProducts);

/**
 * @swagger
 * /api/products/trending:
 *   get:
 *     summary: Get trending products (public)
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 4 
 *         description: Number of products to return
 *     responses:
 *       200:
 *         description: List of trending products with badges and stats
 */
router.get('/trending', productController.getTrendingProducts);

/**
 * @swagger
 * /api/products/popular:
 *   get:
 *     summary: Get popular products (public)
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 4
 *         description: Number of products to return
 *     responses:
 *       200:
 *         description: List of popular products
 */
router.get('/popular', productController.getPopularProducts);

/**
 * @swagger
 * /api/products/seller/stats:
 *   get:
 *     summary: Get seller dashboard statistics
 *     tags: [Products]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Seller dashboard statistics
 */
router.get('/seller/stats', auth, isSeller, productController.getSellerDashboardStats);

/**
 * @swagger
 * /api/products/seller/list:
 *   get:
 *     summary: Get all products for authenticated seller
 *     tags: [Products]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, draft, inactive]
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of seller's products
 */
router.get('/seller/list', auth, isSeller, async (req, res) => {
    try {
        const result = await productService.getSellerProducts(req.user._id, req.query);
        res.json(result);
    } catch (error) {
        console.error(chalk.red('✗ Product fetch failed:', error));
        res.status(500).json({ message: error.message });
    }
});

/**
 * @swagger
 * /api/products/seller/{sellerId}/products:
 *   get:
 *     summary: Get all products by seller ID (public)
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: sellerId
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/seller/:sellerId/products', async (req, res) => {
    try {
        const result = await productService.getSellerProducts(req.params.sellerId, req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/**
 * @swagger
 * /api/products/admin/list:
 *   get:
 *     summary: Get all products (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: sellerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of all products
 *       403:
 *         description: Admin access required
 */
router.get('/admin/list', auth, isAdmin, productController.getAdminProducts);

/**
 * @swagger
 * /api/products/admin/active:
 *   get:
 *     summary: Get active products (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of active products
 *       403:
 *         description: Admin access required
 */
router.get('/admin/active', auth, isAdmin, productController.getActiveAdminProducts);

/**
 * @swagger
 * /api/products/my-products:
 *   get:
 *     summary: Get all products uploaded by the authenticated seller
 *     tags: [Products]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, draft, inactive]
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: '-createdAt'
 *     responses:
 *       200:
 *         description: List of seller's products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     pages:
 *                       type: number
 *                     currentPage:
 *                       type: number
 *                     limit:
 *                       type: number
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not a seller account
 */
router.get('/my-products', auth, isSeller, productController.getSellerProducts);

router.patch('/:id', auth, isSeller, productController.updateProduct);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete a product (seller only)
 *     tags: [Products]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID to delete
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Product deleted successfully
 *               data:
 *                 id: "65a123abc..."
 *                 name: "Product name"
 *       403:
 *         description: Not authorized to delete this product
 *       404:
 *         description: Product not found
 */
router.delete('/:id', auth, isSeller, productController.deleteProduct);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID (authenticated)
 *     tags: [Products]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product details
 *       404:
 *         description: Product not found
 */
router.get('/:id', auth, productController.getProductById);

/**
 * @swagger
 * /api/products/public/{id}:
 *   get:
 *     summary: Get public product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product details
 *       404:
 *         description: Product not found
 */
router.get('/public/:id', productController.getPublicProductById);

/**
 * @swagger
 * /api/products/related/{productId}:
 *   get:
 *     summary: Get related products
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 4
 *     responses:
 *       200:
 *         description: List of related products
 *       404:
 *         description: Product not found
 */
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

/**
 * @swagger
 * /api/products/{productId}/seller/{sellerId}/others:
 *   get:
 *     summary: Get other products by the same seller
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the current product to exclude
 *       - in: path
 *         name: sellerId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the seller
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 4
 *         description: Maximum number of products to return
 *     responses:
 *       200:
 *         description: List of other products by the seller
 *       404:
 *         description: Seller not found
 */
router.get('/:productId/seller/:sellerId/others', productController.getOtherProductsBySeller);

/**
 * @swagger
 * /api/products/public/seller/{sellerId}/products:
 *   get:
 *     summary: Get public products by seller (no auth required)
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: sellerId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the seller
 *       - in: query
 *         name: excludeProduct
 *         schema:
 *           type: string
 *         description: Optional product ID to exclude from results
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 12
 *         description: Maximum number of products to return
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: List of seller's public products with pagination
 *       404:
 *         description: Seller not found
 */
router.get('/public/seller/:sellerId/products', productController.getPublicSellerProducts);

router.get('/seller/dashboard', auth, isSeller, productController.getSellerDashboardStats);
router.get('/seller/products', auth, isSeller, productController.getSellerProducts);

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

/**
 * @swagger
 * /api/products/{id}/status:
 *   patch:
 *     summary: Update product status (draft/active/inactive)
 *     tags: [Products]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, active, inactive]
 *     responses:
 *       200:
 *         description: Product status updated
 *       400:
 *         description: Invalid status
 *       404:
 *         description: Product not found
 */
router.patch('/:id/status', auth, isSeller, productController.updateProductStatus);

module.exports = router;
