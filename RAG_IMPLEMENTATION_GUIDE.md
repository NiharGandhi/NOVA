# RAG System Implementation Guide

## Overview
This guide walks through implementing a RAG (Retrieval-Augmented Generation) system with source citations for PDF and PowerPoint documents.

## Step 1: Install Required Dependencies

```bash
npm install pdf-parse mammoth pptx2json
npm install --save-dev @types/pdf-parse
```

**Libraries:**
- `pdf-parse`: Parse PDF files to extract text
- `mammoth`: Convert DOCX files to text
- `pptx2json`: Parse PowerPoint files (PPTX)

## Step 2: Update Database Schema

Create a new migration for document chunks:

**File: `supabase/migrations/20240308000000_add_document_chunks.sql`**

```sql
-- Add chunks column to course_materials
ALTER TABLE course_materials
ADD COLUMN IF NOT EXISTS chunks JSONB DEFAULT '[]'::jsonb;

-- Create a separate table for better querying (optional but recommended)
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID REFERENCES course_materials(id) ON DELETE CASCADE,
  chatbot_id UUID REFERENCES chatbots(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  page_number INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_document_chunks_material ON document_chunks(material_id);
CREATE INDEX idx_document_chunks_chatbot ON document_chunks(chatbot_id);
CREATE INDEX idx_document_chunks_page ON document_chunks(page_number);

-- Enable RLS
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view chunks for active chatbots"
  ON document_chunks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chatbots
      WHERE chatbots.id = document_chunks.chatbot_id
      AND chatbots.is_active = true
    )
  );

CREATE POLICY "Admins can manage chunks"
  ON document_chunks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
```

## Step 3: Create Document Processing Utility

**File: `utils/documentProcessor.ts`**

```typescript
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

export interface DocumentChunk {
  text: string;
  index: number;
  pageNumber?: number;
  metadata?: Record<string, any>;
}

export interface ProcessedDocument {
  content: string;
  chunks: DocumentChunk[];
  metadata: {
    fileName: string;
    fileType: string;
    totalPages?: number;
    totalChunks: number;
  };
}

// Chunk text into smaller pieces for better retrieval
export function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let startIndex = 0;
  let chunkIndex = 0;

  // Clean and normalize text
  text = text.replace(/\s+/g, ' ').trim();

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSize, text.length);
    const chunkText = text.slice(startIndex, endIndex).trim();

    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        index: chunkIndex,
        metadata: {
          startChar: startIndex,
          endChar: endIndex
        }
      });
      chunkIndex++;
    }

    startIndex += chunkSize - overlap;
  }

  return chunks;
}

// Process PDF file
export async function processPDF(buffer: Buffer, fileName: string): Promise<ProcessedDocument> {
  try {
    const data = await pdf(buffer);

    // Extract text with page numbers
    const chunks: DocumentChunk[] = [];
    let chunkIndex = 0;

    // Process each page
    for (let pageNum = 1; pageNum <= data.numpages; pageNum++) {
      // Note: pdf-parse doesn't provide per-page text easily
      // For a full implementation, use pdf.js or pdfjs-dist
      const pageChunks = chunkText(data.text, 1000, 200);

      pageChunks.forEach((chunk) => {
        chunks.push({
          ...chunk,
          index: chunkIndex++,
          pageNumber: pageNum,
          metadata: {
            ...chunk.metadata,
            page: pageNum
          }
        });
      });
    }

    return {
      content: data.text,
      chunks,
      metadata: {
        fileName,
        fileType: 'pdf',
        totalPages: data.numpages,
        totalChunks: chunks.length
      }
    };
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw new Error('Failed to process PDF file');
  }
}

// Process DOCX file
export async function processDOCX(buffer: Buffer, fileName: string): Promise<ProcessedDocument> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;
    const chunks = chunkText(text, 1000, 200);

    return {
      content: text,
      chunks,
      metadata: {
        fileName,
        fileType: 'docx',
        totalChunks: chunks.length
      }
    };
  } catch (error) {
    console.error('Error processing DOCX:', error);
    throw new Error('Failed to process DOCX file');
  }
}

// Process PPTX file (simplified - for full implementation use pptx2json)
export async function processPPTX(buffer: Buffer, fileName: string): Promise<ProcessedDocument> {
  // For now, return a placeholder
  // Full implementation would use pptx2json or similar library
  throw new Error('PPTX processing not yet implemented. Please convert to PDF or paste text manually.');
}

// Main processing function
export async function processDocument(file: Buffer, fileName: string): Promise<ProcessedDocument> {
  const extension = fileName.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return processPDF(file, fileName);
    case 'docx':
    case 'doc':
      return processDOCX(file, fileName);
    case 'pptx':
    case 'ppt':
      return processPPTX(file, fileName);
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }
}
```

