# Blog Feature - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

The blog feature is now fully integrated! Here's how to use it:

---

## 📝 Step 1: Create a Blog Post

### Option A: Simple Blog (Without Image)

```bash
curl -X POST http://localhost:5000/api/blog \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Blog Post",
    "excerpt": "A brief summary of the blog post",
    "content": "<p>Full blog content here...</p>",
    "author": "John Doe",
    "category": "Technology",
    "readTime": "5 min read",
    "status": "draft"
  }'
```

### Option B: Blog With Featured Image

**Step 1a: Upload Image**
```bash
curl -X POST http://localhost:5000/api/media/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/image.jpg"
```

**Response:**
```json
{
    "success": true,
    "data": {
        "url": "https://res.cloudinary.com/.../image.jpg",
        "publicId": "general_uploads/abc123"
    }
}
```

**Step 1b: Create Blog with Image**
```bash
curl -X POST http://localhost:5000/api/blog \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Blog Post",
    "excerpt": "A brief summary",
    "content": "<p>Full content...</p>",
    "author": "John Doe",
    "category": "Technology",
    "featuredImage": {
        "url": "https://res.cloudinary.com/.../image.jpg",
        "publicId": "general_uploads/abc123"
    },
    "status": "draft"
  }'
```

---

## 📋 Step 2: Manage Your Blog

### View All Blogs (Public)
```bash
curl "http://localhost:5000/api/blog?status=published&limit=10"
```

### View Single Blog
```bash
curl "http://localhost:5000/api/blog/post/{idOrSlug}"
```

### Filter by Category
```bash
curl "http://localhost:5000/api/blog/category/Technology"
```

### Get Latest Blogs
```bash
curl "http://localhost:5000/api/blog/latest?limit=5"
```

### Get Popular Blogs
```bash
curl "http://localhost:5000/api/blog/popular?limit=5"
```

---

## ✏️ Step 3: Update Your Blog

```bash
curl -X PUT http://localhost:5000/api/blog/{blogId} \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title",
    "excerpt": "Updated summary",
    "content": "<p>Updated content...</p>"
  }'
```

---

## 📤 Step 4: Publish Your Blog

```bash
curl -X PATCH http://localhost:5000/api/blog/{blogId}/publish \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"publish": true}'
```

To unpublish:
```bash
curl -X PATCH http://localhost:5000/api/blog/{blogId}/publish \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"publish": false}'
```

---

## 🗑️ Step 5: Delete a Blog

```bash
curl -X DELETE http://localhost:5000/api/blog/{blogId} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 Complete API Reference

### Public Endpoints (No Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/blog` | Get all published blogs |
| GET | `/api/blog/post/:idOrSlug` | Get single blog |
| GET | `/api/blog/category/:category` | Get blogs by category |
| GET | `/api/blog/latest` | Get latest blogs |
| GET | `/api/blog/popular` | Get popular blogs |
| GET | `/api/blog/categories/list` | Get all categories |

### Protected Endpoints (Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/blog` | Create blog |
| PUT | `/api/blog/:id` | Update blog |
| PATCH | `/api/blog/:id/publish` | Publish/unpublish |
| DELETE | `/api/blog/:id` | Delete blog |

---

## 🎯 Example Workflows

### Workflow 1: Create & Publish a Blog

```bash
# 1. Create blog (draft)
BLOG_ID=$(curl -X POST http://localhost:5000/api/blog \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Blog","excerpt":"Summary","content":"<p>Content</p>","author":"Author","category":"Tech","status":"draft"}' \
  | jq -r '.blog.id')

# 2. Update blog content
curl -X PUT http://localhost:5000/api/blog/$BLOG_ID \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"<p>Updated content</p>"}'

# 3. Publish blog
curl -X PATCH http://localhost:5000/api/blog/$BLOG_ID/publish \
  -H "Authorization: Bearer TOKEN" \
  -d '{"publish":true}'
```

### Workflow 2: Upload Image & Create Blog

```bash
# 1. Upload image
IMAGE_DATA=$(curl -X POST http://localhost:5000/api/media/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "image=@image.jpg")

URL=$(echo $IMAGE_DATA | jq -r '.data.url')
PUBLIC_ID=$(echo $IMAGE_DATA | jq -r '.data.publicId')

# 2. Create blog with image
curl -X POST http://localhost:5000/api/blog \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\":\"Blog Title\",
    \"excerpt\":\"Summary\",
    \"content\":\"<p>Content</p>\",
    \"author\":\"Author\",
    \"category\":\"Tech\",
    \"featuredImage\":{\"url\":\"$URL\",\"publicId\":\"$PUBLIC_ID\"}
  }"
```

---

## 🧪 Testing the API

### Using Postman

