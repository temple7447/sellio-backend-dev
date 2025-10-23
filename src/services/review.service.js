const mongoose = require('mongoose');
const MarketOrder = require('../models/MarketOrder');
const MarketProduct = require('../models/MarketProduct');
const MarketReview = require('../models/MarketReview');

class ReviewService {
  async createCustomerReview(customerId, { orderId, productId, rating, comment }) {
    // Basic validation
    if (!orderId || rating == null) {
      throw { status: 400, message: 'orderId and rating are required' };
    }
    if (rating < 1 || rating > 5) {
      throw { status: 400, message: 'Rating must be between 1 and 5' };
    }

    // Ensure order belongs to customer and is delivered
    const order = await MarketOrder.findOne({ _id: orderId, customerId });
    if (!order) {
      throw { status: 404, message: 'Order not found' };
    }
    if (!['delivered'].includes(order.status)) {
      throw { status: 400, message: 'You can review only after confirming pickup (delivered)' };
    }

    // Determine productId if not provided
    let effectiveProductId = productId;
    if (!effectiveProductId) {
      const uniqueProductIds = Array.from(new Set(order.items.map(i => String(i.productId))));
      if (uniqueProductIds.length === 1) {
        effectiveProductId = uniqueProductIds[0];
      } else {
        throw { status: 400, message: 'productId is required for orders with multiple products' };
      }
    }

    // Ensure product exists in order
    const hasItem = order.items.some(i => String(i.productId) === String(effectiveProductId));
    if (!hasItem) {
      throw { status: 400, message: 'This product was not part of the order' };
    }

    // Create review (unique index prevents duplicates)
    const review = new MarketReview({ productId: effectiveProductId, customerId, orderId, rating, comment });
    await review.save();

    // Update product aggregate rating
    const product = await MarketProduct.findById(effectiveProductId);
    if (product) {
      const currentAvg = product.metadata?.rating?.average || 0;
      const currentCount = product.metadata?.rating?.count || 0;
      const newCount = currentCount + 1;
      const newAvg = ((currentAvg * currentCount) + rating) / newCount;
      if (!product.metadata) product.metadata = {};
      if (!product.metadata.rating) product.metadata.rating = { average: 0, count: 0 };
      product.metadata.rating.average = Number(newAvg.toFixed(2));
      product.metadata.rating.count = newCount;
      await product.save();
    }

    return { success: true, message: 'Review submitted', data: review };
  }

  async listVendorReviews(sellerId, { page = 1, limit = 20, minRating } = {}) {
    if (!sellerId) throw { status: 400, message: 'sellerId is required' };
    const sellerObjectId = new mongoose.Types.ObjectId(String(sellerId));

    const nPage = Math.max(parseInt(page, 10) || 1, 1);
    const nLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (nPage - 1) * nLimit;

    const productCollection = MarketProduct.collection.name; // 'marketproducts'

    const pipeline = [
      { $lookup: { from: productCollection, localField: 'productId', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      { $match: { 'product.sellerId': sellerObjectId, ...(minRating ? { rating: { $gte: Number(minRating) } } : {}) } },
      { $sort: { createdAt: -1 } },
      { $project: {
          _id: 1,
          productId: 1,
          customerId: 1,
          orderId: 1,
          rating: 1,
          comment: 1,
          createdAt: 1,
          product: { _id: '$product._id', name: '$product.name', images: '$product.images' }
        }
      },
      { $facet: {
          data: [ { $skip: skip }, { $limit: nLimit } ],
          meta: [ { $group: { _id: null, count: { $sum: 1 }, avgRating: { $avg: '$rating' } } } ]
        }
      }
    ];

    const [result] = await MarketReview.aggregate(pipeline);
    const meta = result.meta[0] || { count: 0, avgRating: null };

    return {
      success: true,
      data: result.data,
      pagination: { page: nPage, limit: nLimit, total: meta.count },
      summary: { averageRating: meta.avgRating != null ? Number(meta.avgRating.toFixed(2)) : null, totalReviews: meta.count }
    };
  }
}

module.exports = new ReviewService();
