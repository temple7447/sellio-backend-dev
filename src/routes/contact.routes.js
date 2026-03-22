const express = require('express');
const router = express.Router();
const ContactController = require('../controllers/contact.controller');
const { auth } = require('../middleware/auth');

// Public Routes
// Create a new contact message (anyone can submit)
router.post('/', ContactController.createContact);

// Admin Routes (require authentication)
// Get contact statistics
router.get('/admin/stats/overview', auth, ContactController.getContactStats);

// Get all contact messages
router.get('/admin/all', auth, ContactController.getAllContacts);

// Get single contact message by ID
router.get('/admin/:id', auth, ContactController.getContactById);

// Update contact message (add notes, change status)
router.put('/admin/:id', auth, ContactController.updateContact);

// Delete contact message
router.delete('/admin/:id', auth, ContactController.deleteContact);

module.exports = router;
