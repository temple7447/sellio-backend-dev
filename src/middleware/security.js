const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const compression = require('compression');

// Standard API limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        status: 429,
        message: 'Too many requests from this IP, please try again after 15 minutes',
        details: 'Rate limit exceeded'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Auth routes limiter (more strict)
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 30, // limit each IP to 30 requests per hour
    message: {
        status: 429,
        message: 'Too many authentication attempts, please try again after an hour',
        details: 'Authentication rate limit exceeded'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Product routes limiter (more lenient)
const productLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 requests per 15 minutes
    message: {
        status: 429,
        message: 'Too many product requests, please try again after 15 minutes',
        details: 'Product rate limit exceeded'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = (app) => {
    // Security HTTP headers
    app.use(helmet());

    // Apply different rate limiters to different routes
    app.use('/api/auth', authLimiter);
    app.use('/api/products', productLimiter);
    app.use('/api', apiLimiter); // Default limiter for other routes

    // Data sanitization against NoSQL query injection
    app.use(mongoSanitize());

    // Data sanitization against XSS
    app.use(xss());

    // Compression
    app.use(compression());

    // Error handler for rate limit exceeded
    app.use((err, req, res, next) => {
        if (err instanceof Error && err.status === 429) {
            console.error(`Rate limit exceeded for IP ${req.ip}`);
            return res.status(429).json({
                status: 429,
                message: err.message || 'Too many requests',
                retryAfter: err.retryAfter
            });
        }
        next(err);
    });
};
