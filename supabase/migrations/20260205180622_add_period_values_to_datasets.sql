/*
  # Add Period Values to Datasets

  1. Changes
    - Add `period_values` column to `datasets` table to store multi-period configuration
    - This includes start/end values for each period and the end date
    - Column is nullable to maintain compatibility with simple calculator datasets
  
  2. Notes
    - JSONB format allows flexible storage of period configuration
    - Simple calculator datasets will have null period_values
    - Multi-period datasets will store oneYear, fiveYear, tenYear values and endDate
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'datasets' AND column_name = 'period_values'
  ) THEN
    ALTER TABLE datasets ADD COLUMN period_values jsonb DEFAULT NULL;
  END IF;
END $$;