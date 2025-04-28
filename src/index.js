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
const securityMiddleware = require('./middleware/security');
const requestLogger = require('./middleware/logger');
const multer = require('multer');

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

app.use(cors());
app.use(express.json());
app.use(requestLogger);  // Add this line before routes

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

app.listen(config.PORT, () => {
    console.log(chalk.blue(`✓ Server is running on port ${config.PORT}`));
});
