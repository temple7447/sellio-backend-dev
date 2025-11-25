require('dotenv').config();

module.exports = {
    PORT: process.env.PORT || 3000,
    MONGODB_URI: process.env.MONGODB_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS,
    MAILTRAP_TOKEN: process.env.MAILTRAP_TOKEN,
    MAILTRAP_SENDER_EMAIL: process.env.MAILTRAP_SENDER_EMAIL || 'hello@demomailtrap.co',
    MAILTRAP_SENDER_NAME: process.env.MAILTRAP_SENDER_NAME || 'Sellio Marketplace',
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    ADMIN_SETUP_KEY: process.env.ADMIN_SETUP_KEY,
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
    FRONTEND_URL: process.env.FRONTEND_URL,
    RATE_LIMIT: {
        WINDOW_MS: 15 * 60 * 1000, // 15 minutes
        MAX_REQUESTS: 100,
        AUTH_WINDOW_MS: 1 * 60 * 1000, // 1 hour
        AUTH_MAX_REQUESTS: 200,
        PRODUCT_WINDOW_MS: 15 * 60 * 1000,
        PRODUCT_MAX_REQUESTS: 200
    }
};
