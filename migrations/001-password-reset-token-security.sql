BEGIN;

ALTER TABLE password_reset_tokens
  ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE password_reset_tokens
  ALTER COLUMN code TYPE VARCHAR(64) USING code::text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'password_reset_tokens_failed_attempts_nonnegative'
      AND conrelid = 'password_reset_tokens'::regclass
  ) THEN
    ALTER TABLE password_reset_tokens
      ADD CONSTRAINT password_reset_tokens_failed_attempts_nonnegative
      CHECK (failed_attempts >= 0);
  END IF;
END
$$;

COMMIT;
