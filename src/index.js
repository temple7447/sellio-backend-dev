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
const requestLogger = require('./middleware/logger');
const multer = require('multer');
const categoryRoutes = require('./routes/category.routes');
const testimonialRoutes = require('./routes/testimonial.routes');
const reviewRoutes = require('./routes/review.routes');
const walletRoutes = require('./routes/wallet.routes');


// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
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

// Add logger before CORS and other middleware
app.use(requestLogger);

app.use(cors({
    origin: "*",
    methods: "*",
    allowedHeaders: "*",
    exposedHeaders: "*",
    credentials: true
}));
app.use(express.json());

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
            wallet: '/api/wallet'
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

// Global error handler
app.use((err, req, res, next) => {
    const timestamp = new Date().toISOString();

    console.error(chalk.red(`[${timestamp}] Error:`), {
        ip: req.ip,
        path: req.path,
        method: req.method,
        error: err
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
});
