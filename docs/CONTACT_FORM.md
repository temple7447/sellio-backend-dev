# Contact Form Feature

The contact form feature allows customers and users to send messages directly to the company at `selliomarketplaces@gmail.com`. The system automatically:

✅ Stores all messages in the database
✅ Sends confirmation email to the user
✅ Notifies the company immediately
✅ Tracks message status (new/read/replied)
✅ Provides admin panel for managing inquiries

---

## 📝 Form Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | String | ✅ Yes | User's full name |
| email | String | ✅ Yes | Valid email address |
| subject | String | ✅ Yes | Message subject (max 100 chars) |
| message | String | ✅ Yes | Full message (10-5000 chars) |

---

## 🚀 How It Works

### 1. User Submits Form
```bash
curl -X POST http://localhost:5000/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Question about products",
    "message": "I have a question about shipping costs for international orders."
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Message sent successfully! We will get back to you soon.",
  "contact": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Question about products"
  }
}
```

### 2. System Sends Two Emails

**Email 1: Confirmation to User**
- Subject: "We Received Your Message - Sellio Marketplace Support"
- Content: Acknowledges receipt, provides reference ID, expected response time
- Includes: Message subject, reference ID, submission timestamp

**Email 2: Alert to Company**
- Recipient: `selliomarketplaces@gmail.com`
- Subject: "New Contact Form Submission: {subject}"
- Content: Full message details, sender info, admin link
- Includes: Reply-to sender's email, message ID, link to admin panel

### 3. Admin Reviews Message
```bash
# Get all unread messages
curl "http://localhost:5000/api/contact/admin/all?status=new" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# View specific message
curl "http://localhost:5000/api/contact/admin/{messageId}" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Reply to message (mark as replied)
curl -X PUT "http://localhost:5000/api/contact/admin/{messageId}" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "replied",
    "adminNotes": "Sent pricing information to customer via email"
  }'
```

---

## 📋 API Endpoints

### Public Endpoints

#### Create Contact Message
```http
POST /api/contact
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Subject line",
  "message": "Full message content"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Message sent successfully! We will get back to you soon.",
  "contact": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Subject line"
  }
}
```

---

### Admin Endpoints

#### Get All Contact Messages
```http
GET /api/contact/admin/all?page=1&limit=10&status=new&search=query&sortBy=-createdAt
Authorization: Bearer ADMIN_TOKEN
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 10)
- `status` (string): Filter by status - `new`, `read`, `replied`
- `search` (string): Search in name, email, subject, message
- `sortBy` (string): Sort field (default: `-createdAt`)

**Response (200):**
```json
{
  "success": true,
  "contacts": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "subject": "Question about products",
      "message": "I have a question about...",
      "status": "new",
      "createdAt": "2026-03-22T10:30:00Z",
      "readAt": null,
      "repliedAt": null,
      "adminNotes": null
    }
  ],
  "pagination": {
    "total": 45,
    "pages": 5,
    "currentPage": 1,
    "pageSize": 10
  }
}
```

---

#### Get Single Contact Message
```http
GET /api/contact/admin/{contactId}
Authorization: Bearer ADMIN_TOKEN
```

**Response (200):**
```json
{
  "success": true,
  "contact": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Question about products",
    "message": "I have a question about shipping costs...",
    "status": "new",
    "createdAt": "2026-03-22T10:30:00Z",
    "readAt": null,
    "repliedAt": null,
    "adminNotes": null,
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  }
}
```

**Note:** Automatically marks message as "read" and sets `readAt` timestamp

---

#### Update Contact Message
```http
PUT /api/contact/admin/{contactId}
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "status": "replied",
  "adminNotes": "Customer follow-up sent via email"
}
```

**Valid Status Values:** `new`, `read`, `replied`

**Response (200):**
```json
{
  "success": true,
  "message": "Contact message updated successfully",
  "contact": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Question about products",
    "message": "...",
    "status": "replied",
    "repliedAt": "2026-03-22T11:45:00Z",
    "adminNotes": "Customer follow-up sent via email"
  }
}
```

---

#### Delete Contact Message
```http
DELETE /api/contact/admin/{contactId}
Authorization: Bearer ADMIN_TOKEN
```

**Response (200):**
```json
{
  "success": true,
  "message": "Contact message deleted successfully",
  "contact": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Question about products",
    "status": "new"
  }
}
```

---

#### Get Contact Statistics
```http
GET /api/contact/admin/stats/overview
Authorization: Bearer ADMIN_TOKEN
```

**Response (200):**
```json
{
  "success": true,
  "stats": {
    "total": 45,
    "new": 12,
    "read": 28,
    "replied": 5
  }
}
```

---

## 🎨 Frontend Implementation

### React Component Example

```jsx
import React, { useState } from 'react';
import axios from 'axios';

