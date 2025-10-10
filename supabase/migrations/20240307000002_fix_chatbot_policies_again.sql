-- Drop all existing policies
DROP POLICY IF EXISTS "Anyone can view active chatbots" ON chatbots;
DROP POLICY IF EXISTS "Admins can manage chatbots" ON chatbots;
DROP POLICY IF EXISTS "Admins can view all chatbots" ON chatbots;
DROP POLICY IF EXISTS "Admins can insert chatbots" ON chatbots;
DROP POLICY IF EXISTS "Admins can update chatbots" ON chatbots;
DROP POLICY IF EXISTS "Admins can delete chatbots" ON chatbots;

-- Recreate policies in correct order

-- 1. Allow all authenticated users to read active chatbots
CREATE POLICY "Anyone can view active chatbots"
  ON chatbots FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 2. Allow admins to view all chatbots (including inactive ones)
CREATE POLICY "Admins can view all chatbots"
  ON chatbots FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- 3. Allow admins to insert chatbots
CREATE POLICY "Admins can insert chatbots"
  ON chatbots FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- 4. Allow admins to update chatbots
CREATE POLICY "Admins can update chatbots"
  ON chatbots FOR UPDATE
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

-- 5. Allow admins to delete chatbots
CREATE POLICY "Admins can delete chatbots"
  ON chatbots FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
