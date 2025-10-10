-- Make content column nullable for course_materials
-- This allows file uploads to skip storing full content when using embeddings/chunks
ALTER TABLE course_materials
ALTER COLUMN content DROP NOT NULL;
