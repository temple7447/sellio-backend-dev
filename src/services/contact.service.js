const MarketContact = require('../models/MarketContact');
const Nodemailer = require('nodemailer');
const { MailtrapTransport } = require('mailtrap');
const config = require('../config/config');
const chalk = require('chalk');

// Initialize Mailtrap transport for contact emails
let contactTransport;
const initializeContactMailer = () => {
  try {
    if (!config.MAILTRAP_TOKEN) {
      throw new Error('Mailtrap token not configured');
    }

    contactTransport = Nodemailer.createTransport(
      MailtrapTransport({
        token: config.MAILTRAP_TOKEN,
      })
    );
  } catch (error) {
    console.error(chalk.red('✗ Contact email service error:'), error.message);
  }
};

initializeContactMailer();

class ContactService {
  /**
   * Create a new contact message
   * @param {Object} contactData - Contact form data
   * @param {String} ipAddress - IP address of sender
   * @param {String} userAgent - User agent of sender
   * @returns {Promise<Object>} Created contact object
   */
  static async createContact(contactData, ipAddress = null, userAgent = null) {
    try {
      // Validate input
      if (!contactData.name || !contactData.email || !contactData.subject || !contactData.message) {
        throw new Error('Missing required fields: name, email, subject, message');
      }

      // Create contact record
      const contact = await MarketContact.create({
        name: contactData.name,
        email: contactData.email,
        subject: contactData.subject,
        message: contactData.message,
        status: 'new',
        ipAddress,
        userAgent,
      });

      console.log(chalk.green('✓ Contact message created'), `ID: ${contact._id}`);

      // Send emails in parallel
      await Promise.all([
        this.sendCompanyEmail(contact),
        this.sendConfirmationEmail(contact),
      ]);

      return contact;
    } catch (error) {
      console.error(chalk.red('✗ Failed to create contact:'), error.message);
      throw error;
    }
  }

