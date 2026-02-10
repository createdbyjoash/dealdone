-- DealDone Relational Database Schema v2 (Migration Script)
-- WARNING: This will drop existing tables and data to reset the schema.

-- Clear existing relations to prevent 42P07 errors
drop table if exists saved_searches cascade;
drop table if exists saved_businesses cascade;
drop table if exists documents cascade;
drop table if exists messages cascade;
drop table if exists deal_pipeline cascade;
drop table if exists businesses cascade;
drop table if exists profiles cascade;

-- 1. Profiles Table (Extends auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  user_type text check (user_type in ('owner', 'buyer')),
  pof_status text default 'unverified' check (pof_status in ('unverified', 'pending', 'verified')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Businesses Table
create table businesses (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  owner_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  industry text not null,
  revenue numeric default 0,
  valuation numeric default 0,
  description text,
  is_active boolean default true
);

-- 3. Deal Pipeline (Matches & NDA Status)
create table deal_pipeline (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  business_id uuid references businesses(id) on delete cascade not null,
  buyer_id uuid references profiles(id) on delete cascade not null,
  stage text default 'Inquiry' check (stage in ('Inquiry', 'NDA', 'DD', 'LOI', 'Closing')),
  nda_signed boolean default false,
  nda_signed_at timestamp with time zone,
  
  -- Prevent duplicate matches for the same buyer/business
  unique(business_id, buyer_id)
);

-- 4. Messages Table
create table messages (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  receiver_id uuid references profiles(id) on delete cascade not null,
  business_id uuid references businesses(id) on delete set null, -- Optional: context for the message
  content text not null,
  is_read boolean default false
);

-- 5. Documents (Secure Data Room)
create table documents (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  business_id uuid references businesses(id) on delete cascade not null,
  name text not null,
  file_url text not null,
  is_confidential boolean default true -- If true, requires nda_signed in deal_pipeline
);

-- 6. Saved Businesses (Favorites)
create table saved_businesses (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references profiles(id) on delete cascade not null,
  business_id uuid references businesses(id) on delete cascade not null,
  
  unique(user_id, business_id)
);

-- 7. Saved Searches (Alerts)
create table saved_searches (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references profiles(id) on delete cascade not null,
  industry text,
  max_price numeric,
  keywords text
);

-- --- SECURITY: Row Level Security (RLS) ---

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table businesses enable row level security;
alter table deal_pipeline enable row level security;
alter table messages enable row level security;
alter table documents enable row level security;
alter table saved_businesses enable row level security;
alter table saved_searches enable row level security;

-- PROFILES Policies
create policy "Public profiles are viewable by authenticated users" 
  on profiles for select using (auth.role() = 'authenticated');
create policy "Users can update their own profiles" 
  on profiles for update using (auth.uid() = id);

-- BUSINESSES Policies
create policy "Anyone can view active businesses" 
  on businesses for select using (is_active = true);
create policy "Owners can manage their own businesses" 
  on businesses for all using (auth.uid() = owner_id);

-- PIPELINE Policies
create policy "Buyers and Owners can view their shared deal pipeline" 
  on deal_pipeline for select using (
    auth.uid() = buyer_id or 
    exists (select 1 from businesses where id = business_id and owner_id = auth.uid())
  );
create policy "Buyers can initiate a pipeline entry" 
  on deal_pipeline for insert with check (auth.uid() = buyer_id);

-- MESSAGES Policies
create policy "Users can view their own messages" 
  on messages for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "Users can send messages" 
  on messages for insert with check (auth.uid() = sender_id);

-- DOCUMENTS (Data Room) Policies
create policy "Public documents are viewable" 
  on documents for select using (is_confidential = false);
create policy "Confidential documents viewable after NDA signed or by owner" 
  on documents for select using (
    exists (select 1 from businesses where id = business_id and owner_id = auth.uid()) or
    exists (select 1 from deal_pipeline where business_id = documents.business_id and buyer_id = auth.uid() and nda_signed = true)
  );

-- SAVED BUSINESSES Policies
create policy "Users can manage their saved businesses" 
  on saved_businesses for all using (auth.uid() = user_id);

-- SAVED SEARCHES Policies
create policy "Users can manage their saved searches" 
  on saved_searches for all using (auth.uid() = user_id);

-- --- AUTOMATION: Auth Triggers ---
-- Automatically create a profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, user_type)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'type');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
