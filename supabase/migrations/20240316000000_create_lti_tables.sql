-- LTI Platform Configuration Table
-- Stores configuration for each LMS platform (Canvas, Moodle, D2L, etc.)
CREATE TABLE IF NOT EXISTS lti_platforms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL, -- e.g., "Canvas Production", "Moodle Test"
  platform_type VARCHAR(100) NOT NULL, -- canvas, moodle, d2l, blackboard, etc.
  issuer VARCHAR(500) NOT NULL UNIQUE, -- LTI issuer URL
  client_id VARCHAR(500) NOT NULL,
  auth_endpoint VARCHAR(500) NOT NULL, -- OIDC auth endpoint
  token_endpoint VARCHAR(500) NOT NULL, -- Token endpoint
  jwks_endpoint VARCHAR(500) NOT NULL, -- JSON Web Key Set endpoint
  deployment_id VARCHAR(500), -- Optional deployment ID

  -- LTI Advantage Service Endpoints
  nrps_endpoint VARCHAR(500), -- Names and Role Provisioning Services
  ags_endpoint VARCHAR(500), -- Assignment and Grade Services
  deep_linking_endpoint VARCHAR(500), -- Deep Linking

  -- Configuration
  is_active BOOLEAN DEFAULT true,
  auto_provision_users BOOLEAN DEFAULT true, -- Auto-create users on LTI launch
  sync_enabled BOOLEAN DEFAULT false, -- Enable automatic data sync
  sync_frequency_hours INTEGER DEFAULT 24, -- How often to sync data
  last_sync_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LTI Keys Table
-- Stores public/private key pairs for LTI authentication
CREATE TABLE IF NOT EXISTS lti_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_id UUID REFERENCES lti_platforms(id) ON DELETE CASCADE,
  key_id VARCHAR(255) NOT NULL UNIQUE, -- Key ID (kid)
  public_key TEXT NOT NULL, -- PEM format public key
  private_key TEXT NOT NULL, -- PEM format private key (encrypted)
  algorithm VARCHAR(50) DEFAULT 'RS256', -- Signing algorithm
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- LTI Context (Course) Mapping Table
-- Maps LMS courses to NOVA chatbots
CREATE TABLE IF NOT EXISTS lti_contexts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_id UUID REFERENCES lti_platforms(id) ON DELETE CASCADE,
  context_id VARCHAR(500) NOT NULL, -- LTI context_id (course ID from LMS)
  context_label VARCHAR(255), -- Course code (e.g., "CS101")
  context_title VARCHAR(500), -- Course name (e.g., "Introduction to Computer Science")
  chatbot_id UUID REFERENCES chatbots(id) ON DELETE SET NULL,

  -- LMS Course Metadata
  lms_course_data JSONB, -- Store full LMS course data

  -- Sync Status
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_status VARCHAR(50) DEFAULT 'pending', -- pending, syncing, completed, error
  sync_error TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(platform_id, context_id)
);

-- LTI User Mapping Table
-- Maps LMS users to NOVA users
CREATE TABLE IF NOT EXISTS lti_user_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_id UUID REFERENCES lti_platforms(id) ON DELETE CASCADE,
  lti_user_id VARCHAR(500) NOT NULL, -- User ID from LMS
  nova_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- User Info from LMS
  email VARCHAR(255),
  given_name VARCHAR(255),
  family_name VARCHAR(255),
  full_name VARCHAR(255),
  lms_roles JSONB, -- Array of roles from LMS

  -- Metadata
  lms_user_data JSONB, -- Store full LMS user data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(platform_id, lti_user_id)
);

-- LTI Enrollments Table
-- Tracks user enrollments in courses
CREATE TABLE IF NOT EXISTS lti_enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  context_id UUID REFERENCES lti_contexts(id) ON DELETE CASCADE,
  user_mapping_id UUID REFERENCES lti_user_mappings(id) ON DELETE CASCADE,
  role VARCHAR(100) NOT NULL, -- student, instructor, teaching_assistant, etc.
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, completed

  -- Enrollment metadata
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(context_id, user_mapping_id)
);

-- LTI Course Materials Sync Table
-- Tracks synced course materials from LMS
CREATE TABLE IF NOT EXISTS lti_synced_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  context_id UUID REFERENCES lti_contexts(id) ON DELETE CASCADE,
  lms_resource_id VARCHAR(500) NOT NULL, -- Resource ID from LMS
  resource_type VARCHAR(100), -- file, page, assignment, module, etc.
  resource_title VARCHAR(500),
  resource_url VARCHAR(1000),

  -- Mapped NOVA material
  course_material_id UUID REFERENCES course_materials(id) ON DELETE SET NULL,

  -- Resource Metadata
  lms_resource_data JSONB, -- Store full LMS resource data
  content_hash VARCHAR(255), -- Hash of content to detect changes

  -- Sync Status
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_status VARCHAR(50) DEFAULT 'pending',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(context_id, lms_resource_id)
);

