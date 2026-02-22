-- Add styling columns to nodes table
ALTER TABLE nodes ADD COLUMN bg TEXT;
ALTER TABLE nodes ADD COLUMN stroke_color TEXT;
ALTER TABLE nodes ADD COLUMN dash TEXT;

-- Add styling columns to arrows table
ALTER TABLE arrows ADD COLUMN color TEXT;
ALTER TABLE arrows ADD COLUMN dash TEXT;
