-- dayly. – Datenbankschema
-- Ausführen: Supabase Dashboard -> SQL Editor -> New query -> Inhalt einfügen -> Run
-- Der Zugriff läuft ausschließlich über den Server (service_role-Schlüssel).
-- Row Level Security ist aktiv und es gibt bewusst KEINE Policies:
-- der öffentliche anon-Schlüssel kann damit nichts lesen oder schreiben.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- Aufgaben
create table if not exists public.tasks (
  id                       uuid primary key default gen_random_uuid(),
  title                    text not null check (char_length(btrim(title)) between 1 and 300),
  notes                    text check (notes is null or char_length(notes) <= 4000),
  category                 text not null check (category in ('business', 'private')),
  kind                     text not null check (kind in ('daily', 'weekly')),
  date                     date,            -- nur daily
  week_start               date,            -- nur weekly, immer ein Montag
  time                     time,            -- nur daily
  due_at                   timestamptz,
  priority                 smallint check (priority between 1 and 3),
  estimated_minutes        integer check (estimated_minutes > 0),
  context_tags             text[] not null default '{}',
  status                   text not null default 'open' check (status in ('open', 'done')),
  completed_at             timestamptz,
  original_scheduled_date  date,            -- daily: ursprünglicher Tag, bleibt beim Verschieben
  original_week_start      date,            -- weekly: ursprüngliche Zielwoche, bleibt beim Verschieben
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  version                  integer not null default 1,
  constraint tasks_kind_fields check (
    (kind = 'daily'  and date is not null and week_start is null and original_week_start is null)
    or
    (kind = 'weekly' and week_start is not null and date is null and time is null
       and original_scheduled_date is null and extract(isodow from week_start) = 1)
  )
);

create index if not exists tasks_date_idx   on public.tasks (date) where kind = 'daily';
create index if not exists tasks_week_idx   on public.tasks (week_start) where kind = 'weekly';
create index if not exists tasks_open_idx   on public.tasks (status) where status = 'open';

-- ------------------------------------------------------------ Benachrichtigungen
create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  task_id        uuid not null references public.tasks (id) on delete cascade,
  type           text not null default 'open_21_days' check (type in ('open_21_days')),
  original_week  text not null,        -- z. B. 2026-W17
  original_date  date not null,        -- Ausgangspunkt der 21 Tage
  created_at     timestamptz not null default now(),
  read_at        timestamptz,
  dismissed_at   timestamptz,
  resolved_at    timestamptz
);

-- Höchstens eine aktive Erinnerung je Aufgabe und Typ -> mehrfaches Prüfen erzeugt keine Duplikate.
create unique index if not exists notifications_one_active_per_task
  on public.notifications (task_id, type)
  where resolved_at is null and dismissed_at is null;

-- ------------------------------------------------------------------ Verlauf / Undo
create table if not exists public.task_events (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null,                       -- bewusst ohne FK: bleibt nach dem Löschen erhalten
  type        text not null check (type in ('create', 'update', 'delete')),
  source      text not null default 'user' check (source in ('user', 'ai', 'system')),
  batch_id    uuid,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now(),
  undone_at   timestamptz
);
create index if not exists task_events_task_idx  on public.task_events (task_id, created_at desc);
create index if not exists task_events_batch_idx on public.task_events (batch_id) where batch_id is not null;

-- ------------------------------------------------------------- Wochenrückblicke
create table if not exists public.weekly_reviews (
  week_start       date primary key check (extract(isodow from week_start) = 1),
  iso_year         integer not null,
  iso_week         integer not null,
  daily_total      integer not null,
  daily_done       integer not null,
  business_total   integer not null,
  business_done    integer not null,
  private_total    integer not null,
  private_done     integer not null,
  goals_total      integer not null,
  goals_done       integer not null,
  summary          text not null,
  rule_version     integer not null default 1,
  finalized_at     timestamptz not null default now()
);

-- ------------------------------------------------------------------- Einstellungen
create table if not exists public.settings (
  id               integer primary key check (id = 1),
  carry_over_open  boolean not null default false,
  updated_at       timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict do nothing;

-- ------------------------------------------------------------ Zugriff absichern
alter table public.tasks           enable row level security;
alter table public.notifications   enable row level security;
alter table public.task_events     enable row level security;
alter table public.weekly_reviews  enable row level security;
alter table public.settings        enable row level security;

revoke all on public.tasks, public.notifications, public.task_events, public.weekly_reviews, public.settings from anon, authenticated;
