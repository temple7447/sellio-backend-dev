# Blog Feature - Complete Implementation Guide

## 📝 Overview

A comprehensive blog management system integrated with the marketplace. Features include:
- Create, read, update, delete blog posts
- Publish/draft functionality
- Category management
- SEO optimization
- View tracking
- Featured image upload support

---

## 🏗️ Model Structure

### Blog Post Fields

```javascript
{
    title: String (required),              // Blog post title
    slug: String (unique),                 // Auto-generated URL slug
    excerpt: String (required),            // Short summary
    content: String (required),            // Full HTML content
    author: String (required),             // Author name
    category: String (required),           // Category name
    featuredImage: {
        url: String,                       // Image URL from Cloudinary
        publicId: String                   // Cloudinary public ID
    },
    readTime: String,                      // Estimated read time
    status: String (enum: 'draft'/'published'),
    publishedAt: Date,                     // Publication timestamp
    metadata: {
        views: Number (default: 0),        // View count
        likes: Number (default: 0)         // Like count
    },
    seo: {
        metaDescription: String,           // SEO meta description
        keywords: [String]                 // SEO keywords
    },
    createdBy: ObjectId (ref: 'MarketUser'),
    timestamps: true                       // createdAt, updatedAt
}
```

---

## 📋 API Endpoints

### Public Endpoints (No Authentication)

#### Get All Published Blogs
```
GET /api/blog?status=published&page=1&limit=10&sort=-createdAt&search=term&category=tech
```

**Query Parameters:**
- `status` - Filter by status (published/draft) - default: 'published'
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `sort` - Sort field (default: -createdAt)
- `search` - Search in title, excerpt, content, author
- `category` - Filter by category

**Response:**
```json
{
    "blogs": [
        {
            "id": "507f1f77bcf86cd799439011",
            "title": "How to Start Your Business",
            "slug": "how-to-start-your-business",
            "excerpt": "A complete guide...",
            "content": "<p>Full HTML content...</p>",
            "author": "John Doe",
            "category": "Business",
            "featuredImage": {
                "url": "https://res.cloudinary.com/.../blog.jpg",
                "publicId": "blog/abc123"
            },
            "readTime": "8 min read",
            "status": "published",
            "publishedAt": "2026-03-20T10:30:00Z",
            "metadata": {
                "views": 156,
                "likes": 23
            },
            "createdAt": "2026-03-15T10:30:00Z",
            "updatedAt": "2026-03-20T10:30:00Z",
            "createdBy": {
                "id": "507f1f77bcf86cd799439001",
                "fullName": "John Doe",
                "email": "john@example.com"
            }
        }
    ],
    "pagination": {
        "total": 45,
        "pages": 5,
        "currentPage": 1,
        "limit": 10
    }
}
```

#### Get Single Blog Post
```
GET /api/blog/post/{idOrSlug}
```

**Parameters:**
- `idOrSlug` - MongoDB ID or URL slug

**Example:**
```
GET /api/blog/post/507f1f77bcf86cd799439011
GET /api/blog/post/how-to-start-your-business
```

#### Get Blogs by Category
```
GET /api/blog/category/{category}?page=1&limit=10
```

**Example:**
```
GET /api/blog/category/Business?page=1&limit=10
```

#### Get Latest Blogs
```
GET /api/blog/latest?limit=5
```

#### Get Popular Blogs (By Views)
```
GET /api/blog/popular?limit=5
```

#### Get All Blog Categories
```
GET /api/blog/categories/list
```

**Response:**
```json
{
    "categories": [
        "Business",
        "Technology",
        "Marketing",
        "SEO"
    ]
}
```

---

### Authenticated Endpoints

#### Create New Blog Post
```
POST /api/blog
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
    "title": "My First Blog Post",
    "excerpt": "This is a brief summary",
    "content": "<p>Full HTML content here...</p>",
    "author": "John Doe",
    "category": "Technology",
    "readTime": "5 min read",
    "status": "draft",
    "featuredImage": {
        "url": "https://res.cloudinary.com/.../image.jpg",
        "publicId": "blog/image123"
    },
    "seo": {
        "metaDescription": "Short description for SEO",
        "keywords": ["blog", "technology", "guide"]
    }
}
```

**Response:** 201 Created

#### Update Blog Post
```
PUT /api/blog/{id}
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
    "title": "Updated Title",
    "excerpt": "Updated summary",
    "content": "<p>Updated content...</p>",
    "category": "Business",
    "status": "published"
}
```

#### Publish/Unpublish Blog
```
PATCH /api/blog/{id}/publish
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
    "publish": true  // or false to unpublish
}
```

