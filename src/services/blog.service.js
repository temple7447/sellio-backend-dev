const MarketBlog = require('../models/MarketBlog');
const chalk = require('chalk');

class BlogService {
    /**
     * Create a new blog post
     */
    async createBlog(authorId, data) {
        try {
            // Validate required fields
            if (!data.title || !data.excerpt || !data.content || !data.author || !data.category) {
                throw {
                    status: 400,
                    message: 'Missing required fields: title, excerpt, content, author, category'
                };
            }

            const blog = new MarketBlog({
                title: data.title,
                excerpt: data.excerpt,
                content: data.content,
                author: data.author,
                category: data.category,
                readTime: data.readTime || '5 min read',
                featuredImage: data.featuredImage || { url: null, publicId: null },
                seo: data.seo || {},
                createdBy: authorId,
                status: data.status || 'draft'
            });

            // Calculate read time from content
            blog.calculateReadTime();

            await blog.save();

            console.log(chalk.green(`✓ Blog created: ${blog.title}`));

            return {
                message: 'Blog post created successfully',
                blog: this.formatBlogResponse(blog)
            };
        } catch (error) {
            console.error(chalk.red('✗ Blog creation failed:'), error);
            throw {
                status: error.status || 500,
                message: error.message || 'Failed to create blog post'
            };
        }
    }

    /**
     * Get all blog posts with pagination and filters
     */
    async getAllBlogs(query = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                status = 'published',
                category,
                search,
                sort = '-createdAt'
            } = query;

            const skip = (page - 1) * limit;
            const filter = {};

            // Filter by status
            if (status) {
                filter.status = status;
            }

            // Filter by category
            if (category) {
                filter.category = { $regex: category, $options: 'i' };
            }

            // Search by title, excerpt, or content
            if (search) {
                filter.$or = [
                    { title: { $regex: search, $options: 'i' } },
                    { excerpt: { $regex: search, $options: 'i' } },
                    { content: { $regex: search, $options: 'i' } },
                    { author: { $regex: search, $options: 'i' } }
                ];
            }

            const [blogs, total] = await Promise.all([
                MarketBlog.find(filter)
                    .populate('createdBy', 'fullName email')
                    .skip(skip)
                    .limit(limit)
                    .sort(sort),
                MarketBlog.countDocuments(filter)
            ]);

