const express = require('express');
const router = express.Router();
const { auth, isAdmin } = require('../middleware/auth');
const blogController = require('../controllers/blog.controller');

/**
 * Public Routes (No authentication required)
 */

// Get all published blogs with filters
router.get('/', blogController.getAllBlogs);

// Get single blog by ID or slug
router.get('/post/:idOrSlug', blogController.getBlogById);

// Get blogs by category
router.get('/category/:category', blogController.getBlogsByCategory);

// Get latest blogs
router.get('/latest', blogController.getLatestBlogs);

// Get popular blogs (by views)
router.get('/popular', blogController.getPopularBlogs);

// Get all blog categories
router.get('/categories/list', blogController.getBlogCategories);

/**
 * Authenticated Routes (Requires login)
 */

// Create new blog post
router.post('/', auth, blogController.createBlog);

// Update blog post
router.put('/:id', auth, blogController.updateBlog);

// Publish/unpublish blog post
router.patch('/:id/publish', auth, blogController.publishBlog);

// Delete blog post
router.delete('/:id', auth, blogController.deleteBlog);

/**
 * Admin Routes (Admin only)
 */

// Get all blogs including drafts
router.get('/admin/all', auth, isAdmin, blogController.getAdminAllBlogs);

// Update any blog post
router.put('/admin/:id', auth, isAdmin, blogController.adminUpdateBlog);

// Publish/unpublish any blog post
router.patch('/admin/:id/publish', auth, isAdmin, blogController.adminPublishBlog);

// Delete any blog post
router.delete('/admin/:id', auth, isAdmin, blogController.adminDeleteBlog);

module.exports = router;
