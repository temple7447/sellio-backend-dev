const adsService = require('../services/ads.service');
const chalk = require('chalk');

class AdsController {
    /**
     * GET /api/ads/placements
     * Public — returns all available placement options
     */
    async getPlacementOptions(req, res) {
        try {
            const placements = adsService.getPlacementOptions();
            res.json({ status: 'success', placements });
        } catch (error) {
            console.error(chalk.red('✗ Get placements failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * POST /api/ads/campaigns
     * Seller — create new ad campaign, deducts from wallet
     */
    async createCampaign(req, res) {
        try {
            const { placement, durationDays } = req.body;

            if (!placement || !durationDays) {
                return res.status(400).json({ message: 'placement and durationDays are required' });
            }

            const result = await adsService.createCampaign(req.user._id, { placement, durationDays });

            console.log(chalk.green(`✓ Campaign created by seller ${req.user._id}`));
            res.status(201).json({ status: 'success', ...result });
        } catch (error) {
            console.error(chalk.red('✗ Create campaign failed:', error.message));
            res.status(error.status || 500).json({ message: error.message, ...error });
        }
    }

    /**
     * GET /api/ads/campaigns
     * Seller — list own campaigns
     */
    async getMyCampaigns(req, res) {
        try {
            const result = await adsService.getSellerCampaigns(req.user._id, req.query);
            res.json({ status: 'success', ...result });
        } catch (error) {
            console.error(chalk.red('✗ Get campaigns failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * GET /api/ads/campaigns/:id
     * Seller — get single campaign
     */
    async getCampaign(req, res) {
        try {
            const campaign = await adsService.getCampaignById(req.params.id, req.user._id);
            res.json({ status: 'success', campaign });
        } catch (error) {
            console.error(chalk.red('✗ Get campaign failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * PUT /api/ads/campaigns/:id/pause
     */
    async pauseCampaign(req, res) {
        try {
            const campaign = await adsService.pauseCampaign(req.params.id, req.user._id);
            res.json({ status: 'success', campaign });
        } catch (error) {
            console.error(chalk.red('✗ Pause campaign failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * PUT /api/ads/campaigns/:id/resume
     */
    async resumeCampaign(req, res) {
        try {
            const campaign = await adsService.resumeCampaign(req.params.id, req.user._id);
            res.json({ status: 'success', campaign });
        } catch (error) {
            console.error(chalk.red('✗ Resume campaign failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * DELETE /api/ads/campaigns/:id
     * Seller — cancel campaign
     */
    async cancelCampaign(req, res) {
        try {
            const campaign = await adsService.cancelCampaign(req.params.id, req.user._id);
            res.json({ status: 'success', campaign });
        } catch (error) {
            console.error(chalk.red('✗ Cancel campaign failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * GET /api/ads/active/:placement
     * Public — get active ads for a placement (for frontend to render)
     */
    async getActiveAdsByPlacement(req, res) {
        try {
            const campaigns = await adsService.getActiveAdsByPlacement(req.params.placement);
            res.json({ status: 'success', campaigns });
        } catch (error) {
            console.error(chalk.red('✗ Get active ads failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * GET /api/ads/sponsored-products/:placement
     * Public — get active products from sellers running ads on this placement
     */
    async getSponsoredProducts(req, res) {
        try {
            const { limit } = req.query;
            const products = await adsService.getSponsoredProducts(req.params.placement, limit);
            res.json({ status: 'success', products });
        } catch (error) {
            console.error(chalk.red('✗ Get sponsored products failed:', error.message));
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * GET /api/ads/admin/campaigns
     * Admin — get all campaigns
     */
    async getAllCampaigns(req, res) {
        try {
            const result = await adsService.getAllCampaigns(req.query);
            res.json({ status: 'success', ...result });
        } catch (error) {
            console.error(chalk.red('✗ Admin get all campaigns failed:'), error.message);
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    /**
     * POST /api/ads/track-click/:campaignId
     * Public — track a click on an ad (for frontend to call when user clicks advertised product)
     */
    async trackClick(req, res) {
        try {
            const result = await adsService.trackClick(req.params.campaignId);
            res.json({ status: 'success', ...result });
        } catch (error) {
            console.error(chalk.red('✗ Track click failed:'), error.message);
            res.status(error.status || 500).json({ message: error.message });
        }
    }
}

module.exports = new AdsController();
