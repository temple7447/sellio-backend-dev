const chalk = require('chalk');
const productService = require('../services/product.service');

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
            const result = await productService.getAdminProducts(req.query);
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Admin products fetch failed:', error));
            res.status(500).json({ message: error.message });
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
            await productService.deleteProduct(req.params.id, req.user._id);
            console.log(chalk.yellow(`✓ Product deleted: ${req.params.id}`));
            res.json({ message: 'Product deleted successfully' });
        } catch (error) {
            console.error(chalk.red('✗ Product deletion failed:', error));
            res.status(error.status || 500).json({ message: error.message });
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
}

module.exports = new ProductController();
