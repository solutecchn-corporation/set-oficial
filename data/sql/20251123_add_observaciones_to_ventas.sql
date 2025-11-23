-- Migration: add observaciones column to ventas
-- Created by assistant on 2025-11-23
ALTER TABLE IF EXISTS ventas
  ADD COLUMN IF NOT EXISTS observaciones TEXT;

-- Optional: initialize existing rows to NULL (already default)
-- You can run this file against your Postgres/Supabase DB.
