const reviewService = require('../services/review.service');
const chalk = require('chalk');

class ReviewController {
  async createCustomerReview(req, res) {
    try {
      const result = await reviewService.createCustomerReview(req.user._id, req.body);
      console.log(chalk.green('✓ Review submitted'));
      res.status(201).json(result);
    } catch (error) {
      console.error(chalk.red('✗ Review submission failed:'), error?.message || error);
      res.status(error.status || 400).json({ message: error.message || 'Failed to submit review' });
    }
  }

  async listVendorReviews(req, res) {
    try {
      const result = await reviewService.listVendorReviews(req.params.sellerId, req.query);
      res.status(200).json(result);
    } catch (error) {
      console.error(chalk.red('✗ Fetching vendor reviews failed:'), error?.message || error);
      res.status(error.status || 500).json({ message: error.message || 'Failed to fetch reviews' });
    }
  }

  async listProductReviews(req, res) {
    try {
      // optionalAuth may have attached req.user — used to flag the viewer's votes.
      const viewerId = req.user?._id || null;
      const result = await reviewService.listProductReviews(req.params.productId, req.query, viewerId);
      res.status(200).json(result);
    } catch (error) {
      console.error(chalk.red('✗ Fetching product reviews failed:'), error?.message || error);
      res.status(error.status || 500).json({ message: error.message || 'Failed to fetch reviews' });
    }
  }

  async markReviewHelpful(req, res) {
    try {
      const result = await reviewService.toggleHelpful(req.params.reviewId, req.user._id);
      res.status(200).json(result);
    } catch (error) {
      console.error(chalk.red('✗ Toggling review helpful failed:'), error?.message || error);
      res.status(error.status || 400).json({ message: error.message || 'Failed to update review' });
    }
  }
}

module.exports = new ReviewController();
