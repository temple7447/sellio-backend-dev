const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    excerpt: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        required: true
    },
    author: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    featuredImage: {
        url: {
            type: String,
            default: null
        },
        publicId: {
            type: String,
            default: null
        }
    },
    readTime: {
        type: String,
        required: true,
        default: '5 min read'
    },
    status: {
        type: String,
        enum: ['draft', 'published'],
        default: 'draft'
    },
    publishedAt: {
        type: Date,
        default: null
    },
    metadata: {
        views: {
            type: Number,
            default: 0
        },
        likes: {
            type: Number,
            default: 0
        }
    },
    seo: {
        metaDescription: {
            type: String,
            trim: true,
            maxlength: 160
        },
        keywords: [{
            type: String,
            trim: true
        }]
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketUser',
        required: true
    }
}, {
    timestamps: true
});

// Generate slug from title before saving
blogSchema.pre('save', function (next) {
    if (this.isModified('title')) {
        this.slug = this.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
    
    // Set publishedAt when status changes to published
    if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
        this.publishedAt = new Date();
    }
    
    next();
});

// Calculate read time from content
blogSchema.methods.calculateReadTime = function() {
    const wordsPerMinute = 200;
    const wordCount = this.content.split(/\s+/).length;
    const readTimeMinutes = Math.ceil(wordCount / wordsPerMinute);
    this.readTime = `${readTimeMinutes} min read`;
};

const MarketBlog = mongoose.model('MarketBlog', blogSchema);

module.exports = MarketBlog;
