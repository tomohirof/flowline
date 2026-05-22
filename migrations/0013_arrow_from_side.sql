-- Issue #349: 矢印に出口側 (fromSide) を持たせる
-- diamond ノードのみ意味を持つ。NULL は自動（既存ロジック）。
ALTER TABLE arrows ADD COLUMN from_side TEXT;
