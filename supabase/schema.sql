-- АвтоПомощник KZ: Supabase schema
-- Run in Supabase Dashboard -> SQL Editor. Never put the service_role key in the Android app.

create extension if not exists pgcrypto;

create or replace function public.is_admin()
returns boolean
language sql stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  phone text not null default '',
  account_role text not null default 'owner' check (account_role in ('owner','mechanic')),
  city text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mechanic_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text not null,
  phone text not null,
  city text not null,
  address text not null,
  services text[] not null default '{}',
  car_brands text[] not null default '{}',
  working_hours text not null default '',
  description text not null default '',
  photos text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','active','blocked')),
  is_featured boolean not null default false,
  featured_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  make text not null,
  model text not null,
  year integer check (year between 1950 and 2100),
  mileage integer not null default 0 check (mileage >= 0),
  engine text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  vehicle_label text not null default '',
  work text not null,
  mileage integer not null default 0 check (mileage >= 0),
  service_date date,
  cost_kzt integer not null default 0 check (cost_kzt >= 0),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.mechanic_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  mechanic_id uuid not null references public.mechanic_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, mechanic_id)
);

create table if not exists public.mechanic_reviews (
  id uuid primary key default gen_random_uuid(),
  mechanic_id uuid not null references public.mechanic_listings(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review_text text not null default '',
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  unique (mechanic_id, author_id)
);

create index if not exists mechanic_listings_city_status_idx on public.mechanic_listings(city, status);
create index if not exists maintenance_records_user_date_idx on public.maintenance_records(user_id, service_date desc);
create index if not exists mechanic_reviews_mechanic_idx on public.mechanic_reviews(mechanic_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists mechanic_listings_set_updated_at on public.mechanic_listings;
create trigger mechanic_listings_set_updated_at before update on public.mechanic_listings
for each row execute function public.set_updated_at();

-- Create a profile for each new account. The role is always owner initially.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, phone, account_role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    'owner'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.mechanic_listings enable row level security;
alter table public.vehicles enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.mechanic_favorites enable row level security;
alter table public.mechanic_reviews enable row level security;

-- Profiles: users can read/update only their own profile.
drop policy if exists "profile read own" on public.profiles;
create policy "profile read own" on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());
drop policy if exists "profile update own" on public.profiles;
create policy "profile update own" on public.profiles for update to authenticated
using (id = auth.uid() or public.is_admin())
with check ((id = auth.uid() and account_role in ('owner','mechanic')) or public.is_admin());
drop policy if exists "profile insert own" on public.profiles;
create policy "profile insert own" on public.profiles for insert to authenticated
with check (id = auth.uid() and account_role = 'owner');

-- Public can see only active mechanic listings. Owners can create/edit their own listing,
-- but every owner edit returns it to pending moderation. Only admins can publish/block.
drop policy if exists "active listings public read" on public.mechanic_listings;
create policy "active listings public read" on public.mechanic_listings for select
using (status = 'active' or user_id = auth.uid() or public.is_admin());
drop policy if exists "mechanic create own listing" on public.mechanic_listings;
create policy "mechanic create own listing" on public.mechanic_listings for insert to authenticated
with check (user_id = auth.uid() and status = 'pending' and is_featured = false);
drop policy if exists "mechanic update own listing" on public.mechanic_listings;
create policy "mechanic update own listing" on public.mechanic_listings for update to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (
  public.is_admin()
  or (user_id = auth.uid() and status = 'pending' and is_featured = false)
);
drop policy if exists "mechanic delete own listing" on public.mechanic_listings;
create policy "mechanic delete own listing" on public.mechanic_listings for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Vehicle and service history are private to the account owner.
drop policy if exists "vehicles owner access" on public.vehicles;
create policy "vehicles owner access" on public.vehicles for all to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "maintenance owner access" on public.maintenance_records;
create policy "maintenance owner access" on public.maintenance_records for all to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "favorites owner access" on public.mechanic_favorites;
create policy "favorites owner access" on public.mechanic_favorites for all to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

-- Reviews are visible publicly when marked visible. A user can create one review per mechanic.
drop policy if exists "visible reviews public read" on public.mechanic_reviews;
create policy "visible reviews public read" on public.mechanic_reviews for select
using (is_visible = true or author_id = auth.uid() or public.is_admin());
drop policy if exists "users create own review" on public.mechanic_reviews;
create policy "users create own review" on public.mechanic_reviews for insert to authenticated
with check (author_id = auth.uid() and is_visible = true);
drop policy if exists "users edit own review" on public.mechanic_reviews;
create policy "users edit own review" on public.mechanic_reviews for update to authenticated
using (author_id = auth.uid() or public.is_admin())
with check ((author_id = auth.uid() and is_visible = true) or public.is_admin());
drop policy if exists "users delete own review" on public.mechanic_reviews;
create policy "users delete own review" on public.mechanic_reviews for delete to authenticated
using (author_id = auth.uid() or public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.mechanic_listings, public.mechanic_reviews to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.vehicles, public.maintenance_records, public.mechanic_favorites, public.mechanic_reviews to authenticated;
grant insert, update, delete on public.mechanic_listings to authenticated;
