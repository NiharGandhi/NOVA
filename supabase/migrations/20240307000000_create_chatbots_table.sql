-- Create chatbots table
CREATE TABLE IF NOT EXISTS chatbots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  use_web_search BOOLEAN DEFAULT true,
  use_course_materials BOOLEAN DEFAULT false,
  age_group VARCHAR(100) DEFAULT 'Middle School',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create course_materials table
CREATE TABLE IF NOT EXISTS course_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chatbot_id UUID REFERENCES chatbots(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  file_name VARCHAR(255),
  file_type VARCHAR(100),
  order_index INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE chatbots ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_materials ENABLE ROW LEVEL SECURITY;

-- Policies for chatbots table
-- Allow all authenticated users to read active chatbots
CREATE POLICY "Anyone can view active chatbots"
  ON chatbots FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Allow admins to manage chatbots
CREATE POLICY "Admins can manage chatbots"
  ON chatbots FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policies for course_materials table
-- Allow authenticated users to read course materials for active chatbots
CREATE POLICY "Users can view materials for active chatbots"
  ON course_materials FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chatbots
      WHERE chatbots.id = course_materials.chatbot_id
      AND chatbots.is_active = true
    )
  );

-- Allow admins to manage course materials
CREATE POLICY "Admins can manage course materials"
  ON course_materials FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_chatbots_active ON chatbots(is_active);
CREATE INDEX idx_chatbots_subject ON chatbots(subject);
CREATE INDEX idx_course_materials_chatbot ON course_materials(chatbot_id);
CREATE INDEX idx_course_materials_order ON course_materials(chatbot_id, order_index);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_chatbots_updated_at
  BEFORE UPDATE ON chatbots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_course_materials_updated_at
  BEFORE UPDATE ON course_materials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert a default general chatbot
INSERT INTO chatbots (name, subject, description, system_prompt, use_web_search, use_course_materials)
VALUES (
  'General Tutor',
  'General',
  'A general-purpose AI tutor that can teach any subject',
  'You are a professional interactive personal tutor who is an expert at explaining topics. Given a topic and the information to teach, please educate the user about it. Be interactive throughout the chat and quiz the user occasionally after you teach them material.',
  true,
  false
);
