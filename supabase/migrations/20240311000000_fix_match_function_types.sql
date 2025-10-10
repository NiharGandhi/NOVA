-- Fix the match_document_chunks function to handle varchar types correctly
DROP FUNCTION IF EXISTS match_document_chunks(vector, float, int, uuid);

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
  file_name varchar(255),
  title varchar(255)
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

COMMENT ON FUNCTION match_document_chunks IS 'Searches for similar document chunks using cosine similarity';