-- LTI Launch Sessions Table
-- Tracks LTI launch sessions for debugging and analytics
CREATE TABLE IF NOT EXISTS lti_launch_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_id UUID REFERENCES lti_platforms(id) ON DELETE SET NULL,
  user_mapping_id UUID REFERENCES lti_user_mappings(id) ON DELETE SET NULL,
  context_id UUID REFERENCES lti_contexts(id) ON DELETE SET NULL,

  -- Launch Data
  launch_id VARCHAR(500) NOT NULL UNIQUE,
  message_type VARCHAR(100), -- LtiResourceLinkRequest, LtiDeepLinkingRequest
  launch_data JSONB, -- Full LTI launch payload

  -- Session Info
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
);

-- LTI Sync Logs Table
-- Audit log for sync operations
CREATE TABLE IF NOT EXISTS lti_sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_id UUID REFERENCES lti_platforms(id) ON DELETE CASCADE,
  sync_type VARCHAR(100) NOT NULL, -- courses, users, enrollments, materials, grades
  status VARCHAR(50) NOT NULL, -- started, completed, failed

  -- Sync Stats
  items_processed INTEGER DEFAULT 0,
  items_created INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,

  error_message TEXT,
  error_details JSONB,

  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER
);

-- Enable Row Level Security
ALTER TABLE lti_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE lti_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE lti_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lti_user_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE lti_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lti_synced_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE lti_launch_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lti_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Admin-only access for configuration tables
CREATE POLICY "Admins can manage LTI platforms"
  ON lti_platforms FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage LTI keys"
  ON lti_keys FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Instructors can view their courses
CREATE POLICY "Instructors can view their contexts"
  ON lti_contexts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lti_enrollments e
      JOIN lti_user_mappings um ON um.id = e.user_mapping_id
      WHERE e.context_id = lti_contexts.id
      AND um.nova_user_id = auth.uid()
      AND e.role IN ('instructor', 'teaching_assistant')
    )
    OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admins can manage contexts
CREATE POLICY "Admins can manage contexts"
  ON lti_contexts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Users can view their own mappings
CREATE POLICY "Users can view own mappings"
  ON lti_user_mappings FOR SELECT
  TO authenticated
  USING (nova_user_id = auth.uid());

-- Admins can manage user mappings
CREATE POLICY "Admins can manage user mappings"
  ON lti_user_mappings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Users can view their own enrollments
CREATE POLICY "Users can view own enrollments"
  ON lti_enrollments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lti_user_mappings um
      WHERE um.id = lti_enrollments.user_mapping_id
      AND um.nova_user_id = auth.uid()
    )
  );

-- Admins and instructors can view course enrollments
CREATE POLICY "Instructors can view course enrollments"
  ON lti_enrollments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lti_enrollments ie
      JOIN lti_user_mappings um ON um.id = ie.user_mapping_id
      WHERE ie.context_id = lti_enrollments.context_id
      AND um.nova_user_id = auth.uid()
      AND ie.role IN ('instructor', 'teaching_assistant')
    )
    OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Students can view materials for their courses
CREATE POLICY "Students can view course materials"
  ON lti_synced_materials FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lti_enrollments e
      JOIN lti_user_mappings um ON um.id = e.user_mapping_id
      WHERE e.context_id = lti_synced_materials.context_id
      AND um.nova_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admins can view sync logs
CREATE POLICY "Admins can view sync logs"
  ON lti_sync_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX idx_lti_platforms_active ON lti_platforms(is_active);
CREATE INDEX idx_lti_platforms_issuer ON lti_platforms(issuer);
CREATE INDEX idx_lti_keys_platform ON lti_keys(platform_id);
CREATE INDEX idx_lti_keys_active ON lti_keys(is_active);
CREATE INDEX idx_lti_contexts_platform ON lti_contexts(platform_id);
CREATE INDEX idx_lti_contexts_chatbot ON lti_contexts(chatbot_id);
CREATE INDEX idx_lti_contexts_context_id ON lti_contexts(context_id);
CREATE INDEX idx_lti_user_mappings_platform ON lti_user_mappings(platform_id);
CREATE INDEX idx_lti_user_mappings_nova_user ON lti_user_mappings(nova_user_id);
CREATE INDEX idx_lti_user_mappings_lti_user ON lti_user_mappings(lti_user_id);
CREATE INDEX idx_lti_enrollments_context ON lti_enrollments(context_id);
CREATE INDEX idx_lti_enrollments_user ON lti_enrollments(user_mapping_id);
CREATE INDEX idx_lti_enrollments_role ON lti_enrollments(role);
CREATE INDEX idx_lti_synced_materials_context ON lti_synced_materials(context_id);
CREATE INDEX idx_lti_launch_sessions_platform ON lti_launch_sessions(platform_id);
CREATE INDEX idx_lti_launch_sessions_user ON lti_launch_sessions(user_mapping_id);
CREATE INDEX idx_lti_sync_logs_platform ON lti_sync_logs(platform_id);
CREATE INDEX idx_lti_sync_logs_created ON lti_sync_logs(started_at);

-- Add triggers for updated_at
CREATE TRIGGER update_lti_platforms_updated_at
  BEFORE UPDATE ON lti_platforms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lti_contexts_updated_at
  BEFORE UPDATE ON lti_contexts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lti_user_mappings_updated_at
  BEFORE UPDATE ON lti_user_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lti_enrollments_updated_at
  BEFORE UPDATE ON lti_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lti_synced_materials_updated_at
  BEFORE UPDATE ON lti_synced_materials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
