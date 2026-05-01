const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const chalk = require('chalk');
const config = require('./config/config');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const orderRoutes = require('./routes/order.routes');
const securityMiddleware = require('./middleware/security');
const discordRequestLogger = require('./middleware/requestLogger');
const multer = require('multer');
const categoryRoutes = require('./routes/category.routes');
const testimonialRoutes = require('./routes/testimonial.routes');
const reviewRoutes = require('./routes/review.routes');
const walletRoutes = require('./routes/wallet.routes');
const wishlistRoutes = require('./routes/wishlist.routes');
const cartRoutes = require('./routes/cart.routes');
const mediaRoutes = require('./routes/media.routes');
const notificationRoutes = require('./routes/notification.routes');
const blogRoutes = require('./routes/blog.routes');
const contactRoutes = require('./routes/contact.routes');
const adsRoutes = require('./routes/ads.routes');
const cleanupService = require('./services/cleanup.service');
const discordLogger = require('./utils/discordLogger');

// Start background services
cleanupService.start();

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png/;
        if (allowedTypes.test(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error('Only .png, .jpg and .jpeg format allowed!'));
    }
});

const app = express();

// Apply security middleware
securityMiddleware(app);

// Add Discord request logger before CORS
app.use(discordRequestLogger);

app.use(cors({
    origin: "*",
    methods: "*",
    allowedHeaders: "*",
    exposedHeaders: "*",
    credentials: true
}));
app.use(express.json());

// Temporary: 3.5s request delay + 3.5s response delay (7s total)
app.use((req, res, next) => {
  setTimeout(() => {
    ['send', 'json'].forEach(m => {
      const orig = res[m].bind(res);
      res[m] = (b) => setTimeout(() => orig(b), 3500);
    });
    next();
  }, 3500);
});

app.get("/", (req, res) => {
    res.json({
        status: 'success',
        message: 'Welcome to Sellio Marketplace API',
        version: '1.0.0',
        documentation: '/api-docs',
        endpoints: {
            auth: '/api/auth',
            products: '/api/products',
            orders: '/api/orders',
            categories: '/api/categories',
            testimonials: '/api/testimonials',
            reviews: '/api/reviews',
            blog: '/api/blog',
            wallet: '/api/wallet',
            wishlist: '/api/wishlist',
            cart: '/api/cart',
            media: '/api/media',
            notifications: '/api/notifications',
            contact: '/api/contact',
            ads: '/api/ads'
        }
    });
});

// Swagger documentation route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

mongoose.connect(config.MONGODB_URI)
    .then(() => {
        console.log(chalk.green('✓ Connected to MongoDB'));
    })
    .catch(err => console.error(chalk.red('✗ MongoDB connection error:'), err));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/testimonials', testimonialRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/ads', adsRoutes);

// Global error handler
app.use((err, req, res, next) => {
    const timestamp = new Date().toISOString();

    console.error(chalk.red(`[${timestamp}] Error:`), {
        ip: req.ip,
        path: req.path,
        method: req.method,
        error: err
    });

    discordLogger.error(`API Error: ${err.message}`, {
        path: req.path,
        method: req.method,
        ip: req.ip,
        stack: err.stack?.substring(0, 500) || 'No stack trace'
    });

    const statusCode = err.status || 500;
    res.status(statusCode).json({
        status: 'error',
        message: err.message || 'Internal server error',
        timestamp,
        path: req.path,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

app.listen(config.PORT, '0.0.0.0', () => {
    console.log(chalk.blue(`✓ Server is running on port ${config.PORT}`));
    discordLogger.success(`Server started on port ${config.PORT}`);
});
