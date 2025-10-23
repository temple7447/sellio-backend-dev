const express = require('express');
const router = express.Router();
const multer = require('multer');
const { auth, isAdmin } = require('../middleware/auth');
const testimonialController = require('../controllers/testimonial.controller');

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB limit for avatars
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png/;
        if (allowedTypes.test(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error('Only .png, .jpg and .jpeg format allowed!'));
    }
});

// Public routes - Get approved testimonials only
router.get('/', testimonialController.getPublicTestimonials);

// Admin routes - Full CRUD access
router.post(
    '/admin',
    auth,
    isAdmin,
    upload.single('customerAvatar'),
    testimonialController.createTestimonial
);

router.get(
    '/admin/all',
    auth,
    isAdmin,
    testimonialController.getAllTestimonials
);

router.get(
    '/admin/:id',
    auth,
    isAdmin,
    testimonialController.getTestimonialById
);

router.put(
    '/admin/:id',
    auth,
    isAdmin,
    upload.single('customerAvatar'),
    testimonialController.updateTestimonial
);

router.delete(
    '/admin/:id',
    auth,
    isAdmin,
    testimonialController.deleteTestimonial
);

module.exports = router;
