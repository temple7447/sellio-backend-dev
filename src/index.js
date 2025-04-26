const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const chalk = require('chalk');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const config = require('./config/config');
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const securityMiddleware = require('./middleware/security');

const app = express();

// Apply security middleware
securityMiddleware(app);

app.use(cors());
app.use(express.json());

// Swagger documentation route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

mongoose.connect(config.MONGODB_URI)
    .then(() => console.log(chalk.green('✓ Connected to MongoDB')))
    .catch(err => console.error(chalk.red('✗ MongoDB connection error:'), err));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

app.listen(config.PORT, () => {
    console.log(chalk.blue(`✓ Server is running on port ${config.PORT}`));
});
