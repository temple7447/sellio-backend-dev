const chalk = require('chalk');
const categoryService = require('../services/category.service');

class CategoryController {
    async getAllCategories(req, res) {
        try {
            const categories = await categoryService.getAllCategories(req.query);
            res.json(categories);
        } catch (error) {
            console.error(chalk.red('✗ Categories fetch failed:', error));
            res.status(500).json({ message: error.message });
        }
    }

    async createCategory(req, res) {
        try {
            const category = await categoryService.createCategory(req.body);
            console.log(chalk.green('✓ Category created:', category.name));
            res.status(201).json(category);
        } catch (error) {
            console.error(chalk.red('✗ Category creation failed:', error));
            res.status(error.status || 400).json({ message: error.message });
        }
    }

    async getCategoryStats(req, res) {
        try {
            const stats = await categoryService.getCategoryStats();
            res.json(stats);
        } catch (error) {
            console.error(chalk.red('✗ Category stats fetch failed:', error));
            res.status(500).json({ message: error.message });
        }
    }

    async getPopularCategories(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 4;
            const popular = await categoryService.getPopularCategories(limit);
            res.json(popular);
        } catch (error) {
            console.error(chalk.red('✗ Popular categories fetch failed:', error));
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = new CategoryController();
