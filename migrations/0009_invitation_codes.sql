CREATE TABLE invitation_codes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  revoked_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_by  TEXT NOT NULL REFERENCES users(id)
);

CREATE INDEX idx_invitation_codes_code ON invitation_codes(code);
