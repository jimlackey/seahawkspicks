-- Seahawks Score Picks — Supabase schema v2
-- Adds the pool/auth system (mirroring the World Cup Pick'em app's
-- structure: pools, participants, memberships, whitelist, OTP login,
-- sessions, access requests, audit log) and re-scopes games/picks under it.
--
-- Run this in a fresh Supabase project's SQL editor. If you already ran
-- the original schema.sql (Step 4) and have real data, see the migration
-- note at the bottom instead of running this directly.

create extension if not exists citext;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Pool / auth system (parity with World Cup Pick'em)
-- ---------------------------------------------------------------------

create table if not exists pools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists pool_memberships (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  role text not null default 'player' check (role in ('admin', 'player')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (pool_id, participant_id)
);

create table if not exists pool_whitelist (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  email citext not null,
  created_at timestamptz not null default now(),
  unique (pool_id, email)
);

create table if not exists otp_requests (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  pool_id uuid not null references pools(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  attempts int not null default 0,
  ip_address text,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists access_requests (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  email citext not null,
  referral text,
  token text not null unique,
  granted boolean not null default false,
  granted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null default now(),
  pool_id uuid not null references pools(id) on delete cascade,
  actor_id uuid references participants(id) on delete set null,
  actor_email text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  new_value jsonb
);

-- ---------------------------------------------------------------------
-- Domain tables (Steps 1-4), now scoped under a pool
-- ---------------------------------------------------------------------

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  season int not null,
  week int not null,
  opponent text not null,
  home boolean not null,
  commence_time timestamptz not null,
  spread numeric,
  total numeric,
  hawks_score int,
  opp_score int,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (pool_id, season, week)
);

create table if not exists picks (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  season int not null,
  week int not null,
  participant_id uuid not null references participants(id) on delete cascade,
  hawks_score int not null,
  opp_score int not null,
  -- Inferred from the picked score vs. the game's total line (see
  -- inferOverUnder in src/lib/scoring.js) — not a separate manual choice,
  -- so it's nullable (no line synced yet) and allows 'Push' (exact tie).
  ou_pick text check (ou_pick in ('Over', 'Under', 'Push')),
  submitted_at timestamptz not null default now(),
  unique (pool_id, season, week, participant_id)
);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
-- Unlike the Step 4 schema, this version locks RLS all the way down.
-- ALL reads and writes go through the /api/* serverless functions using
-- the service-role key (which bypasses RLS by design) — the anon key is
-- still shipped to the browser (Supabase's normal model), but these
-- policies mean it can't do anything on its own. Session validation and
-- authorization (e.g. "can only submit your own pick") happen in the API
-- layer instead of in RLS policies.

alter table pools enable row level security;
alter table participants enable row level security;
alter table pool_memberships enable row level security;
alter table pool_whitelist enable row level security;
alter table otp_requests enable row level security;
alter table sessions enable row level security;
alter table access_requests enable row level security;
alter table audit_log enable row level security;
alter table games enable row level security;
alter table picks enable row level security;

-- No policies created = default-deny for the anon/authenticated roles.
-- (Supabase's service_role key bypasses RLS entirely, which is what the
-- API layer uses.)

-- ---------------------------------------------------------------------
-- Seed: create the Seahawks pool itself (one row — this app only ever
-- serves one pool, unlike World Cup's multi-pool design, but the schema
-- stays pool-shaped for consistency/future reuse).
-- ---------------------------------------------------------------------

insert into pools (name, slug)
values ('Seahawks Score Picks', 'seahawks')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Migrating from the Step 4 schema (schema.sql)?
-- ---------------------------------------------------------------------
-- That version's `games`/`picks` tables aren't pool-scoped and use a
-- free-text `player` column instead of `participant_id`. There's no
-- automatic migration here since it depends on whether you have real
-- picks data worth preserving yet. If you do, let me know and I'll write
-- a one-off migration script; if not, simplest is to drop those two
-- tables and let this file recreate them.
