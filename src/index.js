const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const chalk = require('chalk');
const config = require('./config/config');
const categoryService = require('./services/category.service');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const orderRoutes = require('./routes/order.routes');
const securityMiddleware = require('./middleware/security');
const requestLogger = require('./middleware/logger');
const multer = require('multer');
const categoryRoutes = require('./routes/category.routes');

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

app.use(cors());
app.use(express.json());

// Swagger documentation route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

mongoose.connect(config.MONGODB_URI)
    .then(async () => {
        console.log(chalk.green('✓ Connected to MongoDB'));
        await categoryService.seedCategories();
    })
    .catch(err => console.error(chalk.red('✗ MongoDB connection error:'), err));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/categories', categoryRoutes);

// Global error handler
app.use((err, req, res, next) => {
    console.error(chalk.red('Error:'), err);
    
    if (err.status === 429) {
        return res.status(429).json({
            status: 'error',
            message: err.message || 'Too many requests',
            retryAfter: err.retryAfter || 900 // 15 minutes in seconds
        });
    }

    const statusCode = err.status || 500;
    res.status(statusCode).json({
        status: 'error',
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

app.listen(config.PORT, () => {
    console.log(chalk.blue(`✓ Server is running on port ${config.PORT}`));
});
