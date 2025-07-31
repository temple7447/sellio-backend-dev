const chalk = require('chalk');
const adminService = require('../services/admin.service');

class AdminController {
    async registerAdmin(req, res) {
        try {
            const result = await adminService.registerAdmin(req.body);
            console.log(chalk.green('✓ Admin registered successfully:', result.email));
            res.status(201).json(result);
        } catch (error) {
            console.error(chalk.red('✗ Admin registration failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async getAllUsers(req, res) {
        try {
            const result = await adminService.getAllUsers(req.query);
            console.log(chalk.green('✓ Users fetched successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Users fetch failed:', error));
            res.status(500).json({ message: error.message });
        }
    }

    async verifySeller(req, res) {
        try {
            const result = await adminService.verifySeller(req.params.sellerId);
            console.log(chalk.green('✓ Seller verified successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Seller verification failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async deleteUser(req, res) {
        try {
            const result = await adminService.deleteUser(req.params.userId);
            console.log(chalk.green('✓ User deleted successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ User deletion failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }
}

module.exports = new AdminController();