1. **Create Blog:**
   - Method: POST
   - URL: `http://localhost:5000/api/blog`
   - Headers: `Authorization: Bearer YOUR_TOKEN`
   - Body (JSON):
   ```json
   {
       "title": "Test Blog",
       "excerpt": "Test excerpt",
       "content": "<p>Test content</p>",
       "author": "Test Author",
       "category": "Test",
       "status": "draft"
   }
   ```

2. **Get All Blogs:**
   - Method: GET
   - URL: `http://localhost:5000/api/blog`

3. **Publish Blog:**
   - Method: PATCH
   - URL: `http://localhost:5000/api/blog/{blogId}/publish`
   - Body: `{"publish": true}`

---

## 📁 Blog Form Fields Reference

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| title | String | ✅ Yes | Blog post title |
| excerpt | String | ✅ Yes | Short summary |
| content | String | ✅ Yes | Full HTML content |
| author | String | ✅ Yes | Author name |
| category | String | ✅ Yes | Category name |
| featuredImage | Object | ❌ No | Image URL + publicId |
| readTime | String | ❌ No | e.g., "5 min read" |
| status | String | ❌ No | "draft" or "published" |
| seo | Object | ❌ No | Meta desc + keywords |

---

## 🎨 Using in Frontend

### React Example

```jsx
import axios from 'axios';

function CreateBlog() {
  const [blog, setBlog] = React.useState({
    title: '',
    excerpt: '',
    content: '',
    author: '',
    category: '',
    status: 'draft'
  });

  const handleCreate = async () => {
    try {
      const response = await axios.post('/api/blog', blog, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      alert('Blog created!');
    } catch (error) {
      alert('Failed: ' + error.message);
    }
  };

  return (
    <div>
      <input 
        placeholder="Title" 
        value={blog.title}
        onChange={(e) => setBlog({...blog, title: e.target.value})}
      />
      <textarea 
        placeholder="Excerpt"
        value={blog.excerpt}
        onChange={(e) => setBlog({...blog, excerpt: e.target.value})}
      />
      <textarea 
        placeholder="Content (HTML supported)"
        value={blog.content}
        onChange={(e) => setBlog({...blog, content: e.target.value})}
      />
      <input 
        placeholder="Author"
        value={blog.author}
        onChange={(e) => setBlog({...blog, author: e.target.value})}
      />
      <input 
        placeholder="Category"
        value={blog.category}
        onChange={(e) => setBlog({...blog, category: e.target.value})}
      />
      <button onClick={handleCreate}>Create Blog</button>
    </div>
  );
}
```

### Display Blogs

```jsx
function BlogList() {
  const [blogs, setBlog] = React.useState([]);

  React.useEffect(() => {
    axios.get('/api/blog?status=published')
      .then(res => setBlog(res.data.blogs));
  }, []);

  return (
    <div>
      {blogs.map(blog => (
        <article key={blog.id}>
          {blog.featuredImage?.url && (
            <img src={blog.featuredImage.url} alt={blog.title} />
          )}
          <h2>{blog.title}</h2>
          <p>{blog.excerpt}</p>
          <small>{blog.author} • {blog.readTime}</small>
        </article>
      ))}
    </div>
  );
}
```

---

## 🔍 Query Examples

### Search Blogs
```
/api/blog?search=marketing&status=published
```

### Filter by Category
```
/api/blog?category=Business&status=published&sort=-createdAt
```

### Pagination
```
/api/blog?page=2&limit=20
```

### Sorting
```
/api/blog?sort=-createdAt      # Newest first
/api/blog?sort=createdAt       # Oldest first
/api/blog?sort=-metadata.views # Most viewed
```

---

## ✅ Feature Checklist

- [x] Create blog posts
- [x] Edit blog posts
- [x] Delete blog posts
- [x] Publish/unpublish posts
- [x] Featured image support
- [x] Category filtering
- [x] Search functionality
- [x] View tracking
- [x] Auto-slug generation
- [x] Read time display
- [x] SEO fields
- [x] Pagination
- [x] Latest blogs endpoint
- [x] Popular blogs endpoint

---

## 🆘 Troubleshooting

**Error: "Missing required fields"**
- Make sure you're sending: title, excerpt, content, author, category

**Error: "Not authorized"**
- Check your auth token is valid
- Make sure you're the blog creator (for updates/deletes)

**Image not uploading?**
- Use `/api/media/upload` endpoint first
- Get the `url` and `publicId` from response
- Include in blog's `featuredImage` field

**Blog not appearing publicly?**
- Make sure status is "published" (not "draft")
- Check the publication date isn't in the future

---

## 🎓 Next Steps

1. ✅ Create your first blog post
2. ✅ Upload a featured image
3. ✅ Publish the blog
4. ✅ View it in the public blog list
5. Build the frontend UI

See **BLOG_FEATURE.md** for complete documentation!
