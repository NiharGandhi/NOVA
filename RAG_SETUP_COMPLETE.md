# RAG System Setup - Complete ✅

## What's Been Implemented

### ✅ 1. PDF & Document Processing
- Installed `pdf-parse` and `mammoth` libraries
- Created `utils/documentProcessor.ts` with:
  - PDF parsing with page number tracking
  - DOCX (Word document) parsing
  - TXT and MD file support
  - Smart text chunking (1000 chars with 200 char overlap)
  - Automatic sanitization of invalid characters

### ✅ 2. Database Schema
- Created migration `20240308000000_add_document_chunks.sql`
- Added `chunks` JSONB column to `course_materials` table
- Chunks stored with metadata (text, index, page number)

### ✅ 3. File Upload API
- Created `/api/course-materials/upload` endpoint
- Supports multipart form-data file uploads
- Processes files server-side
- Stores processed chunks in database
- Returns chunk count and page count

### ✅ 4. Admin Dashboard Updates
- Updated file upload UI to support PDF, DOCX, TXT, MD
- Automatic file processing on upload
- Shows success message with chunk count
- Clears form after successful upload

## How to Use

### 1. Apply Database Migration

Go to your Supabase Dashboard → SQL Editor and run:

```sql
-- Add chunks column to course_materials for storing parsed document chunks
ALTER TABLE course_materials
ADD COLUMN IF NOT EXISTS chunks JSONB DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN course_materials.chunks IS 'Stores document chunks with metadata for RAG retrieval';

-- Create index for better query performance on chunks
CREATE INDEX IF NOT EXISTS idx_course_materials_chunks ON course_materials USING GIN (chunks);
```

### 2. Upload Documents

1. Go to Admin Dashboard → Course Materials tab
2. Select your chatbot
3. Click "Upload a file" or drag and drop
4. Supported formats: PDF, DOCX, TXT, MD
5. Wait for processing (may take a few seconds for large PDFs)
6. Success! Your document is now chunked and ready

### 3. Document Structure

Each uploaded document is stored with:
```json
{
  "chunks": [
    {
      "text": "The actual text content of the chunk...",
      "index": 0,
      "pageNumber": 1,
      "metadata": {
        "startChar": 0,
        "endChar": 1000
      }
    }
  ]
}
```

## Next Steps (To Complete RAG)

### 🔄 Step 5: Update Chat to Use Chunks

Modify `app/page.tsx` in the `handleSourcesAndChat` function:

```typescript
// Fetch course materials if enabled
if (chatbot.use_course_materials) {
  const { data: { session: materialSession } } = await supabase.auth.refreshSession();

  if (materialSession) {
    const materialsResponse = await fetch(`/api/course-materials?chatbot_id=${selectedChatbot}`, {
      headers: {
        'Authorization': `Bearer ${materialSession.access_token}`
      }
    });

    if (materialsResponse.ok) {
      const materials = await materialsResponse.json();

      // Extract chunks and add to sources with metadata
      materials.forEach((material: any) => {
        if (material.chunks && Array.isArray(material.chunks)) {
          // Take first 10 most relevant chunks (for now, just first 10)
          material.chunks.slice(0, 10).forEach((chunk: any) => {
            parsedSourcesData.push({
              fullContent: chunk.text,
              source: {
                title: material.title,
                fileName: material.file_name,
                page: chunk.pageNumber,
                chunkIndex: chunk.index
              }
            });
          });
        } else {
          // Fallback for old materials without chunks
          parsedSourcesData.push({
            fullContent: `## ${material.title}\n\n${material.content}`,
            source: {
              title: material.title,
              fileName: material.file_name
            }
          });
        }
      });
    }
  }
}
```

### 🔄 Step 6: Add Source Citations to System Prompt

Update the system prompt to include source information:

```typescript
const systemContent = chatbot.system_prompt + `

Here is the teaching material with sources:

${parsedSourcesData.map((source, idx) => `
[Source ${idx + 1}: ${source.source?.title || 'Unknown'}${source.source?.page ? `, Page ${source.source.page}` : ''}]
${source.fullContent}
`).join('\n\n')}

IMPORTANT: When answering, cite your sources using [Source X] notation.
Example: "According to [Source 1], photosynthesis is the process..."
`;
```

### 🔄 Step 7: Display Sources in Chat UI

Update `components/Sources.tsx` to show which chunks were used:

```typescript
// Add a state to track which sources were cited
const [citedSources, setCitedSources] = useState<string[]>([]);

// Parse the AI response for [Source X] citations
// Highlight those sources in the Sources panel
```

### 🔄 Step 8: Update Chat Component

Modify `components/Chat.tsx` to render source citations:

```typescript
// Parse markdown and detect [Source X] patterns
// Make them clickable to jump to the source panel
// Example: [Source 1] becomes a badge that highlights Source 1
```

## Current Limitations

1. **No Semantic Search**: Uses all chunks (limited to first 10) instead of finding most relevant chunks
2. **No Vector Embeddings**: For production, consider adding OpenAI embeddings or pgvector
3. **PowerPoint**: Not yet supported - convert PPTX to PDF first
4. **Old Word Formats**: .doc not supported, only .docx

## Recommended Enhancements

### For Better Retrieval (Future):

1. **Add Vector Embeddings**:
   ```bash
   npm install openai
   # Enable pgvector in Supabase
   ```

2. **Implement Semantic Search**:
   - Generate embeddings for each chunk
   - Store embeddings in database
   - Find most similar chunks to user query
   - Only use top 5-10 most relevant chunks

3. **Add Reranking**:
   - Use cross-encoder models
   - Improve relevance of retrieved chunks

4. **Better Source Tracking**:
   - Track which chunks were actually used in response
   - Show confidence scores
   - Allow users to view original document sections

## Testing

1. **Upload a test PDF**:
   - Go to Admin Dashboard
   - Select a chatbot
   - Upload a sample PDF
   - Check that chunks are created

2. **Query the database**:
   ```sql
   SELECT title, file_name, jsonb_array_length(chunks) as chunk_count
   FROM course_materials
   WHERE chunks IS NOT NULL;
   ```

3. **Test retrieval**:
   - Enable "Use Course Materials" on chatbot
   - Ask a question related to uploaded content
   - Verify AI uses the material in its response

## Troubleshooting

**"Cannot read property 'chunks' of undefined"**
- Run the database migration first

**"Error processing PDF"**
- Ensure PDF has extractable text (not scanned image)
- Try converting to DOCX or copy-paste text manually

**"File too large"**
- Current limit is 10MB
- Split large PDFs into smaller files
- Or increase limit in `/api/course-materials/upload/route.ts`

**Chunks not being used in chat**
- Complete Steps 5-6 above
- Check console logs for errors
- Verify chatbot has `use_course_materials` enabled

## Summary

✅ Documents can now be uploaded and automatically chunked
✅ Chunks are stored with page numbers and metadata
✅ Ready for RAG implementation
🔄 Need to connect chunks to chat flow (Steps 5-8)
🔄 Can add vector search for better results later

The foundation is complete! Now you just need to wire up the chunks to the chat system to complete the RAG pipeline.
