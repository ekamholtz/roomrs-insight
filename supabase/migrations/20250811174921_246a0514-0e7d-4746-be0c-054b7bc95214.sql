-- 1) Add entry_date column to transactions
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS entry_date date;

-- 2) Backfill entry_date from extra_json->>'source_entry_date' when available,
--    otherwise fall back to period_start, then period_month
UPDATE public.transactions
SET entry_date = COALESCE(
  NULLIF(extra_json->>'source_entry_date','')::date,
  period_start,
  period_month
)
WHERE entry_date IS NULL;

-- 3) Deduplicate existing rows on the business key (room_id, account_name, entry_date, amount),
--    keeping the earliest created_at record
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY room_id, account_name, entry_date, amount
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.transactions
  WHERE room_id IS NOT NULL
    AND account_name IS NOT NULL
    AND entry_date IS NOT NULL
    AND amount IS NOT NULL
)
DELETE FROM public.transactions t
USING ranked r
WHERE t.id = r.id
  AND r.rn > 1;

-- 4) Enforce uniqueness going forward
CREATE UNIQUE INDEX IF NOT EXISTS transactions_unique_room_account_entrydate_amount
ON public.transactions (room_id, account_name, entry_date, amount);
