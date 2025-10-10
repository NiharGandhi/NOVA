# RAG System with OpenAI Embeddings & Supabase Storage - Setup Guide

## Overview

This implementation uses:
- **Supabase Storage** for storing PDF/DOCX files
- **OpenAI Embeddings** (text-embedding-3-small) for semantic search
- **Supabase pgvector** for vector similarity search
- **Proper source citations** with page numbers

## Setup Steps

### 1. Enable pgvector Extension

Go to Supabase Dashboard → SQL Editor and run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Create Storage Bucket

Go to Supabase Dashboard → Storage → Create Bucket:

- **Bucket name**: `course-materials`
- **Public**: ❌ No (Private)
- **File size limit**: 10MB
- **Allowed MIME types**:
  - `application/pdf`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - `text/plain`
  - `text/markdown`

### 3. Set Storage Policies

In Supabase Dashboard → Storage → course-materials → Policies:

```sql
-- Allow admins to upload files
CREATE POLICY "Admins can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-materials'
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Allow admins to read all files
CREATE POLICY "Admins can read all files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'course-materials'
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Allow admins to delete files
CREATE POLICY "Admins can delete files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-materials'
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);
```

### 4. Run Database Migration

Go to Supabase Dashboard → SQL Editor and run the migration:

```bash
# Or run the file: supabase/migrations/20240309000000_setup_pgvector_embeddings.sql
```

This will:
- Enable pgvector extension
- Add storage_path, file_size, mime_type columns to course_materials
- Create document_chunks table with vector embeddings
- Create indexes for fast similarity search
- Add RLS policies
- Create match_document_chunks() function for semantic search

### 5. Add OpenAI API Key

Add to your `.env.local`:

```env
OPENAI_API_KEY=sk-...your-openai-key...
```

### 6. Install OpenAI SDK

```bash
npm install openai
```

## How It Works

### 1. File Upload Flow

```mermaid
User uploads PDF →
  Store in Supabase Storage →
  Extract text & chunk it →
  Generate embeddings with OpenAI →
  Store chunks + embeddings in DB
```

**Code**: `app/api/course-materials/upload/route.ts`

### 2. Query Flow

```mermaid
User asks question →
  Generate query embedding →
  Vector search in DB →
  Find top 5 most similar chunks →
  Include in LLM context with sources →
  LLM cites sources in response
```

**Code**: `app/api/search-chunks/route.ts`

### 3. Database Schema

**course_materials** table:
```sql
- id: UUID
- chatbot_id: UUID (FK to chatbots)
- title: TEXT
- file_name: TEXT
- file_type: TEXT (pdf, docx, etc)
- storage_path: TEXT (path in Supabase Storage)
- file_size: BIGINT
- mime_type: TEXT
- order_index: INTEGER
- created_by: UUID
- created_at: TIMESTAMP
```

**document_chunks** table:
```sql
- id: UUID
- material_id: UUID (FK to course_materials)
- chunk_index: INTEGER
- chunk_text: TEXT
- page_number: INTEGER
- embedding: vector(1536)  ← OpenAI embeddings
- metadata: JSONB
- created_at: TIMESTAMP
```

## Using the RAG System

### 1. Upload Documents

Admin Dashboard → Course Materials → Select Chatbot → Upload File

The system will:
1. Upload file to Supabase Storage
2. Extract text (supports PDF, DOCX, TXT, MD)
3. Split into 1000-char chunks with 100-char overlap
4. Generate embeddings for each chunk (uses OpenAI)
5. Store in database with page numbers

### 2. Search for Relevant Chunks

```typescript
const response = await fetch('/api/search-chunks', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: "What is photosynthesis?",
    chatbot_id: "uuid-here",
    match_threshold: 0.78,  // Similarity threshold (0-1)
    match_count: 5          // Number of results
  })
});

const { matches } = await response.json();
// matches: [{ chunk_text, page_number, similarity, file_name, title }, ...]
```

### 3. Integrate with Chat

Update `app/api/getChat/route.ts` to:

