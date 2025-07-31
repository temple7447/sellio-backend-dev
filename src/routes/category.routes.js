const express = require('express');
const router = express.Router();
const multer = require('multer');
const { auth, isAdmin } = require('../middleware/auth');
const categoryController = require('../controllers/category.controller');

const upload = multer({ storage: multer.memoryStorage() });


router.get('/', categoryController.getAllCategories);


router.get('/stats', categoryController.getCategoryStats);

router.get('/popular', categoryController.getPopularCategories);


router.post('/', auth, isAdmin, upload.single('image'), categoryController.createCategory);


router.delete('/:id', auth, isAdmin, categoryController.deleteCategory);

module.exports = router;
