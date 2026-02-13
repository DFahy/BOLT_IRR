/*
  # Cash Flow Storage Schema

  1. New Tables
    - `datasets`
      - `id` (uuid, primary key) - Unique identifier for each dataset
      - `user_id` (uuid, foreign key) - References auth.users
      - `name` (text) - User-friendly name for the dataset
      - `description` (text, nullable) - Optional description
      - `created_at` (timestamptz) - When the dataset was created
      - `updated_at` (timestamptz) - Last modification time
    
    - `cash_flows`
      - `id` (uuid, primary key) - Unique identifier for each cash flow
      - `dataset_id` (uuid, foreign key) - References datasets table
      - `date` (date) - Date of the cash flow
      - `amount` (numeric) - Amount of the cash flow (positive or negative)
      - `description` (text) - Description of the cash flow
      - `sort_order` (integer) - Order in which flows should be displayed

  2. Security
    - Enable RLS on both tables
    - Users can only access their own datasets
    - Cash flows are accessible through dataset ownership
    - Policies for SELECT, INSERT, UPDATE, DELETE operations
*/

-- Create datasets table
CREATE TABLE IF NOT EXISTS datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create cash_flows table
CREATE TABLE IF NOT EXISTS cash_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid REFERENCES datasets(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  amount numeric NOT NULL,
  description text DEFAULT '',
  sort_order integer DEFAULT 0
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_datasets_user_id ON datasets(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_flows_dataset_id ON cash_flows(dataset_id);

-- Enable Row Level Security
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flows ENABLE ROW LEVEL SECURITY;

-- Datasets policies
CREATE POLICY "Users can view own datasets"
  ON datasets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own datasets"
  ON datasets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own datasets"
  ON datasets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own datasets"
  ON datasets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Cash flows policies (access through dataset ownership)
CREATE POLICY "Users can view cash flows of own datasets"
  ON cash_flows FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM datasets
      WHERE datasets.id = cash_flows.dataset_id
      AND datasets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert cash flows to own datasets"
  ON cash_flows FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM datasets
      WHERE datasets.id = cash_flows.dataset_id
      AND datasets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update cash flows of own datasets"
  ON cash_flows FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM datasets
      WHERE datasets.id = cash_flows.dataset_id
      AND datasets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM datasets
      WHERE datasets.id = cash_flows.dataset_id
      AND datasets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete cash flows of own datasets"
  ON cash_flows FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM datasets
      WHERE datasets.id = cash_flows.dataset_id
      AND datasets.user_id = auth.uid()
    )
  );