#### Delete Blog Post
```
DELETE /api/blog/{id}
Authorization: Bearer YOUR_TOKEN
```

---

## 🖼️ Upload Featured Image

Use the existing media upload endpoint:

```
POST /api/media/upload
Authorization: Bearer YOUR_TOKEN
Content-Type: multipart/form-data

Form Data:
  image: <image file>
```

**Response:**
```json
{
    "success": true,
    "message": "Image uploaded successfully",
    "data": {
        "url": "https://res.cloudinary.com/.../image.jpg",
        "publicId": "general_uploads/image123"
    }
}
```

Then use the `url` and `publicId` in the blog creation/update request:
```json
{
    "title": "Blog Title",
    "featuredImage": {
        "url": "https://res.cloudinary.com/.../image.jpg",
        "publicId": "general_uploads/image123"
    }
}
```

---

## 📚 Usage Examples

### Example 1: Create a Blog Post

**Step 1: Upload Featured Image**
```bash
curl -X POST http://localhost:5000/api/media/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/image.jpg"
```

Response:
```json
{
    "url": "https://res.cloudinary.com/.../abc123.jpg",
    "publicId": "general_uploads/abc123"
}
```

**Step 2: Create Blog Post**
```bash
curl -X POST http://localhost:5000/api/blog \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "How to Grow Your Business",
    "excerpt": "Learn 10 proven strategies to scale your business",
    "content": "<p>Full article content with HTML...</p>",
    "author": "Jane Smith",
    "category": "Business",
    "readTime": "8 min read",
    "featuredImage": {
        "url": "https://res.cloudinary.com/.../abc123.jpg",
        "publicId": "general_uploads/abc123"
    },
    "seo": {
        "metaDescription": "10 proven strategies to grow your business",
        "keywords": ["business", "growth", "strategy"]
    },
    "status": "draft"
  }'
```

### Example 2: Publish a Blog Post
```bash
curl -X PATCH http://localhost:5000/api/blog/507f1f77bcf86cd799439011/publish \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"publish": true}'
```

### Example 3: Search Blogs
```bash
curl "http://localhost:5000/api/blog?search=marketing&category=Business&status=published&limit=20"
```

### Example 4: Get Latest Blogs
```bash
curl "http://localhost:5000/api/blog/latest?limit=5"
```

---

## 🧪 Test The Blog Feature

Create a test file `tests/test-blog-feature.js`:

```javascript
const axios = require('axios');
const chalk = require('chalk');

const API_URL = 'http://localhost:5000/api';
const TOKEN = 'YOUR_AUTH_TOKEN';

async function testBlogFeature() {
    console.log(chalk.cyan('\n📝 Testing Blog Feature...\n'));

    try {
        // 1. Create a blog post
        console.log(chalk.blue('1. Creating blog post...'));
        const createResponse = await axios.post(`${API_URL}/blog`, {
            title: "Getting Started with Marketplace",
            excerpt: "Everything you need to know",
            content: "<p>Full content here...</p>",
            author: "Test Author",
            category: "Guides",
            readTime: "5 min read",
            status: "draft"
        }, {
            headers: { Authorization: `Bearer ${TOKEN}` }
        });
        const blogId = createResponse.data.blog.id;
        console.log(chalk.green(`✓ Blog created: ${blogId}\n`));

        // 2. Get all blogs
        console.log(chalk.blue('2. Fetching all blogs...'));
        const allBlogs = await axios.get(`${API_URL}/blog?status=published&limit=5`);
        console.log(chalk.green(`✓ Found ${allBlogs.data.pagination.total} blogs\n`));

        // 3. Get latest blogs
        console.log(chalk.blue('3. Fetching latest blogs...'));
        const latest = await axios.get(`${API_URL}/blog/latest?limit=3`);
        console.log(chalk.green(`✓ Found ${latest.data.blogs.length} latest blogs\n`));

        // 4. Publish blog
        console.log(chalk.blue('4. Publishing blog...'));
        const published = await axios.patch(`${API_URL}/blog/${blogId}/publish`, 
            { publish: true },
            { headers: { Authorization: `Bearer ${TOKEN}` } }
        );
        console.log(chalk.green(`✓ Blog published\n`));

        // 5. Get single blog
        console.log(chalk.blue('5. Fetching single blog...'));
        const single = await axios.get(`${API_URL}/blog/post/${blogId}`);
        console.log(chalk.green(`✓ Blog fetched. Views: ${single.data.metadata.views}\n`));

        console.log(chalk.green('\n✅ All blog tests passed!\n'));

    } catch (error) {
        console.error(chalk.red('❌ Test failed:'), error.response?.data || error.message);
    }
}

testBlogFeature();
```