function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await axios.post('/api/contact', formData);
      
      if (response.data.success) {
        setSuccess(true);
        setFormData({ name: '', email: '', subject: '', message: '' });
        
        // Show success message for 5 seconds
        setTimeout(() => setSuccess(false), 5000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="contact-form">
      <div className="form-group">
        <label htmlFor="name">Name *</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Your name"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="email">Email *</label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Your email"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="subject">Subject *</label>
        <input
          type="text"
          id="subject"
          name="subject"
          value={formData.subject}
          onChange={handleChange}
          placeholder="How can we help you?"
          maxLength="100"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="message">Message *</label>
        <textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          placeholder="Your message"
          rows="6"
          minLength="10"
          maxLength="5000"
          required
        />
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">Message sent successfully!</div>}

      <button type="submit" disabled={loading} className="submit-btn">
        {loading ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  );
}

export default ContactForm;
```

### Admin Dashboard Component

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function ContactAdmin() {
  const [contacts, setContacts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const token = localStorage.getItem('adminToken');

  useEffect(() => {
    fetchStats();
    fetchContacts();
  }, [filter]);

  const fetchStats = async () => {
    try {
      const response = await axios.get(
        '/api/contact/admin/stats/overview',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const params = filter === 'all' ? {} : { status: filter };
      const response = await axios.get(
        '/api/contact/admin/all',
        {
          headers: { Authorization: `Bearer ${token}` },
          params
        }
      );
      setContacts(response.data.contacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsReplied = async (contactId) => {
    try {
      await axios.put(
        `/api/contact/admin/${contactId}`,
        { status: 'replied' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchContacts();
    } catch (error) {
      console.error('Error updating contact:', error);
    }
  };

  const deleteContact = async (contactId) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      try {
        await axios.delete(
          `/api/contact/admin/${contactId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        fetchContacts();
      } catch (error) {
        console.error('Error deleting contact:', error);
      }
    }
  };

  return (
    <div className="contact-admin">
      <h2>Contact Management</h2>

      {stats && (
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Messages</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.new}</div>
            <div className="stat-label">New</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.read}</div>
            <div className="stat-label">Read</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.replied}</div>
            <div className="stat-label">Replied</div>
          </div>
        </div>
      )}

      <div className="filters">
        <button
          onClick={() => setFilter('all')}
          className={filter === 'all' ? 'active' : ''}
        >
          All
        </button>
        <button
          onClick={() => setFilter('new')}
          className={filter === 'new' ? 'active' : ''}
        >
          New
        </button>
        <button
          onClick={() => setFilter('read')}
          className={filter === 'read' ? 'active' : ''}
        >
          Read
        </button>
        <button
          onClick={() => setFilter('replied')}
          className={filter === 'replied' ? 'active' : ''}
        >
          Replied
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="contacts-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map(contact => (
              <tr key={contact._id}>
                <td>{contact.name}</td>
                <td>{contact.email}</td>
                <td>{contact.subject}</td>
                <td>
                  <span className={`status-badge status-${contact.status}`}>
                    {contact.status.charAt(0).toUpperCase() + contact.status.slice(1)}
                  </span>
                </td>
                <td>{new Date(contact.createdAt).toLocaleDateString()}</td>
                <td>
                  <button onClick={() => markAsReplied(contact._id)}>
                    Mark Replied
                  </button>
                  <button onClick={() => deleteContact(contact._id)} className="btn-danger">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default ContactAdmin;
```

---

## ✅ Testing with cURL

### Test 1: Submit Contact Form
```bash
curl -X POST http://localhost:5000/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "subject": "Bulk order inquiry",
    "message": "Hi, I am interested in ordering multiple items for my store. Can you provide bulk pricing?"
  }'
```

### Test 2: Get All New Messages (Admin)
```bash
curl "http://localhost:5000/api/contact/admin/all?status=new" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Test 3: Get Stats
```bash
curl "http://localhost:5000/api/contact/admin/stats/overview" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Test 4: Mark as Replied
```bash
curl -X PUT "http://localhost:5000/api/contact/admin/{contactId}" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "replied",
    "adminNotes": "Sent bulk pricing sheet via email"
  }'
```

---

## 📧 Email Configuration

The system uses **Mailtrap** for sending emails. Make sure your `.env` file contains:

```env
MAILTRAP_TOKEN=your_token_here
MAILTRAP_SENDER_EMAIL=hello@demomailtrap.co
MAILTRAP_SENDER_NAME=Sellio Marketplace
```

See [MAILTRAP_SETUP.md](./MAILTRAP_SETUP.md) for detailed setup instructions.

---

## 🎯 Feature Summary

| Feature | Status |
|---------|--------|
| Public contact form submission | ✅ Complete |
| Email confirmation to user | ✅ Complete |
| Email notification to company | ✅ Complete |
| Message storage in database | ✅ Complete |
| Admin message retrieval | ✅ Complete |
| Admin message status tracking | ✅ Complete |
| Search & filter messages | ✅ Complete |
| Statistics dashboard | ✅ Complete |
| IP & user agent logging | ✅ Complete |
| Message pagination | ✅ Complete |

---

## 🎓 Next Steps

1. ✅ Test the API endpoints with the curl examples above
2. ✅ Integrate the React contact form component into your website
3. ✅ Build the admin dashboard to manage messages
4. ✅ Customize email templates as needed
5. ✅ Monitor your inbox at `selliomarketplaces@gmail.com`

All set! Your contact form is ready to use! 🎉
