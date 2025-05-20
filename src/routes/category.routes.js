const express = require('express');
const router = express.Router();
const multer = require('multer');
const { auth, isAdmin } = require('../middleware/auth');
const categoryController = require('../controllers/category.controller');

const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: order
 *     responses:
 *       200:
 *         description: List of categories
 */
router.get('/', categoryController.getAllCategories);

/**
 * @swagger
 * /api/categories/stats:
 *   get:
 *     summary: Get all categories with stats and images
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: List of categories with product counts and images
 */
router.get('/stats', categoryController.getCategoryStats);

/**
 * @swagger
 * /api/categories/popular:
 *   get:
 *     summary: Get popular categories with product counts
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 4
 *         description: Number of categories to return
 *     responses:
 *       200:
 *         description: List of popular categories with stats
 */
router.get('/popular', categoryController.getPopularCategories);

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Create a new category with image (Admin only)
 *     tags: [Categories]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - image
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               order:
 *                 type: number
 *               parent:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Category created successfully
 */
router.post('/', auth, isAdmin, upload.single('image'), categoryController.createCategory);

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Delete a category (Admin only)
 *     tags: [Categories]
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
 *         description: Category deleted successfully
 *       400:
 *         description: Cannot delete category with products
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Category not found
 */
router.delete('/:id', auth, isAdmin, categoryController.deleteCategory);

module.exports = router;
