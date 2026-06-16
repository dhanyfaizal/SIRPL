-- Migration: Add semester column to mata_kuliah_kurikulum
-- This column stores which semester (1-8) each course is offered in.

ALTER TABLE mata_kuliah_kurikulum
ADD COLUMN IF NOT EXISTS semester INTEGER DEFAULT 1;
