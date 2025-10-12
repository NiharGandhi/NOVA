-- Add instructor role to users table
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'instructor', 'admin'));

-- Create course_instructors junction table
CREATE TABLE IF NOT EXISTS public.course_instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id UUID NOT NULL REFERENCES chatbots(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id),
  UNIQUE(chatbot_id, instructor_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_course_instructors_chatbot_id ON course_instructors(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_course_instructors_instructor_id ON course_instructors(instructor_id);

-- Enable RLS
ALTER TABLE course_instructors ENABLE ROW LEVEL SECURITY;

-- Policies for course_instructors
-- Admins can do everything
CREATE POLICY "Admins can manage course instructors"
  ON course_instructors FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

-- Instructors can view their own assignments
CREATE POLICY "Instructors can view their assignments"
  ON course_instructors FOR SELECT
  USING (instructor_id = auth.uid());

-- Update chatbots policies to allow instructors to view and update their assigned courses
CREATE POLICY "Instructors can view assigned chatbots"
  ON chatbots FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM course_instructors
    WHERE course_instructors.chatbot_id = chatbots.id
    AND course_instructors.instructor_id = auth.uid()
  ));

CREATE POLICY "Instructors can update assigned chatbots"
  ON chatbots FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM course_instructors
    WHERE course_instructors.chatbot_id = chatbots.id
    AND course_instructors.instructor_id = auth.uid()
  ));

-- Allow instructors to view chat sessions for their assigned courses
CREATE POLICY "Instructors can view chat sessions for their courses"
  ON chat_sessions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM course_instructors
    WHERE course_instructors.chatbot_id = chat_sessions.chatbot_id
    AND course_instructors.instructor_id = auth.uid()
  ));

-- Allow instructors to view messages from their courses
CREATE POLICY "Instructors can view messages from their courses"
  ON chat_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM chat_sessions
    JOIN course_instructors ON course_instructors.chatbot_id = chat_sessions.chatbot_id
    WHERE chat_sessions.id = chat_messages.session_id
    AND course_instructors.instructor_id = auth.uid()
  ));

-- Allow instructors to manage course materials for their assigned courses
CREATE POLICY "Instructors can view materials for assigned courses"
  ON document_chunks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM course_instructors
    WHERE course_instructors.chatbot_id = document_chunks.chatbot_id
    AND course_instructors.instructor_id = auth.uid()
  ));

CREATE POLICY "Instructors can insert materials for assigned courses"
  ON document_chunks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM course_instructors
    WHERE course_instructors.chatbot_id = document_chunks.chatbot_id
    AND course_instructors.instructor_id = auth.uid()
  ));

CREATE POLICY "Instructors can update materials for assigned courses"
  ON document_chunks FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM course_instructors
    WHERE course_instructors.chatbot_id = document_chunks.chatbot_id
    AND course_instructors.instructor_id = auth.uid()
  ));

CREATE POLICY "Instructors can delete materials for assigned courses"
  ON document_chunks FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM course_instructors
    WHERE course_instructors.chatbot_id = document_chunks.chatbot_id
    AND course_instructors.instructor_id = auth.uid()
  ));
