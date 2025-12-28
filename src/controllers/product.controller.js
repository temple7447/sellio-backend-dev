const chalk = require('chalk');
const productService = require('../services/product.service');
const adminService = require('../services/admin.service');

class ProductController {
    async createProduct(req, res) {
        try {
            const result = await productService.createProduct(req.user._id, req.body, req.files);
            console.log(chalk.green(`✓ Product created: ${result.name}`));
            res.status(201).json(result);
        } catch (error) {
            console.error(chalk.red('✗ Product creation failed:', error));
            res.status(error.status || 400).json({ message: error.message });
        }
    }

    async getSellerProducts(req, res) {
        try {
            const products = await productService.getSellerProducts(req.user._id);
            res.json(products);
        } catch (error) {
            console.error(chalk.red('✗ Product fetch failed:', error));
            res.status(500).json({ message: error.message });
        }
    }

    async getPublicProducts(req, res) {
        try {
            const result = await productService.getPublicProducts(req.query);
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Public products fetch failed:', error));
            res.status(500).json({ message: error.message });
        }
    }

    async getAdminProducts(req, res) {
        try {
            const result = await adminService.getAdminProducts(req.query);
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Admin products fetch failed:', error));
            res.status(500).json({ message: error.message });
        }
    }

    async getActiveAdminProducts(req, res) {
        try {
            const result = await adminService.getActiveAdminProducts(req.query);
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Active products fetch failed:', error));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async getProductById(req, res) {
        try {
            const product = await productService.getProductById(req.params.id);
            res.json(product);
        } catch (error) {
            console.error(chalk.red('✗ Product fetch failed:', error));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async getPublicProductById(req, res) {
        try {
            const product = await productService.getPublicProductById(req.params.id);
            res.json(product);
        } catch (error) {
            console.error(chalk.red('✗ Public product fetch failed:', error));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async getPublicSellerProducts(req, res) {
        try {
            const result = await productService.getPublicSellerProducts(
                req.params.sellerId,
                req.query
            );
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Public seller products fetch failed:', error));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async updateProduct(req, res) {
        try {
            const product = await productService.updateProduct(req.params.id, req.user._id, req.body);
            console.log(chalk.blue(`✓ Product updated: ${product.name}`));
            res.json(product);
        } catch (error) {
            console.error(chalk.red('✗ Product update failed:', error));
            res.status(error.status || 400).json({ message: error.message });
        }
    }

    async updateProductStatus(req, res) {
        try {
            const result = await productService.updateProductStatus(
                req.params.id,
                req.user._id,
                req.body.status
            );
            console.log(chalk.blue(`✓ Product ${result.name} status updated to: ${result.status}`));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Product status update failed:', error));
            res.status(error.status || 400).json({ message: error.message });
        }
    }

    async deleteProduct(req, res) {
        try {
            const result = await productService.deleteProduct(req.params.id, req.user._id);
            console.log(chalk.yellow(`✓ Product deleted: ${result.data.name}`));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Product deletion failed:', {
                code: error.code,
                message: error.message,
                productId: req.params.id,
                sellerId: req.user._id
            }));

            const errorResponse = {
                success: false,
                code: error.code || 'UNKNOWN_ERROR',
                message: error.message || 'Failed to delete product',
                details: error.details || undefined
            };

            res.status(error.status || 500).json(errorResponse);
        }
    }

    async getOtherProductsBySeller(req, res) {
        try {
            const { productId, sellerId } = req.params;
            const limit = parseInt(req.query.limit) || 4;

            const products = await productService.getOtherProductsBySeller(
                productId,
                sellerId,
                limit
            );
            res.json(products);
        } catch (error) {
            console.error(chalk.red('✗ Seller products fetch failed:', error));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async getSellerDashboardStats(req, res) {
        try {
            const stats = await productService.getSellerDashboardStats(req.user._id);
            res.json(stats);
        } catch (error) {
            console.error(chalk.red('✗ Dashboard stats fetch failed:', error));
            res.status(500).json({ message: error.message });
        }
    }

    async getPopularProducts(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 4;
            const popular = await productService.getPopularProducts(limit);
            console.log(chalk.green('✓ Popular products fetched successfully'));
            res.json(popular);
        } catch (error) {
            console.error(chalk.red('✗ Popular products fetch failed:', error));
            res.status(500).json({ message: error.message });
        }
    }

    async getTrendingProducts(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 4;
            const trending = await productService.getTrendingProducts(limit);
            console.log(chalk.green('✓ Trending products fetched successfully'));
            res.json(trending);
        } catch (error) {
            console.error(chalk.red('✗ Trending products fetch failed:', error));
            res.status(500).json({ message: error.message });
        }
    }


    async adminDeleteProduct(req, res) {
        try {
            const result = await adminService.adminDeleteProduct(req.params.id);
            console.log(chalk.yellow(`✓ Product deleted by admin: ${result.data.name}`));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Admin product deletion failed:', {
                code: error.code,
                message: error.message,
                productId: req.params.id
            }));

            res.status(error.status || 500).json({
                success: false,
                code: error.code || 'UNKNOWN_ERROR',
                message: error.message || 'Failed to delete product',
                details: error.details || undefined
            });
        }
    }

    async adminUpdateProductStatus(req, res) {
        try {
            const result = await adminService.adminUpdateProductStatus(
                req.params.id,
                req.body.status
            );
            console.log(chalk.blue(`✓ Admin updated product ${result.name} status to: ${result.status}`));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Admin product status update failed:', error));
            res.status(error.status || 400).json({
                success: false,
                message: error.message
            });
        }
    }

    async adminUpdateProduct(req, res) {
        try {
            const result = await adminService.adminUpdateProduct(
                req.params.id,
                req.body
            );
            console.log(chalk.blue(`✓ Admin updated product: ${result.name}`));
            res.json({
                success: true,
                message: 'Product updated successfully',
                data: result
            });
        } catch (error) {
            console.error(chalk.red('✗ Admin product update failed:', error));
            res.status(error.status || 400).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new ProductController();