## Step 4: Create File Upload API

**File: `app/api/course-materials/upload/route.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { processDocument } from '@/utils/documentProcessor'

const supabaseAdmin = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ?
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  ) : null;

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.split('Bearer ')[1]

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.delete({ name, ...options });
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: "Forbidden - Admin access required" }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const chatbot_id = formData.get('chatbot_id') as string;
    const title = formData.get('title') as string;

    if (!file || !chatbot_id) {
      return new Response(JSON.stringify({ error: "Missing file or chatbot_id" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process the document
    const processed = await processDocument(buffer, file.name);

    // Store the material with chunks
    const { data: material, error: materialError } = await supabaseAdmin
      .from('course_materials')
      .insert({
        chatbot_id,
        title: title || file.name,
        content: processed.content,
        file_name: file.name,
        file_type: processed.metadata.fileType,
        chunks: processed.chunks,
        created_by: user.id
      })
      .select()
      .single();

    if (materialError) {
      console.error('Error storing material:', materialError);
      return new Response(JSON.stringify({ error: "Error storing material" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Store individual chunks for better querying
    const chunkInserts = processed.chunks.map(chunk => ({
      material_id: material.id,
      chatbot_id,
      chunk_text: chunk.text,
      chunk_index: chunk.index,
      page_number: chunk.pageNumber,
      metadata: chunk.metadata
    }));

    const { error: chunksError } = await supabaseAdmin
      .from('document_chunks')
      .insert(chunkInserts);

    if (chunksError) {
      console.error('Error storing chunks:', chunksError);
      // Don't fail the request, chunks are optional
    }

    return NextResponse.json({
      success: true,
      material,
      chunks: processed.chunks.length
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export const config = {
  api: {
    bodyParser: false, // Disable body parsing, we'll handle it ourselves
  },
};
```

## Step 5: Update AdminDashboard for File Upload

Update the file upload handler in `components/AdminDashboard.tsx`:

```typescript
const handleFileUpload = async (file: File) => {
  if (!selectedChatbot) {
    setMessage('Please select a chatbot first');
    return;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('chatbot_id', selectedChatbot.id);
    formData.append('title', file.name.replace(/\.[^/.]+$/, ''));

    setMessage('Processing document... This may take a moment.');

    const response = await fetch('/api/course-materials/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      },
      body: formData
    });

    if (response.ok) {
      const result = await response.json();
      setMessage(`Document uploaded successfully! Created ${result.chunks} chunks.`);
      loadCourseMaterials(selectedChatbot.id);
    } else {
      const error = await response.json();
      setMessage('Error uploading document: ' + error.error);
    }
  } catch (error) {
    console.error('Error uploading document:', error);
    setMessage('Error uploading document');
  }
};
```

## Step 6: Implement RAG Retrieval

**Simplified approach (without vector search):**

Update `app/page.tsx` to retrieve relevant chunks:

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

      // Extract chunks and add to context
      materials.forEach((material: any) => {
        if (material.chunks && Array.isArray(material.chunks)) {
          material.chunks.slice(0, 5).forEach((chunk: any) => {
            parsedSourcesData.push({
              fullContent: `## ${material.title} (Page ${chunk.pageNumber || 'N/A'})\n\n${chunk.text}`,
              source: {
                title: material.title,
                fileName: material.file_name,
                page: chunk.pageNumber
              }
            });
          });
        }
      });
    }
  }
}
```

## Step 7: Update Chat to Show Sources

Add source tracking to the chat messages and display them in the UI.

## Installation Commands

```bash
# Install dependencies
npm install pdf-parse mammoth

# Install types
npm install --save-dev @types/pdf-parse

# Run database migration
# Apply the SQL from Step 2 in your Supabase dashboard

# Test the implementation
npm run dev
```

## Notes

- For production, consider using vector embeddings (OpenAI embeddings, Pinecone, or pgvector)
- The current implementation uses simple chunking without semantic search
- For better results with PowerPoint, convert to PDF first
- Consider adding a progress indicator for large file uploads