Run with:
```bash
node tests/test-blog-feature.js
```

---

## 🎨 Frontend Implementation

### Blog Form Component
```jsx
import React, { useState } from 'react';
import axios from 'axios';

function BlogForm() {
    const [formData, setFormData] = useState({
        title: '',
        excerpt: '',
        content: '',
        author: '',
        category: '',
        readTime: '5 min read',
        status: 'draft'
    });
    const [featuredImage, setFeaturedImage] = useState(null);

    // Upload featured image
    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await axios.post('/api/media/upload', formData, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            setFeaturedImage(response.data.data);
        } catch (error) {
            alert('Image upload failed');
        }
    };

    // Create blog post
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const blogData = {
                ...formData,
                featuredImage: featuredImage
            };
            await axios.post('/api/blog', blogData, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            alert('Blog created successfully!');
        } catch (error) {
            alert('Failed to create blog');
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <input
                type="text"
                placeholder="Blog Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
            />

            <textarea
                placeholder="Brief summary"
                value={formData.excerpt}
                onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                required
            />

            <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
            />
            {featuredImage && <img src={featuredImage.url} alt="Featured" />}

            <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
            >
                <option value="">Select category</option>
                <option value="Business">Business</option>
                <option value="Technology">Technology</option>
                <option value="Marketing">Marketing</option>
            </select>

            <input
                type="text"
                placeholder="Author name"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                required
            />

            <input
                type="text"
                placeholder="5 min read"
                value={formData.readTime}
                onChange={(e) => setFormData({ ...formData, readTime: e.target.value })}
            />

            <textarea
                placeholder="Write blog content (Supports HTML)"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                required
            />

            <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
            </select>

            <button type="submit">Create Blog Post</button>
        </form>
    );
}

export default BlogForm;
```

### Blog List Component
```jsx
function BlogList() {
    const [blogs, setBlogs] = useState([]);

    useEffect(() => {
        fetchBlogs();
    }, []);

    const fetchBlogs = async () => {
        try {
            const response = await axios.get('/api/blog?status=published&limit=20');
            setBlogs(response.data.blogs);
        } catch (error) {
            console.error('Failed to fetch blogs');
        }
    };

    return (
        <div className="blog-list">
            {blogs.map(blog => (
                <article key={blog.id} className="blog-card">
                    {blog.featuredImage?.url && (
                        <img src={blog.featuredImage.url} alt={blog.title} />
                    )}
                    <h2>{blog.title}</h2>
                    <p>{blog.excerpt}</p>
                    <div className="meta">
                        <span>{blog.author}</span>
                        <span>{blog.readTime}</span>
                        <span>{blog.metadata.views} views</span>
                    </div>
                    <a href={`/blog/${blog.slug}`}>Read More</a>
                </article>
            ))}
        </div>
    );
}
```

---

## 🔒 Authorization & Security

- **Create Blog:** Must be authenticated
- **Update Blog:** Only creator or admin can update
- **Delete Blog:** Only creator or admin can delete
- **Publish Blog:** Only creator or admin can publish
- **View Blogs:** Public (draft blogs hidden from public view)

---

## 📊 Features

| Feature | Status | Details |
|---------|--------|---------|
| Create Blog | ✅ | Full CRUD operations |
| Edit Blog | ✅ | Update by creator |
| Delete Blog | ✅ | Soft delete available |
| Publish/Draft | ✅ | Status management |
| Featured Image | ✅ | Cloudinary integration |
| Category Management | ✅ | Filter by category |
| Search | ✅ | Search title, excerpt, content |
| Read Time | ✅ | Auto-calculated |
| SEO Fields | ✅ | Meta description + keywords |
| View Tracking | ✅ | Count views per post |
| Slug Generation | ✅ | Auto-generated from title |

---

## 🚀 Next Steps

1. Create blog listing page with categories
2. Implement blog detail page with sidebars
3. Add comment system to blogs
4. Implement blog search with Elasticsearch
5. Add blog analytics dashboard
6. Create admin blog management panel
7. Implement scheduled publishing
8. Add blog tags in addition to categories

---

## 📁 Files Created/Modified

**New Files:**
- ✅ `src/models/MarketBlog.js` - Blog model
- ✅ `src/services/blog.service.js` - Blog business logic
- ✅ `src/controllers/blog.controller.js` - Route handlers
- ✅ `src/routes/blog.routes.js` - API routes

**Modified Files:**
- ✅ `src/index.js` - Registered blog routes

---

## ✅ Ready to Use!

The blog feature is fully functional and ready for integration with your frontend. Start by uploading images with the media endpoint, then create blog posts!
