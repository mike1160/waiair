-- Live Flight Share sessions (public waiair.app/live/{shareCode})
create table if not exists live_shares (
  id uuid primary key default gen_random_uuid(),
  share_code text unique not null,
  flight_number text not null,
  sender_name text,
  custom_message text,
  origin_iata text,
  dest_iata text,
  origin_city text,
  dest_city text,
  airline text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists live_shares_code_idx on live_shares (share_code);
create index if not exists live_shares_expires_idx on live_shares (expires_at);

alter table live_shares enable row level security;

create policy "live share read" on live_shares for select using (expires_at > now());
create policy "live share insert" on live_shares for insert with check (true);
