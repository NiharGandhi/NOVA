-- Add RLS policies for instructors to access course_materials and document_chunks

-- ============================================
-- COURSE MATERIALS POLICIES FOR INSTRUCTORS
-- ============================================

-- Allow instructors to view course materials for their assigned courses
CREATE POLICY "Instructors can view course materials for assigned courses"
  ON course_materials FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM course_instructors
    WHERE course_instructors.chatbot_id = course_materials.chatbot_id
    AND course_instructors.instructor_id = auth.uid()
  ));

-- Allow instructors to insert course materials for their assigned courses
CREATE POLICY "Instructors can insert course materials for assigned courses"
  ON course_materials FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM course_instructors
    WHERE course_instructors.chatbot_id = course_materials.chatbot_id
    AND course_instructors.instructor_id = auth.uid()
  ));

-- Allow instructors to update course materials for their assigned courses
CREATE POLICY "Instructors can update course materials for assigned courses"
  ON course_materials FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM course_instructors
    WHERE course_instructors.chatbot_id = course_materials.chatbot_id
    AND course_instructors.instructor_id = auth.uid()
  ));

-- Allow instructors to delete course materials for their assigned courses
CREATE POLICY "Instructors can delete course materials for assigned courses"
  ON course_materials FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM course_instructors
    WHERE course_instructors.chatbot_id = course_materials.chatbot_id
    AND course_instructors.instructor_id = auth.uid()
  ));

-- ============================================
-- DOCUMENT CHUNKS POLICIES FOR INSTRUCTORS
-- ============================================

-- Allow instructors to view document chunks for their assigned courses
CREATE POLICY "Instructors can view document chunks for assigned courses"
  ON document_chunks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM course_materials cm
    JOIN course_instructors ci ON ci.chatbot_id = cm.chatbot_id
    WHERE cm.id = document_chunks.material_id
    AND ci.instructor_id = auth.uid()
  ));

-- Allow instructors to insert document chunks for their assigned courses
CREATE POLICY "Instructors can insert document chunks for assigned courses"
  ON document_chunks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM course_materials cm
    JOIN course_instructors ci ON ci.chatbot_id = cm.chatbot_id
    WHERE cm.id = document_chunks.material_id
    AND ci.instructor_id = auth.uid()
  ));

-- Allow instructors to update document chunks for their assigned courses
CREATE POLICY "Instructors can update document chunks for assigned courses"
  ON document_chunks FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM course_materials cm
    JOIN course_instructors ci ON ci.chatbot_id = cm.chatbot_id
    WHERE cm.id = document_chunks.material_id
    AND ci.instructor_id = auth.uid()
  ));

-- Allow instructors to delete document chunks for their assigned courses
CREATE POLICY "Instructors can delete document chunks for assigned courses"
  ON document_chunks FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM course_materials cm
    JOIN course_instructors ci ON ci.chatbot_id = cm.chatbot_id
    WHERE cm.id = document_chunks.material_id
    AND ci.instructor_id = auth.uid()
  ));

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON POLICY "Instructors can view course materials for assigned courses" ON course_materials IS
'Allows instructors to view course materials for courses they are assigned to via course_instructors junction table';

COMMENT ON POLICY "Instructors can view document chunks for assigned courses" ON document_chunks IS
'Allows instructors to view document chunks for materials in courses they are assigned to';
