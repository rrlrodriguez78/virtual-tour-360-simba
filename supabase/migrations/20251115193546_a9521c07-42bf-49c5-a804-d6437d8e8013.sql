-- Add is_publicly_listed column to virtual_tours table
ALTER TABLE virtual_tours 
ADD COLUMN is_publicly_listed boolean DEFAULT false;

-- Create index for better performance
CREATE INDEX idx_virtual_tours_publicly_listed 
ON virtual_tours(is_publicly_listed) 
WHERE is_publicly_listed = true;

-- Migrate existing published tours to be publicly listed (maintain current behavior)
UPDATE virtual_tours 
SET is_publicly_listed = is_published 
WHERE is_published = true;

-- Add comment for documentation
COMMENT ON COLUMN virtual_tours.is_publicly_listed IS 'When true and is_published=true, tour appears in Public Tours page. When false and is_published=true, tour is only accessible via shared link.';