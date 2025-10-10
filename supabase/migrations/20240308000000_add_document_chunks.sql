-- Add chunks column to course_materials for storing parsed document chunks
ALTER TABLE course_materials
ADD COLUMN IF NOT EXISTS chunks JSONB DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN course_materials.chunks IS 'Stores document chunks with metadata for RAG retrieval';

-- Create index for better query performance on chunks
CREATE INDEX IF NOT EXISTS idx_course_materials_chunks ON course_materials USING GIN (chunks);
