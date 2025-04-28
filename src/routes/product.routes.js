const express = require('express');
const router = express.Router();
const multer = require('multer');
const { auth, isVerified, isSeller, isAdmin, isAdminVerified } = require('../middleware/auth');
const productController = require('../controllers/product.controller');

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
router.get('/public', productController.getPublicProducts);
router.get('/my-products', auth, isSeller, productController.getSellerProducts);
router.get('/admin/list', auth, isAdmin, productController.getAdminProducts);
router.patch('/:id', auth, isSeller, productController.updateProduct);
router.delete('/:id', auth, isSeller, productController.deleteProduct);

module.exports = router;
