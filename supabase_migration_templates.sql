-- Create cover_letter_templates table in Supabase
-- This table stores user's custom cover letter templates

CREATE TABLE IF NOT EXISTS cover_letter_templates (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE cover_letter_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Users can only see their own templates
CREATE POLICY "Users can view their own templates"
  ON cover_letter_templates
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own templates
CREATE POLICY "Users can insert their own templates"
  ON cover_letter_templates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own templates
CREATE POLICY "Users can update their own templates"
  ON cover_letter_templates
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own templates
CREATE POLICY "Users can delete their own templates"
  ON cover_letter_templates
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_cover_letter_templates_user_id ON cover_letter_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_cover_letter_templates_updated_at ON cover_letter_templates(updated_at DESC);
