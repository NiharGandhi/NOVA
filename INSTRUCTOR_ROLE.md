# Instructor Role Implementation

This document describes the new Instructor role feature added to NOVA.

## Overview

The Instructor role allows designated users to:
- View analytics for courses they're assigned to
- Edit course settings and configuration
- Upload and manage course materials
- See detailed insights about student queries and difficulties
- Get recommendations for improving course materials
- Track engagement metrics

## Database Changes

### Migration: `20240314000000_add_instructor_role.sql`

1. **Updated `users` table**: Added 'instructor' as a valid role
2. **Created `course_instructors` table**: Junction table linking instructors to courses
   - `chatbot_id`: Course they're assigned to
   - `instructor_id`: The instructor user
   - `assigned_by`: Admin who made the assignment
   - `assigned_at`: Timestamp

3. **Row Level Security Policies**:
   - Instructors can view and update their assigned courses
   - Instructors can manage course materials (view, insert, update, delete)
   - Instructors can view chat sessions and messages for their courses
   - Only admins can manage instructor assignments

## API Endpoints

### `/api/instructors` (GET, POST, DELETE)

**GET**:
- Without `chatbot_id`: Returns all users with instructor role
- With `chatbot_id`: Returns instructors assigned to that course

**POST**: Assign an instructor to a course
```json
{
  "chatbot_id": "uuid",
  "instructor_id": "uuid",
  "action": "assign"
}
```

**DELETE**: Remove instructor from course
- Query param: `assignment_id`

### `/api/analytics/course` (GET)

**GET**: Returns comprehensive analytics for a course
- Query param: `chatbot_id` (required)
- Returns:
  - Total sessions, messages, unique students
  - Top discussed topics
  - Difficult topics (repeated queries)
  - Common questions
  - AI-generated insights and recommendations

**Access**: Admin and assigned instructors only

### `/api/document-chunks` (GET, DELETE)

**GET**: Fetch document chunks with embeddings
- Query params: `chatbot_id` OR `material_id`
- Returns array of chunks with:
  - Chunk text, index, page number
  - Embedding status
  - Material metadata
  - Created timestamp

**DELETE**: Remove chunks
- Query params: `chunk_id` OR `material_id`
- Deletes single chunk or all chunks for a material

**Access**: Admin and assigned instructors only

### `/api/storage/download` (GET)

**GET**: Download files from storage bucket
- Query params: `material_id` OR `path`
- Returns file blob with appropriate content-type
- Supports inline viewing and download
- Verifies instructor assignment for private files

**Access**: Admin and assigned instructors only

## Components

### `AdminDashboard` (Updated)
- New "Instructors" tab
- Assign instructors to courses
- View all instructors
- Remove instructor assignments

### `InstructorDashboard` (New)
- **Course Analytics Tab**:
  - Overview metrics (sessions, messages, students)
  - Visual charts for topic frequency
  - Highlighted difficult topics with recommendations
  - FAQ section with repeated questions
  - Time-range display

- **Course Settings Tab**:
  - Edit course name, subject, description
  - Modify system prompt for AI tutor
  - Toggle web search usage
  - Toggle course materials usage

- **Course Materials Tab**:
  - **View/Download Files**: View actual files from storage or download them
  - **File Preview Modal**: In-browser preview for PDFs, images, and text files
  - View all uploaded course materials
  - See material details (title, filename, type, size, storage path)
  - View document chunks for each material
  - See chunk content, encoding status, and metadata
  - Encoding summary with statistics
  - Delete materials and associated chunks
  - Expandable chunk viewer for detailed inspection

### `Header` (Updated)
- Shows "Instructor Dashboard" link for instructor role
- Shows "Admin Dashboard" link for admin role

## Pages

### `/instructor` (New)
- Protected route (instructors and admins only)
- Displays InstructorDashboard component
- Auto-redirects non-instructors to home

### `/` (Updated)
- Redirects instructors to `/instructor` automatically
- Students see course tiles as before
- Admins see admin interface

## Analytics Features

