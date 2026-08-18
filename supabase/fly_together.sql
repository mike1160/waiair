-- Fly Together groups (reuses flight_races table). Enable Realtime on flight_race_participants.
-- Groups expire after 48 hours. Max 8 participants per group.

alter table if exists flight_races add column if not exists group_name text;

create table if not exists flight_races (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  group_name text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists flight_race_participants (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references flight_races(id) on delete cascade,
  device_id text not null,
  display_name text not null,
  flight_number text not null,
  origin_iata text,
  dest_iata text,
  origin_lat double precision,
  origin_lon double precision,
  dest_lat double precision,
  dest_lon double precision,
  scheduled_time timestamptz,
  status text not null default 'scheduled',
  eta_iso text,
  landed_at_iso text,
  lat double precision,
  lon double precision,
  delay_min integer not null default 0,
  progress_pct double precision not null default 0,
  joined_at timestamptz not null default now(),
  unique (race_id, device_id)
);

create index if not exists flight_race_participants_race_id_idx
  on flight_race_participants (race_id);

alter table flight_races enable row level security;
alter table flight_race_participants enable row level security;

create policy "race read" on flight_races for select using (expires_at > now());
create policy "race insert" on flight_races for insert with check (true);
create policy "participant read" on flight_race_participants for select using (
  exists (select 1 from flight_races r where r.id = race_id and r.expires_at > now())
);
create policy "participant insert" on flight_race_participants for insert with check (
  exists (select 1 from flight_races r where r.id = race_id and r.expires_at > now())
);
create policy "participant update" on flight_race_participants for update using (true);
