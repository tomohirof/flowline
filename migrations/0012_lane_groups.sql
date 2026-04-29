-- 0012: Add group_id / group_role columns to lanes for merged-lane persistence (issue #309)
ALTER TABLE lanes ADD COLUMN group_id TEXT;
ALTER TABLE lanes ADD COLUMN group_role TEXT CHECK(group_role IN ('parent','sub'));
CREATE INDEX IF NOT EXISTS idx_lanes_group_id ON lanes(group_id) WHERE group_id IS NOT NULL;
