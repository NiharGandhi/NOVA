-- Check if there are any course materials for this chatbot
SELECT 
  cm.id,
  cm.title,
  cm.file_name,
  cm.chatbot_id,
  cm.created_at
FROM course_materials cm
WHERE cm.chatbot_id = '1040e83e-1ae2-4458-a27e-bf6ee0ad8d49';

-- Check if there are any document chunks for this chatbot's materials
SELECT 
  dc.id,
  dc.material_id,
  dc.chunk_index,
  dc.page_number,
  LENGTH(dc.chunk_text) as chunk_length,
  dc.embedding IS NOT NULL as has_embedding,
  cm.title as material_title
FROM document_chunks dc
JOIN course_materials cm ON dc.material_id = cm.id
WHERE cm.chatbot_id = '1040e83e-1ae2-4458-a27e-bf6ee0ad8d49'
LIMIT 10;

-- Count total chunks for this chatbot
SELECT 
  COUNT(*) as total_chunks
FROM document_chunks dc
JOIN course_materials cm ON dc.material_id = cm.id
WHERE cm.chatbot_id = '1040e83e-1ae2-4458-a27e-bf6ee0ad8d49';
