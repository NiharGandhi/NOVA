-- Add response_templates column to ai_config table
ALTER TABLE public.ai_config
ADD COLUMN IF NOT EXISTS response_templates JSONB[] DEFAULT ARRAY[]::JSONB[];

-- Update existing row with default templates
UPDATE public.ai_config
SET response_templates = ARRAY[
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
WHERE id = 1;