  /**
   * Send email to company
   * @param {Object} contact - Contact document
   */
  static async sendCompanyEmail(contact) {
    try {
      if (!contactTransport) {
        throw new Error('Email service not initialized');
      }

      const sender = {
        address: config.MAILTRAP_SENDER_EMAIL,
        name: config.MAILTRAP_SENDER_NAME,
      };

      const emailData = {
        from: sender,
        to: ['selliomarketplaces@gmail.com'],
        replyTo: contact.email,
        subject: `New Contact Form Submission: ${contact.subject}`,
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f7f7f7; padding: 40px 0;">
            <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow: hidden;">
              <div style="background: #0d6efd; color: #fff; padding: 24px 32px;">
                <h2 style="margin: 0; font-size: 1.5rem;">New Contact Form Submission</h2>
              </div>
              <div style="padding: 32px;">
                <div style="background: #f1f3f6; padding: 16px; border-left: 4px solid #0d6efd; margin-bottom: 20px;">
                  <p style="margin: 8px 0;">
                    <strong>From:</strong> ${contact.name} (${contact.email})
                  </p>
                  <p style="margin: 8px 0;">
                    <strong>Subject:</strong> ${contact.subject}
                  </p>
                </div>

                <h3 style="color: #222; margin-top: 20px;">Message:</h3>
                <p style="color: #555; line-height: 1.6; white-space: pre-wrap; background: #f9f9f9; padding: 16px; border-radius: 6px;">
                  ${escapeHtml(contact.message)}
                </p>

                <div style="border-top: 1px solid #e0e0e0; margin-top: 30px; padding-top: 20px; font-size: 0.9rem; color: #888;">
                  <p style="margin: 5px 0;">
                    <strong>Message ID:</strong> ${contact._id}
                  </p>
                  <p style="margin: 5px 0;">
                    <strong>Received:</strong> ${new Date(contact.createdAt).toLocaleString()}
                  </p>
                  <p style="margin: 5px 0;">
                    <strong>IP Address:</strong> ${contact.ipAddress || 'Not recorded'}
                  </p>
                </div>

                <div style="margin-top: 20px;">
                  <a href="${config.FRONTEND_URL || '#'}/admin/contacts/${contact._id}" style="display: inline-block; padding: 12px 24px; background: #0d6efd; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
                    View in Admin Panel
                  </a>
                </div>
              </div>

              <div style="background: #f1f3f6; color: #888; text-align: center; padding: 18px 32px; font-size: 0.95rem;">
                &copy; ${new Date().getFullYear()} Sellio Marketplace. All rights reserved.
              </div>
            </div>
          </div>
        `,
        text: `
New Contact Form Submission

From: ${contact.name} (${contact.email})
Subject: ${contact.subject}

Message:
${contact.message}

---
Message ID: ${contact._id}
Received: ${new Date(contact.createdAt).toLocaleString()}
        `,
        category: 'Contact Form',
      };

      const mailResponse = await contactTransport.sendMail(emailData);
      console.log(chalk.green('✓ Company email sent'), `Message ID: ${mailResponse.messageId}`);

      return {
        success: true,
        messageId: mailResponse.messageId,
      };
    } catch (error) {
      console.error(chalk.red('✗ Failed to send company email:'), error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send confirmation email to user
   * @param {Object} contact - Contact document
   */
  static async sendConfirmationEmail(contact) {
    try {
      if (!contactTransport) {
        throw new Error('Email service not initialized');
      }

      const sender = {
        address: config.MAILTRAP_SENDER_EMAIL,
        name: config.MAILTRAP_SENDER_NAME,
      };

      const emailData = {
        from: sender,
        to: [contact.email],
        subject: `We Received Your Message - Sellio Marketplace Support`,
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f7f7f7; padding: 40px 0;">
            <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow: hidden;">
              <div style="background: #0d6efd; color: #fff; padding: 24px 32px; text-align: center;">
                <h2 style="margin: 0; font-size: 1.7rem;">Sellio Marketplace</h2>
              </div>
              <div style="padding: 32px;">
                <h3 style="color: #222; margin-top: 0;">Hi ${contact.name},</h3>
                
                <p style="color: #555; font-size: 1.05rem; line-height: 1.6;">
                  Thank you for reaching out to us! We've received your message and our support team will get back to you as soon as possible.
                </p>

                <div style="background: #f1f3f6; border-left: 4px solid #0d6efd; padding: 16px; margin: 24px 0;">
                  <p style="margin: 0; font-weight: 600; color: #1e40af;">Message Details:</p>
                  <p style="margin: 8px 0 0 0; color: #333;">
                    <strong>Subject:</strong> ${contact.subject}
                  </p>
                  <p style="margin: 8px 0 0 0; color: #333;">
                    <strong>Reference ID:</strong> ${contact._id}
                  </p>
                  <p style="margin: 8px 0 0 0; color: #333;">
                    <strong>Submitted:</strong> ${new Date(contact.createdAt).toLocaleString()}
                  </p>
                </div>

                <p style="color: #666; font-size: 0.95rem;">
                  We typically respond within 24 hours. If your matter is urgent, please reach out to us directly at <strong>selliomarketplaces@gmail.com</strong>.
                </p>

                <p style="color: #888; font-size: 0.9rem; line-height: 1.6;">
                  Best regards,<br>
                  <strong>Sellio Marketplace Support Team</strong>
                </p>
              </div>

              <div style="background: #f1f3f6; color: #888; text-align: center; padding: 18px 32px; font-size: 0.95rem;">
                &copy; ${new Date().getFullYear()} Sellio Marketplace. All rights reserved.
              </div>
            </div>
          </div>
        `,
        text: `
Thank you for reaching out to Sellio Marketplace!

We've received your message and our support team will get back to you as soon as possible.

Message Details:
Subject: ${contact.subject}
Reference ID: ${contact._id}
Submitted: ${new Date(contact.createdAt).toLocaleString()}

We typically respond within 24 hours. If your matter is urgent, please reach out to us directly at selliomarketplaces@gmail.com.

Best regards,
Sellio Marketplace Support Team
        `,
        category: 'Contact Confirmation',
      };

      const mailResponse = await contactTransport.sendMail(emailData);
      console.log(chalk.green('✓ Confirmation email sent'), `to ${contact.email}`);

      return {
        success: true,
        messageId: mailResponse.messageId,
      };
    } catch (error) {
      console.error(chalk.red('✗ Failed to send confirmation email:'), error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get all contact messages (admin)
   * @param {Object} query - Query filters
   * @returns {Promise<Object>} Paginated contact messages
   */
  static async getAllContacts(query = {}) {
    try {
      const { page = 1, limit = 10, status = null, search = null, sortBy = '-createdAt' } = query;

      let filter = {};

      if (status) {
        filter.status = status;
      }

      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { subject: { $regex: search, $options: 'i' } },
          { message: { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (page - 1) * limit;

      const contacts = await MarketContact.find(filter)
        .sort(sortBy)
        .skip(skip)
        .limit(parseInt(limit));

      const total = await MarketContact.countDocuments(filter);

      console.log(chalk.green('✓ Retrieved contacts'), `Page ${page}, Total: ${total}`);

      return {
        contacts,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          currentPage: parseInt(page),
          pageSize: parseInt(limit),
        },
      };
    } catch (error) {
      console.error(chalk.red('✗ Failed to retrieve contacts:'), error.message);
      throw error;
    }
  }

  /**
   * Get single contact by ID
   * @param {String} contactId - Contact ID
   * @returns {Promise<Object>} Contact document
   */
  static async getContactById(contactId) {
    try {
      const contact = await MarketContact.findById(contactId);

      if (!contact) {
        throw new Error('Contact message not found');
      }

      // Mark as read if not already
      if (contact.status === 'new') {
        contact.status = 'read';
        contact.readAt = new Date();
        await contact.save();
      }

      console.log(chalk.green('✓ Retrieved contact'), `ID: ${contactId}`);

      return contact;
    } catch (error) {
      console.error(chalk.red('✗ Failed to retrieve contact:'), error.message);
      throw error;
    }
  }

  /**
   * Update contact (admin)
   * @param {String} contactId - Contact ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated contact document
   */
  static async updateContact(contactId, updates) {
    try {
      const contact = await MarketContact.findByIdAndUpdate(
        contactId,
        {
          ...updates,
          repliedAt: updates.status === 'replied' && !updates.repliedAt ? new Date() : updates.repliedAt,
        },
        { new: true, runValidators: true }
      );

      if (!contact) {
        throw new Error('Contact message not found');
      }

      console.log(chalk.green('✓ Updated contact'), `ID: ${contactId}`);

      return contact;
    } catch (error) {
      console.error(chalk.red('✗ Failed to update contact:'), error.message);
      throw error;
    }
  }

  /**
   * Delete contact (admin)
   * @param {String} contactId - Contact ID
   * @returns {Promise<Object>} Deleted contact document
   */
  static async deleteContact(contactId) {
    try {
      const contact = await MarketContact.findByIdAndDelete(contactId);

      if (!contact) {
        throw new Error('Contact message not found');
      }

      console.log(chalk.green('✓ Deleted contact'), `ID: ${contactId}`);

      return contact;
    } catch (error) {
      console.error(chalk.red('✗ Failed to delete contact:'), error.message);
      throw error;
    }
  }

  /**
   * Get contact statistics (admin)
   * @returns {Promise<Object>} Contact stats
   */
  static async getContactStats() {
    try {
      const stats = await MarketContact.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      const total = await MarketContact.countDocuments();

      const formattedStats = {
        total,
        new: 0,
        read: 0,
        replied: 0,
      };

      stats.forEach((stat) => {
        formattedStats[stat._id] = stat.count;
      });

      console.log(chalk.green('✓ Retrieved contact statistics'));

      return formattedStats;
    } catch (error) {
      console.error(chalk.red('✗ Failed to get contact statistics:'), error.message);
      throw error;
    }
  }
}

/**
 * Escape HTML special characters
 * @param {String} text - Text to escape
 * @returns {String} Escaped text
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

module.exports = ContactService;
