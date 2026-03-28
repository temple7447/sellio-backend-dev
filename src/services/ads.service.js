const { AdCampaign, AD_PLACEMENTS } = require('../models/AdCampaign');
const walletService = require('./wallet.service');
const chalk = require('chalk');

class AdsService {
    generateReference() {
        return `AD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    }

    /**
     * Get all available ad placement options
     */
    getPlacementOptions() {
        return Object.entries(AD_PLACEMENTS).map(([key, value]) => ({
            key,
            label: value.label,
            dailyRate: value.dailyRate,
            description: value.description
        }));
    }

    /**
     * Create a new ad campaign and deduct from wallet
     */
    async createCampaign(sellerId, { placement, durationDays }) {
        const placementConfig = AD_PLACEMENTS[placement];
        if (!placementConfig) {
            throw { status: 400, message: 'Invalid ad placement' };
        }

        if (!durationDays || durationDays < 1) {
            throw { status: 400, message: 'Duration must be at least 1 day' };
        }

        const totalBudget = durationDays * placementConfig.dailyRate;

        if (totalBudget < 1000) {
            const minDays = Math.ceil(1000 / placementConfig.dailyRate);
            throw {
                status: 400,
                message: `Minimum campaign budget is ₦1,000. Minimum duration for this placement is ${minDays} days.`
            };
        }

        const reference = this.generateReference();

        // Deduct from wallet first
        const walletResult = await walletService.debit(
            sellerId,
            totalBudget,
            `Ad campaign payment — ${placementConfig.label} for ${durationDays} days`,
            {
                type: 'ad_spend',
                reference,
                paymentGateway: 'wallet'
            }
        );

        const now = new Date();
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + durationDays);

        const campaign = await AdCampaign.create({
            sellerId,
            placement,
            totalBudget,
            dailyRate: placementConfig.dailyRate,
            durationDays,
            startDate: now,
            endDate,
            status: 'active',
            reference,
            walletTransactionId: walletResult.transaction._id
        });

        console.log(chalk.green(`✓ Ad campaign created: ${reference} — ${placementConfig.label} for ${durationDays} days`));

        return {
            campaign,
            walletDeducted: totalBudget,
            newBalance: walletResult.balanceAfter
        };
    }

    /**
     * Get campaigns for a seller
     */
    async getSellerCampaigns(sellerId, query = {}) {
        const { status, page = 1, limit = 10 } = query;
        const filter = { sellerId };
        if (status) filter.status = status;

        const skip = (page - 1) * limit;
        const [campaigns, total] = await Promise.all([
            AdCampaign.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
            AdCampaign.countDocuments(filter)
        ]);

        return { campaigns, total, page: Number(page), limit: Number(limit) };
    }

    /**
     * Get a single campaign by ID (validates ownership)
     */
    async getCampaignById(campaignId, sellerId) {
        const campaign = await AdCampaign.findById(campaignId);
        if (!campaign) throw { status: 404, message: 'Campaign not found' };
        if (campaign.sellerId.toString() !== sellerId.toString()) {
            throw { status: 403, message: 'Access denied' };
        }
        return campaign;
    }

    /**
     * Pause an active campaign
     */
    async pauseCampaign(campaignId, sellerId) {
        const campaign = await this.getCampaignById(campaignId, sellerId);
        if (campaign.status !== 'active') {
            throw { status: 400, message: `Campaign cannot be paused (current status: ${campaign.status})` };
        }

        campaign.status = 'paused';
        await campaign.save();
        console.log(chalk.yellow(`⏸ Campaign paused: ${campaign.reference}`));
        return campaign;
    }

    /**
     * Resume a paused campaign
     */
    async resumeCampaign(campaignId, sellerId) {
        const campaign = await this.getCampaignById(campaignId, sellerId);
        if (campaign.status !== 'paused') {
            throw { status: 400, message: `Campaign cannot be resumed (current status: ${campaign.status})` };
        }

        // Extend end date by remaining unused days if needed
        campaign.status = 'active';
        await campaign.save();
        console.log(chalk.green(`▶ Campaign resumed: ${campaign.reference}`));
        return campaign;
    }

    /**
     * Cancel a campaign (no refund)
     */
    async cancelCampaign(campaignId, sellerId) {
        const campaign = await this.getCampaignById(campaignId, sellerId);
        if (['completed', 'cancelled'].includes(campaign.status)) {
            throw { status: 400, message: `Campaign is already ${campaign.status}` };
        }

        campaign.status = 'cancelled';
        await campaign.save();
        console.log(chalk.red(`✗ Campaign cancelled: ${campaign.reference}`));
        return campaign;
    }

    /**
     * Get active ads for a specific placement (for frontend display)
     */
    async getActiveAdsByPlacement(placement) {
        if (!AD_PLACEMENTS[placement]) {
            throw { status: 400, message: 'Invalid placement' };
        }

        const now = new Date();
        const campaigns = await AdCampaign.find({
            placement,
            status: 'active',
            startDate: { $lte: now },
            endDate: { $gte: now }
        }).populate('sellerId', 'name email avatar');

        return campaigns;
    }

    /**
     * Get active sponsored products for a placement
     * Returns products belonging to sellers with an active campaign on that placement
     */
    async getSponsoredProducts(placement, limit = 10) {
        if (!AD_PLACEMENTS[placement]) {
            throw { status: 400, message: 'Invalid placement' };
        }

        const MarketProduct = require('../models/MarketProduct');
        const now = new Date();

        const activeCampaigns = await AdCampaign.find({
            placement,
            status: 'active',
            startDate: { $lte: now },
            endDate: { $gte: now }
        });

        if (activeCampaigns.length === 0) return [];

        const campaignBySeller = {};
        activeCampaigns.forEach(c => {
            campaignBySeller[c.sellerId.toString()] = c._id;
        });

        const sellerIds = Object.keys(campaignBySeller);

        const products = await MarketProduct.find({
            sellerId: { $in: sellerIds },
            status: 'active'
        })
            .populate('sellerId', 'name avatar')
            .populate('category', 'name')
            .limit(Number(limit))
            .sort({ 'metadata.sales': -1 });

        const productsWithCampaign = products.map(product => {
            const productObj = product.toObject();
            productObj.campaignId = campaignBySeller[product.sellerId._id.toString()];
            return productObj;
        });

        return productsWithCampaign;
    }

    /**
     * Admin: get all campaigns
     */
    async getAllCampaigns(query = {}) {
        const { status, placement, page = 1, limit = 20 } = query;
        const filter = {};
        if (status) filter.status = status;
        if (placement) filter.placement = placement;

        const skip = (page - 1) * limit;
        const [campaigns, total] = await Promise.all([
            AdCampaign.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .populate('sellerId', 'name email'),
            AdCampaign.countDocuments(filter)
        ]);

        return { campaigns, total, page: Number(page), limit: Number(limit) };
    }

    /**
     * Mark expired campaigns as completed (called by cleanup service or cron)
     */
    async markExpiredCampaigns() {
        const now = new Date();
        const result = await AdCampaign.updateMany(
            { status: 'active', endDate: { $lt: now } },
            { $set: { status: 'completed' } }
        );
        if (result.modifiedCount > 0) {
            console.log(chalk.blue(`✓ Marked ${result.modifiedCount} expired campaigns as completed`));
        }
        return result.modifiedCount;
    }

    /**
     * Track a click on an ad
     */
    async trackClick(campaignId) {
        const campaign = await AdCampaign.findById(campaignId);
        if (!campaign) {
            throw { status: 404, message: 'Campaign not found' };
        }

        if (!['active', 'paused'].includes(campaign.status)) {
            throw { status: 400, message: 'Campaign is not active' };
        }

        campaign.clicks += 1;
        await campaign.save();

        console.log(chalk.cyan(`👆 Ad click tracked: ${campaign.reference} (${campaign.placement}) - Total clicks: ${campaign.clicks}`));

        return { clicks: campaign.clicks };
    }
}

module.exports = new AdsService();