1. Generate query embedding from user's question
2. Search for top 5 relevant chunks
3. Add chunks to system prompt with source info
4. Instruct LLM to cite sources as [Source 1], [Source 2], etc.

Example system prompt:
```typescript
const systemPrompt = `${chatbot.system_prompt}

Here are relevant course materials to help answer the question:

${matches.map((m, idx) => `
[Source ${idx + 1}: ${m.title}, Page ${m.page_number}]
${m.chunk_text}
`).join('\n\n')}

IMPORTANT: When answering, cite your sources using [Source X] notation.
Example: "According to [Source 1], photosynthesis is the process..."
`;
```

## Benefits Over Previous Approach

### Before (Simple RAG):
- ❌ Used ALL chunks (no relevance filtering)
- ❌ Limited to first 10 chunks arbitrarily
- ❌ No semantic understanding
- ❌ Stored full content in database

### Now (Vector RAG):
- ✅ Uses only RELEVANT chunks (semantic search)
- ✅ Finds top 5 most similar to user's question
- ✅ Understands meaning, not just keywords
- ✅ Files stored efficiently in Storage
- ✅ Accurate source citations with page numbers
- ✅ Scales to thousands of documents

## Cost Considerations

### OpenAI Embeddings Pricing
- **Model**: text-embedding-3-small
- **Cost**: $0.02 per 1M tokens
- **Example**: 100-page PDF ≈ 50,000 tokens ≈ $0.001

### Query Costs
- Each user question generates 1 embedding
- Typical question: 10-50 tokens ≈ $0.000001

### Storage Costs
- Supabase Storage: Included in free tier (1GB)
- Database: Vector embeddings use ~6KB per chunk

## Testing

### 1. Upload a Test PDF

```bash
# Use the Admin Dashboard UI to upload a PDF
# Or use curl:
curl -X POST http://localhost:3000/api/course-materials/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.pdf" \
  -F "chatbot_id=YOUR_CHATBOT_ID" \
  -F "title=Test Document"
```

### 2. Search for Content

```bash
curl -X POST http://localhost:3000/api/search-chunks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the main topic?",
    "chatbot_id": "YOUR_CHATBOT_ID",
    "match_count": 5
  }'
```

### 3. Check Database

```sql
-- View uploaded materials
SELECT id, title, file_name, storage_path, file_size
FROM course_materials;

-- View chunks
SELECT
  dc.chunk_index,
  dc.page_number,
  LEFT(dc.chunk_text, 100) as preview,
  cm.title
FROM document_chunks dc
JOIN course_materials cm ON dc.material_id = cm.id;

-- Test similarity search
SELECT * FROM match_document_chunks(
  query_embedding := (SELECT embedding FROM document_chunks LIMIT 1),
  match_threshold := 0.5,
  match_count := 5
);
```

## Troubleshooting

### "Extension vector does not exist"
- Run: `CREATE EXTENSION vector;` in SQL Editor

### "Bucket does not exist"
- Create `course-materials` bucket in Storage

### "OpenAI API error"
- Check OPENAI_API_KEY in .env.local
- Verify OpenAI account has credits

### "Error storing chunks"
- Check migration was run successfully
- Verify document_chunks table exists
- Check embedding dimension is 1536

### Slow upload
- Normal for large PDFs (embedding generation takes time)
- Consider implementing queue/background jobs for production

## Next Steps

1. ✅ Run migration to set up pgvector
2. ✅ Create Storage bucket
3. ✅ Add OPENAI_API_KEY to env
4. 🔄 Update chat API to use semantic search
5. 🔄 Add source citations to chat UI
6. 🔄 Test with real documents

## Files Modified/Created

- ✅ `supabase/migrations/20240309000000_setup_pgvector_embeddings.sql`
- ✅ `utils/embeddings.ts`
- ✅ `app/api/course-materials/upload/route.ts`
- ✅ `app/api/search-chunks/route.ts`
- 🔄 `app/api/getChat/route.ts` (needs update)
- 🔄 `app/page.tsx` (needs update for citations)

