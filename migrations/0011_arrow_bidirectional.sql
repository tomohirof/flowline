-- Add bidirectional flag to arrows table
ALTER TABLE arrows ADD COLUMN bidirectional INTEGER DEFAULT 0;
