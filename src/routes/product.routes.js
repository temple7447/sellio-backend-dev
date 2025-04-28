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
 * /api/products/seller/{sellerId}:
 *   get:
 *     summary: Get all products by seller ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: sellerId
 *         required: true
 *         schema:
 *           type: string
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
router.get('/seller/:sellerId', async (req, res) => {
    try {
        const result = await productService.getSellerProducts(req.params.sellerId, req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

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
router.get('/my-products', auth, isSeller, productController.getSellerProducts);
router.patch('/:id', auth, isSeller, productController.updateProduct);
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

module.exports = router;
