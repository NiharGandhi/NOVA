-- Create ai_config table
CREATE TABLE IF NOT EXISTS public.ai_config (
  id INTEGER PRIMARY KEY,
  max_tokens INTEGER NOT NULL DEFAULT 500,
  temperature FLOAT NOT NULL DEFAULT 0.7,
  allowed_models TEXT[] NOT NULL DEFAULT ARRAY['gpt-3.5-turbo', 'gpt-4'],
  blocked_topics TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  requires_citation BOOLEAN NOT NULL DEFAULT true,
  max_requests_per_day INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS
ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can read ai_config" ON public.ai_config
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update ai_config" ON public.ai_config
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Insert default config
INSERT INTO public.ai_config (id, max_tokens, temperature, allowed_models, blocked_topics, requires_citation, max_requests_per_day)
VALUES (1, 500, 0.7, ARRAY['gpt-3.5-turbo', 'gpt-4'], ARRAY[]::TEXT[], true, 50)
ON CONFLICT (id) DO NOTHING;
