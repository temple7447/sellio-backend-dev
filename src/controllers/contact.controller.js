const ContactService = require('../services/contact.service');
const chalk = require('chalk');

class ContactController {
  /**
   * Create a new contact message
   * POST /api/contact
   */
  static async createContact(req, res) {
    try {
      console.log(chalk.blue('→ Creating contact message...'));

      const { name, email, subject, message } = req.body;

      // Validate required fields
      if (!name || !email || !subject || !message) {
        console.log(chalk.yellow('⚠ Missing required fields'));
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: name, email, subject, message',
        });
      }

      // Get IP address
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      // Create contact
      const contact = await ContactService.createContact(
        { name, email, subject, message },
        ipAddress,
        userAgent
      );

      console.log(chalk.green('✓ Contact message created successfully'));

      return res.status(201).json({
        success: true,
        message: 'Message sent successfully! We will get back to you soon.',
        contact: {
          id: contact._id,
          name: contact.name,
          email: contact.email,
          subject: contact.subject,
        },
      });
    } catch (error) {
      console.error(chalk.red('✗ Error creating contact:'), error.message);

      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to send message. Please try again.',
      });
    }
  }

  /**
   * Get all contact messages (admin)
   * GET /api/contact/admin/all
   */
  static async getAllContacts(req, res) {
    try {
      console.log(chalk.blue('→ Fetching all contact messages...'));

      const { page, limit, status, search, sortBy } = req.query;

      const result = await ContactService.getAllContacts({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        status: status || null,
        search: search || null,
        sortBy: sortBy || '-createdAt',
      });

      console.log(chalk.green('✓ Retrieved all contact messages'));

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error(chalk.red('✗ Error fetching contacts:'), error.message);

      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve contact messages.',
      });
    }
  }

  /**
   * Get single contact message (admin)
   * GET /api/contact/admin/:id
   */
  static async getContactById(req, res) {
    try {
      console.log(chalk.blue('→ Fetching contact message...'));

      const { id } = req.params;

      const contact = await ContactService.getContactById(id);

      console.log(chalk.green('✓ Retrieved contact message'));

      return res.status(200).json({
        success: true,
        contact,
      });
    } catch (error) {
      console.error(chalk.red('✗ Error fetching contact:'), error.message);

      const statusCode = error.message.includes('not found') ? 404 : 500;

      return res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to retrieve contact message.',
      });
    }
  }

  /**
   * Update contact message (admin)
   * PUT /api/contact/admin/:id
   */
  static async updateContact(req, res) {
    try {
      console.log(chalk.blue('→ Updating contact message...'));

      const { id } = req.params;
      const { status, adminNotes } = req.body;

      // Validate status if provided
      if (status && !['new', 'read', 'replied'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Allowed values: new, read, replied',
        });
      }

      const contact = await ContactService.updateContact(id, {
        status: status || undefined,
        adminNotes: adminNotes || undefined,
      });

      console.log(chalk.green('✓ Updated contact message'));

      return res.status(200).json({
        success: true,
        message: 'Contact message updated successfully',
        contact,
      });
    } catch (error) {
      console.error(chalk.red('✗ Error updating contact:'), error.message);

      const statusCode = error.message.includes('not found') ? 404 : 500;

      return res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to update contact message.',
      });
    }
  }

  /**
   * Delete contact message (admin)
   * DELETE /api/contact/admin/:id
   */
  static async deleteContact(req, res) {
    try {
      console.log(chalk.blue('→ Deleting contact message...'));

      const { id } = req.params;

      const contact = await ContactService.deleteContact(id);

      console.log(chalk.green('✓ Deleted contact message'));

      return res.status(200).json({
        success: true,
        message: 'Contact message deleted successfully',
        contact,
      });
    } catch (error) {
      console.error(chalk.red('✗ Error deleting contact:'), error.message);

      const statusCode = error.message.includes('not found') ? 404 : 500;

      return res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to delete contact message.',
      });
    }
  }

  /**
   * Get contact statistics (admin)
   * GET /api/contact/admin/stats/overview
   */
  static async getContactStats(req, res) {
    try {
      console.log(chalk.blue('→ Fetching contact statistics...'));

      const stats = await ContactService.getContactStats();

      console.log(chalk.green('✓ Retrieved contact statistics'));

      return res.status(200).json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error(chalk.red('✗ Error fetching contact statistics:'), error.message);

      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve contact statistics.',
      });
    }
  }
}

module.exports = ContactController;
