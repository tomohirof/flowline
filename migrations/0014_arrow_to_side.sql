-- Issue #355: 矢印に入口側 (toSide) を持たせる
-- diamond/四角形どちらでも意味を持つ。NULL は自動（既存ロジック）。
ALTER TABLE arrows ADD COLUMN to_side TEXT;
