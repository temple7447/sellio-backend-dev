const express = require('express');
const router = express.Router();
const multer = require('multer');
const { auth, isAdmin } = require('../middleware/auth');
const categoryController = require('../controllers/category.controller');

const upload = multer({ storage: multer.memoryStorage() });


router.get('/', categoryController.getAllCategories);





router.post('/', auth, isAdmin, upload.single('image'), categoryController.createCategory);


router.delete('/:id', auth, isAdmin, categoryController.deleteCategory);

module.exports = router;
