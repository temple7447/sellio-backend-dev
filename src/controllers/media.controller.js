const { uploadToCloudinary } = require('../utils/cloudinary');
const chalk = require('chalk');

class MediaController {
    async uploadImage(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No image file provided'
                });
            }

            console.log(chalk.blue('→ Uploading image to Cloudinary...'));
            const result = await uploadToCloudinary(req.file, 'general_uploads');

            if (!result || !result.secure_url) {
                throw new Error('Failed to get secure URL from Cloudinary');
            }

            console.log(chalk.green('✓ Image uploaded successfully:', result.secure_url));

            res.status(200).json({
                success: true,
                message: 'Image uploaded successfully',
                data: {
                    url: result.secure_url,
                    publicId: result.public_id
                }
            });
        } catch (error) {
            console.error(chalk.red('✗ Image upload failed:'), error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to upload image'
            });
        }
    }
}

module.exports = new MediaController();
