-- Migration to add Supabase Auth ownership to existing Stockeye database.
-- Run this in the Supabase SQL Editor.

-- 1. Add owner_id referencing auth.users to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS stores_owner_idx ON stores(owner_id);

-- 2. Ensure RLS is enabled
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_events ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if re-running
DROP POLICY IF EXISTS "Owners can manage own store" ON stores;
DROP POLICY IF EXISTS "Public can view published stores" ON stores;
DROP POLICY IF EXISTS "Owners can manage own store products" ON products;
DROP POLICY IF EXISTS "Public can view published store products" ON products;
DROP POLICY IF EXISTS "Owners can manage own store inventory events" ON inventory_events;

-- 4. Re-create owner & public access policies
CREATE POLICY "Owners can manage own store" ON stores
  FOR ALL USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Public can view published stores" ON stores
  FOR SELECT USING (published_at IS NOT NULL);

CREATE POLICY "Owners can manage own store products" ON products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = products.store_id
      AND stores.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = products.store_id
      AND stores.owner_id = auth.uid()
    )
  );

CREATE POLICY "Public can view published store products" ON products
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = products.store_id
      AND stores.published_at IS NOT NULL
    )
  );

CREATE POLICY "Owners can manage own store inventory events" ON inventory_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = inventory_events.store_id
      AND stores.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = inventory_events.store_id
      AND stores.owner_id = auth.uid()
    )
  );
