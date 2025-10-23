const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema({
    customerName: {
        type: String,
        required: true,
        trim: true
    },
    roleBusiness: {
        type: String,
        required: true,
        trim: true
    },
    testimonialContent: {
        type: String,
        required: true,
        trim: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    customerAvatar: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

const MarketTestimonial = mongoose.model('MarketTestimonial', testimonialSchema);

module.exports = MarketTestimonial;
