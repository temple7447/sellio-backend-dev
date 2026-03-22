const chalk = require('chalk');
const blogService = require('../services/blog.service');

class BlogController {
    /**
     * Create new blog post
     */
    async createBlog(req, res) {
        try {
            const result = await blogService.createBlog(req.user._id, req.body);
            console.log(chalk.green('✓ Blog created successfully'));
            res.status(201).json(result);
        } catch (error) {
            console.error(chalk.red('✗ Blog creation failed:'), error);
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Get all blogs
     */
    async getAllBlogs(req, res) {
        try {
            const result = await blogService.getAllBlogs(req.query);
            console.log(chalk.green('✓ Blogs fetched successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Failed to fetch blogs:'), error);
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Get single blog post
     */
    async getBlogById(req, res) {
        try {
            const blog = await blogService.getBlogById(req.params.idOrSlug);
            console.log(chalk.green('✓ Blog fetched successfully'));
            res.json(blog);
        } catch (error) {
            console.error(chalk.red('✗ Failed to fetch blog:'), error);
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Get blogs by category
     */
    async getBlogsByCategory(req, res) {
        try {
            const { category } = req.params;
            const { page = 1, limit = 10 } = req.query;
            const result = await blogService.getBlogsByCategory(category, page, limit);
            console.log(chalk.green(`✓ Blogs fetched for category: ${category}`));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Failed to fetch blogs by category:'), error);
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Update blog post
     */
    async updateBlog(req, res) {
        try {
            const result = await blogService.updateBlog(req.params.id, req.user._id, req.body);
            console.log(chalk.blue('✓ Blog updated successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Failed to update blog:'), error);
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Publish blog post
     */
    async publishBlog(req, res) {
        try {
            const { publish = true } = req.body;
            const result = await blogService.publishBlog(req.params.id, req.user._id, publish);
            console.log(chalk.green(`✓ Blog ${publish ? 'published' : 'unpublished'}`));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Failed to publish blog:'), error);
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Delete blog post
     */
    async deleteBlog(req, res) {
        try {
            const result = await blogService.deleteBlog(req.params.id, req.user._id);
            console.log(chalk.red('✓ Blog deleted successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Failed to delete blog:'), error);
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Get latest blogs
     */
    async getLatestBlogs(req, res) {
        try {
            const { limit = 5 } = req.query;
            const blogs = await blogService.getLatestBlogs(parseInt(limit));
            console.log(chalk.green('✓ Latest blogs fetched'));
            res.json({ blogs });
        } catch (error) {
            console.error(chalk.red('✗ Failed to fetch latest blogs:'), error);
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Get popular blogs
     */
    async getPopularBlogs(req, res) {
        try {
            const { limit = 5 } = req.query;
            const blogs = await blogService.getPopularBlogs(parseInt(limit));
            console.log(chalk.green('✓ Popular blogs fetched'));
            res.json({ blogs });
        } catch (error) {
            console.error(chalk.red('✗ Failed to fetch popular blogs:'), error);
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Get blog categories
     */
    async getBlogCategories(req, res) {
        try {
            const categories = await blogService.getBlogCategories();
            console.log(chalk.green('✓ Blog categories fetched'));
            res.json({ categories });
        } catch (error) {
            console.error(chalk.red('✗ Failed to fetch categories:'), error);
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Admin: Get all blogs including drafts
     */
    async getAdminAllBlogs(req, res) {
        try {
            const result = await blogService.getAdminAllBlogs(req.query);
            console.log(chalk.green('✓ Admin: All blogs fetched'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Admin: Failed to fetch blogs:'), error);
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Admin: Update any blog post
     */
    async adminUpdateBlog(req, res) {
        try {
            const result = await blogService.adminUpdateBlog(req.params.id, req.body);
            console.log(chalk.blue('✓ Admin: Blog updated successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Admin: Failed to update blog:'), error);
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Admin: Publish/unpublish any blog post
     */
    async adminPublishBlog(req, res) {
        try {
            const { publish = true } = req.body;
            const result = await blogService.adminPublishBlog(req.params.id, publish);
            console.log(chalk.green(`✓ Admin: Blog ${publish ? 'published' : 'unpublished'}`));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Admin: Failed to publish blog:'), error);
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * Admin: Delete any blog post
     */
    async adminDeleteBlog(req, res) {
        try {
            const result = await blogService.adminDeleteBlog(req.params.id);
            console.log(chalk.red('✓ Admin: Blog deleted successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Admin: Failed to delete blog:'), error);
            res.status(error.status || 500).json({ message: error.message });
        }
    }
}

module.exports = new BlogController();
