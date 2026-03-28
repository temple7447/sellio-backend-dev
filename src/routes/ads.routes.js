const express = require('express');
const router = express.Router();
const { auth, isAdmin, isSeller } = require('../middleware/auth');
const adsController = require('../controllers/ads.controller');

/**
 * @route   GET /api/ads/placements
 * @desc    Get all available ad placement options with pricing
 * @access  Public
 */
router.get('/placements', adsController.getPlacementOptions);

/**
 * @route   GET /api/ads/active/:placement
 * @desc    Get active ads for a specific placement (for frontend display)
 * @access  Public
 */
router.get('/active/:placement', adsController.getActiveAdsByPlacement);

/**
 * @route   GET /api/ads/sponsored-products/:placement
 * @desc    Get products from sellers running active ads on this placement
 * @access  Public
 */
router.get('/sponsored-products/:placement', adsController.getSponsoredProducts);

/**
 * @route   POST /api/ads/track-click/:campaignId
 * @desc    Track a click on an advertised product
 * @access  Public
 */
router.post('/track-click/:campaignId', adsController.trackClick);

/**
 * @route   GET /api/ads/admin/campaigns
 * @desc    Get all campaigns across the system
 * @access  Private (Admin)
 */
router.get('/admin/campaigns', auth, isAdmin, adsController.getAllCampaigns);

/**
 * @route   POST /api/ads/campaigns
 * @desc    Create a new ad campaign (deducts from wallet)
 * @access  Private (Sellers only)
 */
router.post('/campaigns', auth, isSeller, adsController.createCampaign);

/**
 * @route   GET /api/ads/campaigns
 * @desc    Get seller's own campaigns
 * @access  Private (Sellers)
 */
router.get('/campaigns', auth, isSeller, adsController.getMyCampaigns);

/**
 * @route   GET /api/ads/campaigns/:id
 * @desc    Get a single campaign by ID
 * @access  Private (Sellers)
 */
router.get('/campaigns/:id', auth, isSeller, adsController.getCampaign);

/**
 * @route   PUT /api/ads/campaigns/:id/pause
 * @desc    Pause an active campaign
 * @access  Private (Sellers)
 */
router.put('/campaigns/:id/pause', auth, isSeller, adsController.pauseCampaign);

/**
 * @route   PUT /api/ads/campaigns/:id/resume
 * @desc    Resume a paused campaign
 * @access  Private (Sellers)
 */
router.put('/campaigns/:id/resume', auth, isSeller, adsController.resumeCampaign);

/**
 * @route   DELETE /api/ads/campaigns/:id
 * @desc    Cancel a campaign
 * @access  Private (Sellers)
 */
router.delete('/campaigns/:id', auth, isSeller, adsController.cancelCampaign);

module.exports = router;
