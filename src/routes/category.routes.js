const express = require('express');
const router = express.Router();
const { auth, isAdmin } = require('../middleware/auth');
const categoryController = require('../controllers/category.controller');

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
 *     summary: Create a new category (Admin only)
 *     tags: [Categories]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               order:
 *                 type: number
 *               parent:
 *                 type: string
 *                 description: Parent category ID
 *     responses:
 *       201:
 *         description: Category created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.post('/', auth, isAdmin, categoryController.createCategory);

module.exports = router;
