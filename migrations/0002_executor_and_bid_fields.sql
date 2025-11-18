BEGIN;

ALTER TABLE tasks RENAME COLUMN assignee_id TO executor_id;
ALTER TABLE tasks RENAME COLUMN assignee_name TO executor_name;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS done_at timestamp;

ALTER TABLE auction_bids RENAME COLUMN bid_amount TO value_money;
ALTER TABLE auction_bids ALTER COLUMN value_money DROP NOT NULL;
ALTER TABLE auction_bids ADD COLUMN IF NOT EXISTS value_time_minutes integer;
ALTER TABLE auction_bids ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
UPDATE auction_bids SET is_active = true WHERE is_active IS NULL;
ALTER TABLE auction_bids ALTER COLUMN is_active SET NOT NULL;

COMMIT;