### Topics Analysis
- Extracts keywords from student queries
- Identifies most discussed topics
- Shows frequency distribution

### Difficulty Detection
- Identifies topics appearing in multiple sessions
- Marks as "difficult" if 3+ students ask about it
- Provides recommendations for improvement

### Question Analysis
- Detects questions (? or question words)
- Finds repeated questions
- Suggests adding to FAQ

### Insights Generation
- Engagement metrics (sessions per student)
- Low/high engagement warnings
- Recommendations for supplementary materials
- Conversation length analysis

## How to Use

### For Admins:

1. **Create Instructor**: Manually change a user's role to 'instructor' in Supabase
2. **Assign to Course**:
   - Go to Admin Dashboard → Instructors tab
   - Select a course
   - Choose instructor from dropdown
   - Click "Assign"
3. **View Analytics**: Instructors automatically get access to their courses

### For Instructors:

1. Login with instructor account
2. Automatically redirected to `/instructor`
3. Select course from dropdown
4. **View Analytics** (Analytics tab):
   - Overview stats
   - Key insights
   - Difficult topics
   - Most discussed topics
   - Frequently asked questions
5. **Edit Course** (Course Settings tab):
   - Update course name, subject, description
   - Modify AI tutor instructions (system prompt)
   - Configure search and materials settings
6. **Manage Materials** (Course Materials tab):
   - **View actual files**: Click "👁️ View" to see file in browser
   - **Download files**: Click "⬇️ Download" to save locally
   - View document chunks and encoding status
   - Review chunk content that AI uses
   - Delete outdated materials
7. Use analytics insights to improve teaching materials

## Database Migration

To apply the migration:

```bash
# Using Supabase CLI
supabase db push

# Or manually run the SQL in Supabase dashboard
```

## Environment Variables

No new environment variables required. Uses existing:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (for admin operations)

## Instructor Capabilities Summary

| Feature | View | Edit | Delete | Download | Upload |
|---------|------|------|--------|----------|--------|
| Assigned Courses | ✅ | ✅ | ❌ | ❌ | ❌ |
| Course Materials | ✅ | ✅ | ✅ | ✅ | ✅ |
| Storage Files | ✅ | ❌ | ❌ | ✅ | ❌ |
| Document Chunks | ✅ | ❌ | ✅ | ❌ | ❌ |
| Student Analytics | ✅ | ❌ | ❌ | ❌ | ❌ |
| Chat History | ✅ | ❌ | ❌ | ❌ | ❌ |
| Instructor Assignments | ✅ (own only) | ❌ | ❌ | ❌ | ❌ |

**Admins have full access to all features including creating courses, assigning instructors, and deleting resources.**

## File Viewing & Download

Instructors can now view and download actual files from storage:

### **Supported File Formats**

| Format | View in Browser | Download |
|--------|----------------|----------|
| PDF | ✅ (iframe viewer) | ✅ |
| Images (PNG, JPG, etc) | ✅ (image preview) | ✅ |
| Text/Markdown | ✅ (iframe viewer) | ✅ |
| Word/Excel/Other | ❌ (download only) | ✅ |

### **File Viewer Modal**

- **Large modal** (6xl width, 90vh height)
- **PDF viewer**: Full-page embedded viewer
- **Image viewer**: Centered with auto-sizing
- **Text viewer**: Embedded text display
- **Fallback**: Download button for unsupported formats
- **Close button**: Cleans up blob URLs

### **Security**

- Files fetched via API with authentication
- Instructor assignment verified before access
- Blob URLs created client-side for viewing
- URLs automatically revoked on close

## Future Enhancements

Potential improvements:
1. Bulk upload interface for course materials in instructor dashboard
2. Export analytics reports to PDF
3. Email notifications for difficult topics
4. Student performance tracking
5. Comparative analytics across time periods
6. AI-powered teaching recommendations
7. Direct messaging with students
8. Assignment creation and tracking
9. Grade analytics integration
10. Batch edit multiple courses
11. In-browser document editing
12. Version history for materials
