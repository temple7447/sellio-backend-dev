const cloudinary = require('cloudinary').v2;
const chalk = require('chalk');
const config = require('../config/config');

cloudinary.config({
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET,
});

const validateFile = (file) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.mimetype)) {
        throw new Error(`Invalid file type: ${file.mimetype}. Allowed types: ${allowedTypes.join(', ')}`);
    }

    if (file.size > maxSize) {
        throw new Error('File size too large. Maximum size: 5MB');
    }
};

const uploadToCloudinary = async (file, folder) => {
    try {
        validateFile(file);

        const base64Data = file.buffer.toString('base64');
        const result = await cloudinary.uploader.upload(`data:${file.mimetype};base64,${base64Data}`, {
            folder,
            resource_type: 'auto',
            transformation: [{ quality: 'auto' }]
        });

        console.log(chalk.green('✓ File uploaded to Cloudinary successfully'));
        return result;
    } catch (error) {
        console.error(chalk.red('✗ Cloudinary upload error:', error.message));
        throw new Error(`File upload failed: ${error.message}`);
    }
};

module.exports = { cloudinary, uploadToCloudinary };
