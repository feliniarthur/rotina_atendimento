-- Rotina: estrutura inicial do banco Supabase (PostgreSQL)
create table if not exists public.team_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  client text not null default '',
  service_date date not null,
  owner_name text not null,
  priority text not null default 'normal' check (priority in ('baixa','normal','alta')),
  status text not null default 'aberto' check (status in ('aberto','concluido')),
  note text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.handoff_notes (
  id uuid primary key default gen_random_uuid(),
  service_date date not null,
  message text not null,
  owner_name text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id integer primary key default 1 check (id = 1),
  morning_attendant text not null default 'Atendente 1',
  full_day_attendant text not null default 'Atendente 2',
  absence_start date,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

alter table public.team_members enable row level security;
alter table public.entries enable row level security;
alter table public.handoff_notes enable row level security;
alter table public.app_settings enable row level security;

-- Permite executar este arquivo novamente sem falhar em políticas já existentes.
drop policy if exists "team members can read team" on public.team_members;
drop policy if exists "members can read own profile" on public.team_members;
drop policy if exists "team members can read entries" on public.entries;
drop policy if exists "team members can create entries" on public.entries;
drop policy if exists "team members can update entries" on public.entries;
drop policy if exists "team members can delete entries" on public.entries;
drop policy if exists "team members can read handoff notes" on public.handoff_notes;
drop policy if exists "team members can create handoff notes" on public.handoff_notes;
drop policy if exists "team members can read settings" on public.app_settings;
drop policy if exists "team members can update settings" on public.app_settings;

create policy "members can read own profile" on public.team_members for select to authenticated
  using (user_id = auth.uid());
create policy "team members can read entries" on public.entries for select to authenticated
  using (exists (select 1 from public.team_members me where me.user_id = auth.uid()));
create policy "team members can create entries" on public.entries for insert to authenticated
  with check (exists (select 1 from public.team_members me where me.user_id = auth.uid()));
create policy "team members can update entries" on public.entries for update to authenticated
  using (exists (select 1 from public.team_members me where me.user_id = auth.uid()))
  with check (exists (select 1 from public.team_members me where me.user_id = auth.uid()));
create policy "team members can delete entries" on public.entries for delete to authenticated
  using (exists (select 1 from public.team_members me where me.user_id = auth.uid()));
create policy "team members can read handoff notes" on public.handoff_notes for select to authenticated
  using (exists (select 1 from public.team_members me where me.user_id = auth.uid()));
create policy "team members can create handoff notes" on public.handoff_notes for insert to authenticated
  with check (exists (select 1 from public.team_members me where me.user_id = auth.uid()));
create policy "team members can read settings" on public.app_settings for select to authenticated
  using (exists (select 1 from public.team_members me where me.user_id = auth.uid()));
create policy "team members can update settings" on public.app_settings for update to authenticated
  using (exists (select 1 from public.team_members me where me.user_id = auth.uid()))
  with check (exists (select 1 from public.team_members me where me.user_id = auth.uid()));

grant select on public.team_members to authenticated;
grant select, insert, update, delete on public.entries to authenticated;
grant select, insert on public.handoff_notes to authenticated;
grant select, update on public.app_settings to authenticated;

-- Ativa atualização em tempo real para os dois computadores.
do $$
declare table_name text;
begin
  foreach table_name in array array['entries','handoff_notes','app_settings'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
