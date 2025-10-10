-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create storage bucket for course materials (run this in Supabase Dashboard -> Storage)
-- We'll do this via the dashboard, but documenting it here:
-- Bucket name: course-materials
-- Public: false
-- Allowed MIME types: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain, text/markdown

-- Update course_materials table to include storage reference and remove content column
ALTER TABLE course_materials
ADD COLUMN IF NOT EXISTS storage_path TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- Create document_chunks table for storing embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID REFERENCES course_materials(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  page_number INTEGER,
  embedding vector(1536), -- OpenAI embeddings are 1536 dimensions
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
ON document_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index for material_id lookups
CREATE INDEX IF NOT EXISTS idx_document_chunks_material_id
ON document_chunks(material_id);

-- Add RLS policies for document_chunks
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read chunks for their chatbot's materials
CREATE POLICY "Users can read chunks for active chatbots"
  ON document_chunks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM course_materials cm
      JOIN chatbots c ON cm.chatbot_id = c.id
      WHERE cm.id = document_chunks.material_id
      AND c.is_active = true
    )
  );

-- Allow admins to manage all chunks
CREATE POLICY "Admins can manage all chunks"
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

-- Function to search similar chunks
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 10,
  chatbot_id_filter uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  material_id uuid,
  chunk_text text,
  chunk_index integer,
  page_number integer,
  similarity float,
  file_name text,
  title text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.material_id,
    dc.chunk_text,
    dc.chunk_index,
    dc.page_number,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    cm.file_name,
    cm.title
  FROM document_chunks dc
  JOIN course_materials cm ON dc.material_id = cm.id
  WHERE
    (chatbot_id_filter IS NULL OR cm.chatbot_id = chatbot_id_filter)
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add comment
COMMENT ON TABLE document_chunks IS 'Stores document chunks with vector embeddings for semantic search';
COMMENT ON FUNCTION match_document_chunks IS 'Searches for similar document chunks using cosine similarity';
