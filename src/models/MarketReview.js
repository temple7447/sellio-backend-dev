const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarketProduct',
    required: true,
    index: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarketUser',
    required: true,
    index: true,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarketOrder',
    required: true,
    index: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    trim: true,
    default: '',
  }
}, {
  timestamps: true,
});

// Prevent duplicate review for the same product within the same order by same customer
reviewSchema.index({ productId: 1, customerId: 1, orderId: 1 }, { unique: true });

module.exports = mongoose.model('MarketReview', reviewSchema);
