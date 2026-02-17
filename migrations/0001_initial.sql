PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS flows (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '無題のフロー',
  theme_id TEXT NOT NULL DEFAULT 'cloud',
  share_token TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS lanes (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color_index INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  lane_id TEXT NOT NULL REFERENCES lanes(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT '作業',
  note TEXT,
  order_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS arrows (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  from_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  to_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  comment TEXT
);

CREATE INDEX IF NOT EXISTS idx_flows_user_id ON flows(user_id);
CREATE INDEX IF NOT EXISTS idx_flows_share_token ON flows(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lanes_flow_id ON lanes(flow_id);
CREATE INDEX IF NOT EXISTS idx_nodes_flow_id ON nodes(flow_id);
CREATE INDEX IF NOT EXISTS idx_nodes_lane_id ON nodes(lane_id);
CREATE INDEX IF NOT EXISTS idx_arrows_flow_id ON arrows(flow_id);