            return {
                blogs: blogs.map(blog => this.formatBlogResponse(blog)),
                pagination: {
                    total,
                    pages: Math.ceil(total / limit),
                    currentPage: parseInt(page),
                    limit: parseInt(limit)
                }
            };
        } catch (error) {
            throw {
                status: error.status || 500,
                message: error.message || 'Failed to fetch blogs'
            };
        }
    }

    /**
     * Get single blog post by ID or slug
     */
    async getBlogById(idOrSlug) {
        try {
            let blog;

            // Check if it's a valid MongoDB ID or a slug
            if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
                blog = await MarketBlog.findById(idOrSlug)
                    .populate('createdBy', 'fullName email');
            } else {
                // Try to find by slug
                blog = await MarketBlog.findOne({ slug: idOrSlug })
                    .populate('createdBy', 'fullName email');
            }

            if (!blog) {
                throw { status: 404, message: 'Blog post not found' };
            }

            // Increment views
            blog.metadata.views += 1;
            await blog.save();

            return this.formatBlogResponse(blog);
        } catch (error) {
            throw {
                status: error.status || 500,
                message: error.message || 'Failed to fetch blog post'
            };
        }
    }

    /**
     * Get blogs by category
     */
    async getBlogsByCategory(category, page = 1, limit = 10) {
        try {
            const skip = (page - 1) * limit;

            const [blogs, total] = await Promise.all([
                MarketBlog.find({
                    category: { $regex: category, $options: 'i' },
                    status: 'published'
                })
                    .populate('createdBy', 'fullName email')
                    .skip(skip)
                    .limit(limit)
                    .sort('-publishedAt'),
                MarketBlog.countDocuments({
                    category: { $regex: category, $options: 'i' },
                    status: 'published'
                })
            ]);

            return {
                blogs: blogs.map(blog => this.formatBlogResponse(blog)),
                pagination: {
                    total,
                    pages: Math.ceil(total / limit),
                    currentPage: parseInt(page),
                    limit: parseInt(limit)
                }
            };
        } catch (error) {
            throw {
                status: error.status || 500,
                message: error.message || 'Failed to fetch blogs by category'
            };
        }
    }

    /**
     * Update blog post
     */
    async updateBlog(blogId, authorId, updates) {
        try {
            const blog = await MarketBlog.findById(blogId);

            if (!blog) {
                throw { status: 404, message: 'Blog post not found' };
            }

            // Check authorization - only creator or admin can update
            if (blog.createdBy.toString() !== authorId) {
                throw { status: 403, message: 'Not authorized to update this blog post' };
            }

            // Update allowed fields
            const allowedUpdates = ['title', 'excerpt', 'content', 'author', 'category', 'readTime', 'featuredImage', 'seo', 'status'];
            
            allowedUpdates.forEach(field => {
                if (updates[field] !== undefined) {
                    blog[field] = updates[field];
                }
            });

            // Recalculate read time if content was updated
            if (updates.content) {
                blog.calculateReadTime();
            }

            await blog.save();

            console.log(chalk.blue(`→ Blog updated: ${blog.title}`));

            return {
                message: 'Blog post updated successfully',
                blog: this.formatBlogResponse(blog)
            };
        } catch (error) {
            throw {
                status: error.status || 500,
                message: error.message || 'Failed to update blog post'
            };
        }
    }

    /**
     * Publish/unpublish blog post
     */
    async publishBlog(blogId, authorId, publish = true) {
        try {
            const blog = await MarketBlog.findById(blogId);

            if (!blog) {
                throw { status: 404, message: 'Blog post not found' };
            }

            // Check authorization
            if (blog.createdBy.toString() !== authorId) {
                throw { status: 403, message: 'Not authorized to publish this blog post' };
            }

            blog.status = publish ? 'published' : 'draft';
            if (publish && !blog.publishedAt) {
                blog.publishedAt = new Date();
            }

            await blog.save();

            console.log(chalk.green(`✓ Blog ${publish ? 'published' : 'unpublished'}: ${blog.title}`));

            return {
                message: `Blog post ${publish ? 'published' : 'unpublished'} successfully`,
                blog: this.formatBlogResponse(blog)
            };
        } catch (error) {
            throw {
                status: error.status || 500,
                message: error.message || `Failed to ${publish ? 'publish' : 'unpublish'} blog post`
            };
        }
    }

    /**
     * Delete blog post
     */
    async deleteBlog(blogId, authorId) {
        try {
            const blog = await MarketBlog.findById(blogId);

            if (!blog) {
                throw { status: 404, message: 'Blog post not found' };
            }

            // Check authorization - only creator or admin can delete
            if (blog.createdBy.toString() !== authorId) {
                throw { status: 403, message: 'Not authorized to delete this blog post' };
            }

            await MarketBlog.deleteOne({ _id: blogId });

            console.log(chalk.red(`✗ Blog deleted: ${blog.title}`));

            return {
                message: 'Blog post deleted successfully',
                blogId: blog._id
            };
        } catch (error) {
            throw {
                status: error.status || 500,
                message: error.message || 'Failed to delete blog post'
            };
        }
    }

    /**
     * Get latest blogs
     */
    async getLatestBlogs(limit = 5) {
        try {
            const blogs = await MarketBlog.find({ status: 'published' })
                .populate('createdBy', 'fullName email')
                .limit(limit)
                .sort('-publishedAt');

            return blogs.map(blog => this.formatBlogResponse(blog));
        } catch (error) {
            throw {
                status: error.status || 500,
                message: error.message || 'Failed to fetch latest blogs'
            };
        }
    }

    /**
     * Get popular blogs by views
     */
    async getPopularBlogs(limit = 5) {
        try {
            const blogs = await MarketBlog.find({ status: 'published' })
                .populate('createdBy', 'fullName email')
                .limit(limit)
                .sort('-metadata.views');

            return blogs.map(blog => this.formatBlogResponse(blog));
        } catch (error) {
            throw {
                status: error.status || 500,
                message: error.message || 'Failed to fetch popular blogs'
            };
        }
    }

    /**
     * Get all categories
     */
    async getBlogCategories() {
        try {
            const categories = await MarketBlog.distinct('category', { status: 'published' });
            return categories.sort();
        } catch (error) {
            throw {
                status: error.status || 500,
                message: error.message || 'Failed to fetch categories'
            };
        }
    }

    /**
     * Admin: Get all blogs including drafts
     */
    async getAdminAllBlogs(query = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                status,
                category,
                search,
                sort = '-createdAt'
            } = query;

            const skip = (page - 1) * limit;
            const filter = {};

            if (status) {
                filter.status = status;
            }

            if (category) {
                filter.category = { $regex: category, $options: 'i' };
            }

            if (search) {
                filter.$or = [
                    { title: { $regex: search, $options: 'i' } },
                    { excerpt: { $regex: search, $options: 'i' } },
                    { author: { $regex: search, $options: 'i' } }
                ];
            }

            const [blogs, total] = await Promise.all([
                MarketBlog.find(filter)
                    .populate('createdBy', 'fullName email')
                    .skip(skip)
                    .limit(limit)
                    .sort(sort),
                MarketBlog.countDocuments(filter)
            ]);

            return {
                blogs: blogs.map(blog => this.formatBlogResponse(blog)),
                pagination: {
                    total,
                    pages: Math.ceil(total / limit),
                    currentPage: parseInt(page),
                    limit: parseInt(limit)
                }
            };
        } catch (error) {
            throw {
                status: error.status || 500,
                message: error.message || 'Failed to fetch admin blogs'
            };
        }
    }

    /**
     * Admin: Update any blog post
     */
    async adminUpdateBlog(blogId, updates) {
        try {
            const blog = await MarketBlog.findById(blogId);

            if (!blog) {
                throw { status: 404, message: 'Blog post not found' };
            }

            const allowedUpdates = ['title', 'excerpt', 'content', 'author', 'category', 'readTime', 'featuredImage', 'seo', 'status'];

            allowedUpdates.forEach(field => {
                if (updates[field] !== undefined) {
                    blog[field] = updates[field];
                }
            });

            if (updates.content) {
                blog.calculateReadTime();
            }

            await blog.save();

            console.log(chalk.blue(`→ Admin updated blog: ${blog.title}`));

            return {
                message: 'Blog post updated successfully',
                blog: this.formatBlogResponse(blog)
            };
        } catch (error) {
            throw {
                status: error.status || 500,
                message: error.message || 'Failed to update blog post'
            };
        }
    }

    /**
     * Admin: Publish/unpublish any blog post
     */
    async adminPublishBlog(blogId, publish = true) {
        try {
            const blog = await MarketBlog.findById(blogId);

            if (!blog) {
                throw { status: 404, message: 'Blog post not found' };
            }

            blog.status = publish ? 'published' : 'draft';
            if (publish && !blog.publishedAt) {
                blog.publishedAt = new Date();
            }

            await blog.save();

            console.log(chalk.green(`✓ Admin ${publish ? 'published' : 'unpublished'} blog: ${blog.title}`));

            return {
                message: `Blog post ${publish ? 'published' : 'unpublished'} successfully`,
                blog: this.formatBlogResponse(blog)
            };
        } catch (error) {
            throw {
                status: error.status || 500,
                message: error.message || `Failed to ${publish ? 'publish' : 'unpublish'} blog post`
            };
        }
    }

    /**
     * Admin: Delete any blog post
     */
    async adminDeleteBlog(blogId) {
        try {
            const blog = await MarketBlog.findById(blogId);

            if (!blog) {
                throw { status: 404, message: 'Blog post not found' };
            }

            await MarketBlog.deleteOne({ _id: blogId });

            console.log(chalk.red(`✗ Admin deleted blog: ${blog.title}`));

            return {
                message: 'Blog post deleted successfully',
                blogId: blog._id,
                title: blog.title
            };
        } catch (error) {
            throw {
                status: error.status || 500,
                message: error.message || 'Failed to delete blog post'
            };
        }
    }

    /**
     * Format blog response
     */
    formatBlogResponse(blog) {
        return {
            id: blog._id,
            title: blog.title,
            slug: blog.slug,
            excerpt: blog.excerpt,
            content: blog.content,
            author: blog.author,
            category: blog.category,
            featuredImage: blog.featuredImage,
            readTime: blog.readTime,
            status: blog.status,
            publishedAt: blog.publishedAt,
            createdAt: blog.createdAt,
            updatedAt: blog.updatedAt,
            metadata: blog.metadata,
            seo: blog.seo,
            createdBy: blog.createdBy ? {
                id: blog.createdBy._id,
                fullName: blog.createdBy.fullName,
                email: blog.createdBy.email
            } : null
        };
    }
}

module.exports = new BlogService();
