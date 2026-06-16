const mongoose = require('mongoose');
const MarketOrder = require('../models/MarketOrder');
const MarketProduct = require('../models/MarketProduct');
const MarketReview = require('../models/MarketReview');
const MarketOrderItem = require('../models/MarketOrderItem');

class ReviewService {
  async createCustomerReview(customerId, { orderId, productId, rating, comment, images }) {
    // Basic validation
    if (!orderId || rating == null) {
      throw { status: 400, message: 'orderId and rating are required' };
    }
    if (rating < 1 || rating > 5) {
      throw { status: 400, message: 'Rating must be between 1 and 5' };
    }

    // Normalise photos: accept ["url"] or [{ url }], keep at most 6 valid urls.
    const cleanImages = Array.isArray(images)
      ? images
          .map((img) => (typeof img === 'string' ? { url: img } : img && img.url ? { url: img.url } : null))
          .filter((img) => img && typeof img.url === 'string' && img.url.trim())
          .slice(0, 6)
      : [];

    // Ensure order belongs to customer and is delivered
    const order = await MarketOrder.findOne({ _id: orderId, customerId });
    if (!order) {
      throw { status: 404, message: 'Order not found' };
    }
    if (!['delivered'].includes(order.status)) {
      throw { status: 400, message: 'You can review only after confirming pickup (delivered)' };
    }

    // Fetch items from MarketOrderItem since they are not stored on the order directly
    const orderItems = await MarketOrderItem.find({ orderId });

    if (!orderItems || orderItems.length === 0) {
      throw { status: 400, message: 'No items found for this order' };
    }

    // Determine productId if not provided
    let effectiveProductId = productId;
    if (!effectiveProductId) {
      const uniqueProductIds = Array.from(new Set(orderItems.map(i => String(i.productId))));
      if (uniqueProductIds.length === 1) {
        effectiveProductId = uniqueProductIds[0];
      } else {
        throw { status: 400, message: 'productId is required for orders with multiple products' };
      }
    }

    // Ensure product exists in order
    const hasItem = orderItems.some(i => String(i.productId) === String(effectiveProductId));
    if (!hasItem) {
      throw { status: 400, message: 'This product was not part of the order' };
    }

    // Create review (unique index prevents duplicates)
    try {
      const review = new MarketReview({ productId: effectiveProductId, customerId, orderId, rating, comment, images: cleanImages });
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
    } catch (error) {
      if (error.code === 11000) {
        throw { status: 400, message: 'You have already reviewed this product for this order' };
      }
      throw error;
    }
  }

  async listVendorReviews(sellerId, { page = 1, limit = 20, minRating } = {}) {
    if (!sellerId) throw { status: 400, message: 'sellerId is required' };
    if (!mongoose.Types.ObjectId.isValid(sellerId)) throw { status: 400, message: 'Invalid sellerId' };
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
      {
        $project: {
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
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: nLimit }],
          meta: [{ $group: { _id: null, count: { $sum: 1 }, avgRating: { $avg: '$rating' } } }]
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

  async listProductReviews(productId, { page = 1, limit = 20, sort = 'recent', rating, withPhotos } = {}, viewerId = null) {
    if (!productId) throw { status: 400, message: 'productId is required' };
    if (!mongoose.Types.ObjectId.isValid(productId)) throw { status: 400, message: 'Invalid productId' };
    const productObjectId = new mongoose.Types.ObjectId(String(productId));

    const nPage = Math.max(parseInt(page, 10) || 1, 1);
    const nLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (nPage - 1) * nLimit;

    // Sort options.
    const sortStage = {
      recent: { createdAt: -1 },
      helpful: { helpfulCount: -1, createdAt: -1 },
      rating_high: { rating: -1, createdAt: -1 },
      rating_low: { rating: 1, createdAt: -1 },
    }[sort] || { createdAt: -1 };

    // Filters applied to the listed page (not the breakdown).
    const listMatch = { productId: productObjectId };
    if (rating != null && rating !== '') listMatch.rating = Number(rating);
    if (withPhotos === true || withPhotos === 'true') listMatch['images.0'] = { $exists: true };

    const viewerObjectId = viewerId && mongoose.Types.ObjectId.isValid(viewerId)
      ? new mongoose.Types.ObjectId(String(viewerId))
      : null;

    // Breakdown + summary over ALL reviews for the product (ignores filters so
    // the rating chips can show totals).
    const [agg] = await MarketReview.aggregate([
      { $match: { productId: productObjectId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          avg: { $avg: '$rating' },
          withPhotos: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ['$images', []] } }, 0] }, 1, 0] } },
          s5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          s4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          s3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          s2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          s1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
        },
      },
    ]);
    const stats = agg || { total: 0, avg: null, withPhotos: 0, s5: 0, s4: 0, s3: 0, s2: 0, s1: 0 };

    const filteredTotal = await MarketReview.countDocuments(listMatch);

    const data = await MarketReview.aggregate([
      { $match: listMatch },
      { $sort: sortStage },
      { $skip: skip },
      { $limit: nLimit },
      { $lookup: { from: 'marketusers', localField: 'customerId', foreignField: '_id', as: 'customer' } },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          productId: 1,
          customerId: 1,
          orderId: 1,
          rating: 1,
          comment: 1,
          images: { $ifNull: ['$images', []] },
          helpfulCount: { $ifNull: ['$helpfulCount', 0] },
          viewerHasVoted: viewerObjectId
            ? { $in: [viewerObjectId, { $ifNull: ['$helpfulBy', []] }] }
            : { $literal: false },
          createdAt: 1,
          customer: { fullName: { $concat: [{ $substr: ['$customer.fullName', 0, 1] }, '***'] } },
        },
      },
    ]);

    return {
      success: true,
      data,
      pagination: { page: nPage, limit: nLimit, total: filteredTotal },
      summary: {
        averageRating: stats.avg != null ? Number(stats.avg.toFixed(2)) : null,
        totalReviews: stats.total,
        withPhotos: stats.withPhotos,
        breakdown: { 5: stats.s5, 4: stats.s4, 3: stats.s3, 2: stats.s2, 1: stats.s1 },
      },
    };
  }

  // Toggle the current user's "helpful" vote on a review.
  async toggleHelpful(reviewId, userId) {
    if (!mongoose.Types.ObjectId.isValid(reviewId)) throw { status: 400, message: 'Invalid reviewId' };
    const review = await MarketReview.findById(reviewId);
    if (!review) throw { status: 404, message: 'Review not found' };

    const uid = String(userId);
    const already = (review.helpfulBy || []).some((id) => String(id) === uid);
    if (already) {
      review.helpfulBy = review.helpfulBy.filter((id) => String(id) !== uid);
    } else {
      review.helpfulBy.push(userId);
    }
    review.helpfulCount = review.helpfulBy.length;
    await review.save();

    return { success: true, data: { helpfulCount: review.helpfulCount, viewerHasVoted: !already } };
  }
}

module.exports = new ReviewService();
