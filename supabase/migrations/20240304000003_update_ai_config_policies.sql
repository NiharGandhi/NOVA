-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can read ai_config" ON public.ai_config;
DROP POLICY IF EXISTS "Admins can update ai_config" ON public.ai_config;
DROP POLICY IF EXISTS "Admins can insert ai_config" ON public.ai_config;

-- Create more permissive policies for admins
CREATE POLICY "Admins can read ai_config"
ON public.ai_config
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can modify ai_config"
ON public.ai_config
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Create policy for all users to read config
CREATE POLICY "All users can read ai_config"
ON public.ai_config
FOR SELECT
USING (true);

-- Insert default config if not exists
INSERT INTO public.ai_config (
  id,
  max_tokens,
  temperature,
  allowed_models,
  blocked_topics,
  requires_citation,
  max_requests_per_day,
  response_templates
) VALUES (
  1,
  500,
  0.7,
  ARRAY['gpt-3.5-turbo', 'gpt-4'],
  ARRAY[]::TEXT[],
  true,
  50,
  ARRAY[
    jsonb_build_object(
      'id', 'step-by-step',
      'name', 'Step by Step',
      'description', 'Break down explanations into numbered steps',
      'template', 'Please explain this in clear, numbered steps. Each step should be concise and build upon the previous one.',
      'isActive', true
    ),
    jsonb_build_object(
      'id', 'socratic',
      'name', 'Socratic Method',
      'description', 'Guide through questions and discovery',
      'template', 'Use the Socratic method to guide the student. Ask thought-provoking questions and help them discover the answers.',
      'isActive', false
    ),
    jsonb_build_object(
      'id', 'analogy',
      'name', 'Analogies & Examples',
      'description', 'Explain using real-world analogies',
      'template', 'Explain concepts using relatable real-world analogies and practical examples.',
      'isActive', false
    )
  ]::jsonb[]
)
ON CONFLICT (id) DO NOTHING;
