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

    async toggleTrustedBadge(req, res) {
        try {
            const { isTrusted } = req.body;
            if (typeof isTrusted !== 'boolean') {
                return res.status(400).json({ message: 'isTrusted must be a boolean' });
            }
            const result = await adminService.toggleTrustedBadge(req.params.sellerId, isTrusted);
            console.log(chalk.green(`✓ Trusted badge ${isTrusted ? 'awarded' : 'removed'} successfully`));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Trusted badge toggle failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async deleteUser(req, res) {
        try {
            const { reason } = req.body; // Optional deletion reason
            const result = await adminService.deleteUser(req.params.userId, reason);
            console.log(chalk.green('✓ User soft deleted and anonymized successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ User deletion failed:', error));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async adminUpdateUser(req, res) {
        try {
            const result = await adminService.adminUpdateUser(
                req.params.userId,
                req.body
            );
            console.log(chalk.green(`✓ User updated successfully: ${result.email}`));
            res.json({
                success: true,
                message: 'User updated successfully',
                data: result
            });
        } catch (error) {
            console.error(chalk.red('✗ User update failed:', error));
            res.status(error.status || 400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getSellerBankInfo(req, res) {
        try {
            const result = await adminService.getSellerBankInfo(req.params.sellerId);
            console.log(chalk.green('✓ Seller bank info fetched'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Fetching seller bank info failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async getUserBankInfo(req, res) {
        try {
            const result = await adminService.getUserBankInfo(req.params.userId);
            console.log(chalk.green('✓ User bank info fetched'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Fetching user bank info failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async getRewardSettings(req, res) {
        try {
            const settings = await adminService.getRewardSettings();
            console.log(chalk.green('✓ Reward settings retrieved successfully'));
            res.json(settings);
        } catch (error) {
            console.error(chalk.red('✗ Get reward settings failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async updateRewardSettings(req, res) {
        try {
            const result = await adminService.updateRewardSettings(req.user._id, req.body);
            console.log(chalk.green('✓ Reward settings updated successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Update reward settings failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async getPricingFees(req, res) {
        try {
            const fees = await adminService.getPricingFees();
            res.json({ success: true, data: fees });
        } catch (error) {
            console.error(chalk.red('✗ Get pricing fees failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async updatePricingFees(req, res) {
        try {
            const result = await adminService.updatePricingFees(req.user._id, req.body.tiers);
            console.log(chalk.green('✓ Pricing fees updated successfully'));
            res.json({ success: true, ...result });
        } catch (error) {
            console.error(chalk.red('✗ Update pricing fees failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async getReferrals(req, res) {
        try {
            const result = await adminService.getReferrals(req.query);
            console.log(chalk.green('✓ Referrals fetched successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Referrals fetch failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }
}

module.exports = new AdminController();
