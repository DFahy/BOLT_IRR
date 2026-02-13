/*
  # Optimize RLS Policies for Performance

  ## Summary
  This migration optimizes Row Level Security policies to prevent performance degradation at scale.
  
  ## Changes Made
  
  ### Performance Optimization
  - Replaces all `auth.uid()` calls with `(select auth.uid())` in RLS policies
  - This prevents the auth function from being re-evaluated for each row
  - Significantly improves query performance on large datasets
  
  ### Tables Updated
  - `datasets` table: 4 policies updated (SELECT, INSERT, UPDATE, DELETE)
  - `cash_flows` table: 4 policies updated (SELECT, INSERT, UPDATE, DELETE)
  
  ## Technical Details
  
  Without the SELECT wrapper, auth.uid() is evaluated once per row, causing:
  - Unnecessary function calls
  - Slower query execution
  - Poor performance at scale
  
  With the SELECT wrapper, auth.uid() is evaluated once per query, providing:
  - Optimal performance
  - Faster query execution
  - Better scalability
  
  ## References
  - https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
*/

-- Drop existing policies for datasets table
DROP POLICY IF EXISTS "Users can view own datasets" ON datasets;
DROP POLICY IF EXISTS "Users can insert own datasets" ON datasets;
DROP POLICY IF EXISTS "Users can update own datasets" ON datasets;
DROP POLICY IF EXISTS "Users can delete own datasets" ON datasets;

-- Drop existing policies for cash_flows table
DROP POLICY IF EXISTS "Users can view cash flows of own datasets" ON cash_flows;
DROP POLICY IF EXISTS "Users can insert cash flows to own datasets" ON cash_flows;
DROP POLICY IF EXISTS "Users can update cash flows of own datasets" ON cash_flows;
DROP POLICY IF EXISTS "Users can delete cash flows of own datasets" ON cash_flows;

-- Recreate optimized policies for datasets table
CREATE POLICY "Users can view own datasets"
  ON datasets FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own datasets"
  ON datasets FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own datasets"
  ON datasets FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own datasets"
  ON datasets FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Recreate optimized policies for cash_flows table
CREATE POLICY "Users can view cash flows of own datasets"
  ON cash_flows FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM datasets
      WHERE datasets.id = cash_flows.dataset_id
      AND datasets.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert cash flows to own datasets"
  ON cash_flows FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM datasets
      WHERE datasets.id = cash_flows.dataset_id
      AND datasets.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update cash flows of own datasets"
  ON cash_flows FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM datasets
      WHERE datasets.id = cash_flows.dataset_id
      AND datasets.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM datasets
      WHERE datasets.id = cash_flows.dataset_id
      AND datasets.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete cash flows of own datasets"
  ON cash_flows FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM datasets
      WHERE datasets.id = cash_flows.dataset_id
      AND datasets.user_id = (select auth.uid())
    )
  );
