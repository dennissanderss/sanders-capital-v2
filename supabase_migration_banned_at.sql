-- Add banned_at column to profiles table for user banning
-- Run this in Supabase SQL Editor
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ DEFAULT NULL;
