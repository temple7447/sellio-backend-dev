const chalk = require('chalk');
const authService = require('../services/auth.service');

class AuthController {
    async registerSeller(req, res) {
        try {
            const result = await authService.registerSeller(req.body, req.file);
            console.log(chalk.green('✓ Seller registered successfully:', result.email));
            res.status(201).json(result);
        } catch (error) {
            console.error(chalk.red('✗ Registration failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async verifyOTP(req, res) {
        try {
            const result = await authService.verifyOTP(req.body);
            console.log(chalk.green('✓ User verified successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ OTP verification failed:', error));
            res.status(400).json({ message: error.message });
        }
    }

    async login(req, res) {
        try {
            const result = await authService.login(req.body);
            console.log(chalk.green(`✓ ${result.role} logged in successfully`));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Login failed:', error));
            res.status(400).json({ message: error.message });
        }
    }

    async getProfile(req, res) {
        try {
            const profile = await authService.getProfile(req.user._id);
            res.json(profile);
        } catch (error) {
            console.error(chalk.red('✗ Profile fetch failed:', error));
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = new AuthController();
