const { uploadToCloudinary } = require('../src/utils/cloudinary');
const chalk = require('chalk');

async function testLargeUpload() {
    console.log(chalk.blue('--- Testing 10MB Image Upload Configuration ---'));

    // Test Case 1: 8MB Image (Should Pass local validation)
    const passFile = {
        mimetype: 'image/jpeg',
        size: 8 * 1024 * 1024,
        buffer: Buffer.alloc(8 * 1024 * 1024),
        originalname: 'test-pass-8mb.jpg'
    };

    console.log(chalk.blue(`\n1. Testing 8MB file (Limit is 10MB)...`));
    try {
        await uploadToCloudinary(passFile, 'test_folder');
    } catch (error) {
        if (error.message.includes('File size too large')) {
            console.log(chalk.red('✗ Failed: 8MB file was rejected but should have been allowed.'));
        } else if (error.message.includes('File upload failed') && !error.message.includes('File size too large')) {
            console.log(chalk.green('✓ Success: 8MB file passed local validation (Cloudinary API error expected because of mock buffer/auth).'));
        } else {
            console.log(chalk.red('✗ Error:'), error.message);
        }
    }

    // Test Case 2: 12MB Image (Should Fail local validation)
    const failFile = {
        mimetype: 'image/jpeg',
        size: 12 * 1024 * 1024,
        buffer: Buffer.alloc(12 * 1024 * 1024),
        originalname: 'test-fail-12mb.jpg'
    };

    console.log(chalk.blue(`\n2. Testing 12MB file (Limit is 10MB)...`));
    try {
        await uploadToCloudinary(failFile, 'test_folder');
    } catch (error) {
        if (error.message.includes('File size too large')) {
            console.log(chalk.green('✓ Success: 12MB file was correctly rejected with "File size too large. Maximum size: 10MB".'));
        } else {
            console.log(chalk.red('✗ Unexpected error:'), error.message);
        }
    }

    process.exit(0);
}

testLargeUpload();
