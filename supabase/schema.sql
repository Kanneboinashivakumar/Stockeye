-- Stockeye schema. Run once in the Supabase SQL editor.
-- All access goes through server routes using the service-role key or authenticated user sessions.
-- RLS is enabled with store-owner policies and public read for published stores.

create extension if not exists "pgcrypto";

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  store_name text not null,
  vendor_name text not null,
  phone text not null,
  city text,
  language text not null default 'en',
  owner_token text not null default encode(gen_random_bytes(24), 'hex'),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stores_owner_idx on stores(owner_id);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  name_normalized text not null,
  brand text,
  variant text,
  size text,
  category text,
  price numeric(10,2) check (price is null or price >= 0),
  stock integer check (stock is null or stock >= 0),
  confidence numeric(3,2) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source text not null default 'camera' check (source in ('camera','voice','manual')),
  status text not null default 'detected' check (status in ('detected','confirmed','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_store_idx on products(store_id);
create index if not exists products_store_name_idx on products(store_id, name_normalized);

create table if not exists inventory_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  event_type text not null check (event_type in (
    'product_added','product_confirmed','price_updated','stock_updated',
    'details_updated','product_removed','store_published'
  )),
  old_value text,
  new_value text,
  source text not null default 'camera' check (source in ('camera','voice','manual')),
  created_at timestamptz not null default now()
);

create index if not exists events_store_time_idx on inventory_events(store_id, created_at desc);

-- Enable Row Level Security
alter table stores enable row level security;
alter table products enable row level security;
alter table inventory_events enable row level security;

-- Stores policies
create policy "Owners can manage own store" on stores
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Public can view published stores" on stores
  for select using (published_at is not null);

-- Products policies
create policy "Owners can manage own store products" on products
  for all using (
    exists (
      select 1 from stores
      where stores.id = products.store_id
      and stores.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from stores
      where stores.id = products.store_id
      and stores.owner_id = auth.uid()
    )
  );

create policy "Public can view published store products" on products
  for select using (
    exists (
      select 1 from stores
      where stores.id = products.store_id
      and stores.published_at is not null
    )
  );

-- Inventory events policies
create policy "Owners can manage own store inventory events" on inventory_events
  for all using (
    exists (
      select 1 from stores
      where stores.id = inventory_events.store_id
      and stores.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from stores
      where stores.id = inventory_events.store_id
      and stores.owner_id = auth.uid()
    )
  );
