-- Drop existing policies to clean up
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;

-- Create comprehensive policies
CREATE POLICY "Enable read access for all users" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for users on their own records" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Make you an admin (replace YOUR_EMAIL with your actual email)
INSERT INTO public.users (id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email = auth.jwt() ->> 'email'
ON CONFLICT (id) DO UPDATE
SET role = 'admin'
WHERE users.id = EXCLUDED.id;

