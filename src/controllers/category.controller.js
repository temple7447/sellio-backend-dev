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
            const category = await categoryService.createCategory(req.body, req.file);
            console.log(chalk.green('✓ Category created:', category.name));
            res.status(201).json(category);
        } catch (error) {
            console.error(chalk.red('✗ Category creation failed:', error));
            res.status(error.status || 400).json({ message: error.message });
        }
    }



    async deleteCategory(req, res) {
        try {
            const result = await categoryService.deleteCategory(req.params.id);
            console.log(chalk.yellow(`✓ Category deleted: ${result.data.name}`));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Category deletion failed:', error));
            res.status(error.status || 500).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new CategoryController();
