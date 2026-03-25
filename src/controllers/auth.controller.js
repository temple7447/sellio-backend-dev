const chalk = require('chalk');
const authService = require('../services/auth.service');
const discordLogger = require('../utils/discordLogger');

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

    async registerCustomer(req, res) {
        try {
            const result = await authService.registerCustomer(req.body, req.file);
            console.log(chalk.green('✓ Customer registered successfully:', result.email));
            res.status(201).json(result);
        } catch (error) {
            console.error(chalk.red('✗ Customer registration failed:', error.message));
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
            const message = result.requiresOTP ? 'Admin verification required' : `${result.user.role} logged in successfully`;
            console.log(chalk.green(`✓ ${message}`));
            
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Login failed:', error));
            res.status(400).json({ message: error.message });
        }
    }

    async verifyAdminLoginOTP(req, res) {
        try {
            const result = await authService.verifyAdminLoginOTP(req.body);
            console.log(chalk.green('✓ Admin login verified successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Admin login verification failed:', error));
            res.status(error.status || 400).json({ message: error.message });
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

    async resendOTP(req, res) {
        try {
            const result = await authService.resendOTP(req.body.email);
            console.log(chalk.green('✓ New OTP sent successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ OTP resend failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async getPublicSellerProfile(req, res) {
        try {
            const profile = await authService.getPublicSellerProfile(
                req.params.sellerId,
                req.user?._id // Pass the requesting user's ID if authenticated
            );
            res.json(profile);
        } catch (error) {
            console.error(chalk.red('✗ Public seller profile fetch failed:', error));
            res.status(error.status || 404).json({ message: error.message });
        }
    }

    async getPublicSellers(req, res) {
        try {
            const result = await authService.getPublicSellers(req.query);
            console.log(chalk.green('✓ Public sellers fetched successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Public sellers fetch failed:', error));
            const statusCode = error.status || 500;
            const response = {
                success: false,
                message: error.message || 'Failed to fetch sellers',
                error: error.error || error.message
            };
            res.status(statusCode).json(response);
        }
    }

    async getTopSellers(req, res) {
        try {
            const sellers = await authService.getTopSellers(req.query.limit);
            res.json({ sellers });
        } catch (error) {
            console.error(chalk.red('✗ Top sellers fetch failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async updateSellerProfile(req, res) {
        try {
            const result = await authService.updateSellerProfile(
                req.user._id,
                req.body,
                req.file
            );
            console.log(chalk.green('✓ Seller profile updated successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Profile update failed:', error.message));
            res.status(error.status || 400).json({ message: error.message });
        }
    }

    async updateAdminProfile(req, res) {
        try {
            const result = await authService.updateAdminProfile(
                req.user._id,
                req.body,
                req.file
            );
            console.log(chalk.green('✓ Admin profile updated successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Profile update failed:', error.message));
            res.status(error.status || 400).json({ message: error.message });
        }
    }

    async updateCustomerProfile(req, res) {
        try {
            const result = await authService.updateCustomerProfile(
                req.user._id,
                req.body,
                req.file
            );
            console.log(chalk.green('✓ Customer profile updated successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Profile update failed:', error.message));
            res.status(error.status || 400).json({ message: error.message });
        }
    }

    async forgotPassword(req, res) {
        try {
            const result = await authService.forgotPassword(req.body.email);
            console.log(chalk.green('✓ Password reset OTP sent successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Password reset failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async verifyPasswordResetOTP(req, res) {
        try {
            const result = await authService.verifyPasswordResetOTP(req.body);
            console.log(chalk.green('✓ Password reset OTP verified'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ OTP verification failed:', error.message));
            res.status(400).json({ message: error.message });
        }
    }

    async resetPassword(req, res) {
        try {
            const result = await authService.resetPassword(req.body);
            console.log(chalk.green('✓ Password reset successful'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Password reset failed:', error.message));
            res.status(error.status || 400).json({ message: error.message });
        }
    }

    async addBankInfo(req, res) {
        try {
            const result = await authService.addBankInfo(req.user._id, req.body);
            console.log(chalk.green('✓ Bank information added successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Adding bank info failed:', error.message));
            res.status(error.status || 400).json({ message: error.message });
        }
    }

    async getBankInfo(req, res) {
        try {
            const result = await authService.getBankInfo(req.user._id);
            console.log(chalk.green('✓ Bank information fetched successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Fetching bank info failed:', error.message));
            res.status(error.status || 400).json({ message: error.message });
        }
    }

    async updateBankInfo(req, res) {
        try {
            const result = await authService.updateBankInfo(req.user._id, req.body);
            console.log(chalk.green('✓ Bank information updated successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Updating bank info failed:', error.message));
            res.status(error.status || 400).json({ message: error.message });
        }
    }

    async uploadSellerProfileImage(req, res) {
        try {
            const result = await authService.uploadSellerProfileImage(
                req.user._id,
                req.file
            );
            console.log(chalk.green('✓ Seller profile image updated successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Profile image upload failed:', error.message));
            res.status(error.status || 400).json({ message: error.message });
        }
    }

    async getReferralCode(req, res) {
        try {
            const result = await authService.getReferralCode(req.user._id);
            console.log(chalk.green('✓ Referral code fetched successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Failed to get referral code:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async getReferralStats(req, res) {
        try {
            const result = await authService.getReferralStats(req.user._id);
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Failed to get referral stats:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }
}

module.exports = new AuthController();
