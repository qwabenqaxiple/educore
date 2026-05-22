-- Migration: Add Nursery and KG classes
-- Run this on an existing EduCore database to add the new class levels.

INSERT INTO classes (name, level, capacity) VALUES
  ('Nursery 1A',  'Nursery', 30),
  ('Nursery 1B',  'Nursery', 30),
  ('Nursery 2A',  'Nursery', 30),
  ('Nursery 2B',  'Nursery', 30),
  ('KG 1',        'KG',      35),
  ('KG 2',        'KG',      35)
ON CONFLICT DO NOTHING;
