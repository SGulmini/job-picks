-- Migration: Add cv_custom_phrases column to existing candidate_profiles table
-- Run this SQL in your Supabase SQL Editor if you already have the candidate_profiles table

-- Add the cv_custom_phrases column (if it doesn't exist)
ALTER TABLE candidate_profiles 
ADD COLUMN IF NOT EXISTS cv_custom_phrases JSONB;

-- The column is nullable, so existing rows will have NULL
-- This is fine - the application will handle empty arrays as default
