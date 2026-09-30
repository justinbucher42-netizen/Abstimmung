-- =====================================================================
-- VoteFlow – Datenbankschema
-- Im Supabase Dashboard: SQL Editor -> New query -> Inhalt einfügen -> Run
-- (kann gefahrlos erneut ausgeführt werden)
--
-- Sicherheitskonzept:
--  * anon/authenticated dürfen Tabellen NUR LESEN (polls, poll_options, poll_results).
--  * Alle Schreibzugriffe laufen über SECURITY DEFINER Funktionen (RPC),
--    die Eingaben validieren, Rate-Limits prüfen und Doppelstimmen verhindern.
--  * Creator-Rechte: geheimes Admin-Token (nur SHA-256-Hash in poll_secrets,
--    diese Tabelle ist für API-Nutzer komplett unlesbar).
--  * votes (inkl. Namen/Voter-ID) ist nicht direkt lesbar -> echte Anonymität.
--  * Ergebnisse (poll_results) sind per RLS nur sichtbar, wenn die Abstimmung
--    Live-Ergebnisse erlaubt oder beendet ist.
-- =====================================================================

-- ---------- Tabellen ----------
create table if not exists public.polls (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  question        text not null check (char_length(question) between 3 and 200),
  description     text check (description is null or char_length(description) <= 1000),
  multiple_choice boolean not null default false,
  anonymous       boolean not null default true,
  show_results    boolean not null default true,
  is_public       boolean not null default true,
  status          text not null default 'open' check (status in ('open', 'closed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  expires_at      timestamptz
);

create table if not exists public.poll_options (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references public.polls(id) on delete cascade,
  text       text not null check (char_length(text) between 1 and 120),
  position   int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists poll_options_poll_idx on public.poll_options(poll_id, position);

create table if not exists public.votes (
  id               uuid primary key default gen_random_uuid(),
  poll_id          uuid not null references public.polls(id) on delete cascade,
  option_id        uuid not null references public.poll_options(id) on delete cascade,
  voter_identifier text not null check (char_length(voter_identifier) between 16 and 64),
  voter_name       text check (voter_name is null or char_length(voter_name) <= 40),
  created_at       timestamptz not null default now(),
  unique (poll_id, voter_identifier, option_id)
);
create index if not exists votes_poll_idx on public.votes(poll_id, created_at);

-- Denormalisierte Zähler (per Trigger gepflegt) -> Realtime-tauglich, ohne votes zu veröffentlichen
create table if not exists public.poll_results (
  option_id  uuid primary key references public.poll_options(id) on delete cascade,
  poll_id    uuid not null references public.polls(id) on delete cascade,
  vote_count int  not null default 0 check (vote_count >= 0)
);
create index if not exists poll_results_poll_idx on public.poll_results(poll_id);

-- Anzahl Teilnehmer je Abstimmung (bei Mehrfachauswahl != Summe der Optionsstimmen)
create table if not exists public.poll_stats (
  poll_id     uuid primary key references public.polls(id) on delete cascade,
  voter_count int not null default 0 check (voter_count >= 0)
);

-- Geheimnisse (Admin-Token-Hash). Keine Policies, keine Grants -> von der API aus nicht erreichbar.
create table if not exists public.poll_secrets (
  poll_id         uuid primary key references public.polls(id) on delete cascade,
  admin_token_hash bytea not null
);

-- Einfaches Rate-Limiting
create table if not exists public.rate_limits (
  key    text not null,
  bucket timestamptz not null,
  n      int not null default 0,
  primary key (key, bucket)
);

-- ---------- Trigger ----------
create or replace function public.trg_option_results() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.poll_results(option_id, poll_id, vote_count) values (new.id, new.poll_id, 0)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists option_results on public.poll_options;
create trigger option_results after insert on public.poll_options
  for each row execute function public.trg_option_results();

create or replace function public.trg_vote_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.poll_results set vote_count = vote_count + 1 where option_id = new.option_id;
  return new;
end $$;

drop trigger if exists vote_count on public.votes;
create trigger vote_count after insert on public.votes
  for each row execute function public.trg_vote_count();

-- ---------- Hilfsfunktionen ----------
create or replace function public.results_visible(p_poll_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.show_results or p.status = 'closed'
                          or (p.expires_at is not null and p.expires_at <= now())
                   from public.polls p where p.id = p_poll_id), false);
$$;

-- Rate-Limit pro Client-IP (Header von Supabase/PostgREST) und Aktion
create or replace function public.check_rate(p_action text, p_limit int, p_window_seconds int)
returns void language plpgsql security definer set search_path = public as $$
declare
  hdrs json;
  ip text;
  b timestamptz;
  cnt int;
begin
  begin
    hdrs := current_setting('request.headers', true)::json;
  exception when others then
    hdrs := null;
  end;
  ip := coalesce(split_part(hdrs->>'x-forwarded-for', ',', 1), hdrs->>'cf-connecting-ip', 'unknown');
  b := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits(key, bucket, n) values (p_action || ':' || trim(ip), b, 1)
    on conflict (key, bucket) do update set n = public.rate_limits.n + 1
    returning n into cnt;
  if cnt > p_limit then
    raise exception 'RATE_LIMIT: Zu viele Anfragen. Bitte kurz warten.' using errcode = 'P0001';
  end if;
  -- gelegentliches Aufräumen
  if random() < 0.02 then
    delete from public.rate_limits where bucket < now() - interval '2 hours';
  end if;
end $$;

create or replace function public.gen_poll_code() returns text
language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 Zeichen, ohne 0/O/1/I
  raw bytea;
  c text;
  i int;
begin
  loop
    raw := uuid_send(gen_random_uuid());  -- kryptografisch sicher (CSPRNG)
    c := '';
    for i in 0..5 loop
      c := c || substr(alphabet, (get_byte(raw, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.polls where code = c);
  end loop;
  return c;
end $$;

create or replace function public.assert_admin(p_code text, p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select p.id into pid
  from public.polls p join public.poll_secrets s on s.poll_id = p.id
  where p.code = upper(p_code)
    and p_token is not null and char_length(p_token) between 16 and 128
    and s.admin_token_hash = sha256(convert_to(p_token, 'UTF8'));
  if pid is null then
    raise exception 'FORBIDDEN: Keine Berechtigung für diese Abstimmung.' using errcode = 'P0001';
  end if;
  return pid;
end $$;

-- ---------- RPC: Erstellen ----------
create or replace function public.create_poll(
  p_question text, p_description text, p_options text[],
  p_multiple boolean, p_anonymous boolean, p_show_results boolean, p_is_public boolean,
  p_expires_at timestamptz, p_admin_token text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  q text := btrim(coalesce(p_question, ''));
  d text := nullif(btrim(coalesce(p_description, '')), '');
  opts text[];
  o text;
  pid uuid;
  code text;
  i int := 0;
begin
  perform public.check_rate('create', 20, 3600);

  if char_length(q) < 3 or char_length(q) > 200 then
    raise exception 'INVALID: Die Frage muss 3 bis 200 Zeichen lang sein.' using errcode = 'P0001';
  end if;
  if d is not null and char_length(d) > 1000 then
    raise exception 'INVALID: Beschreibung ist zu lang (max. 1000 Zeichen).' using errcode = 'P0001';
  end if;
  if p_admin_token is null or char_length(p_admin_token) not between 16 and 128 then
    raise exception 'INVALID: Ungültiges Admin-Token.' using errcode = 'P0001';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'INVALID: Das Enddatum muss in der Zukunft liegen.' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(btrim(x)), '{}') into opts
  from unnest(coalesce(p_options, '{}')) x where btrim(x) <> '';
  if array_length(opts, 1) is null or array_length(opts, 1) < 2 or array_length(opts, 1) > 30 then
    raise exception 'INVALID: Es werden 2 bis 30 Antwortmöglichkeiten benötigt.' using errcode = 'P0001';
  end if;
  foreach o in array opts loop
    if char_length(o) > 120 then
      raise exception 'INVALID: Antwortmöglichkeiten dürfen max. 120 Zeichen lang sein.' using errcode = 'P0001';
    end if;
  end loop;

  code := public.gen_poll_code();
  insert into public.polls(code, question, description, multiple_choice, anonymous, show_results, is_public, expires_at)
    values (code, q, d, coalesce(p_multiple, false), coalesce(p_anonymous, true),
            coalesce(p_show_results, true), coalesce(p_is_public, true), p_expires_at)
    returning id into pid;
  insert into public.poll_secrets(poll_id, admin_token_hash) values (pid, sha256(convert_to(p_admin_token, 'UTF8')));
  insert into public.poll_stats(poll_id, voter_count) values (pid, 0);
  foreach o in array opts loop
    insert into public.poll_options(poll_id, text, position) values (pid, o, i);
    i := i + 1;
  end loop;
  return code;
end $$;

-- ---------- RPC: Abstimmen ----------
create or replace function public.cast_vote(
  p_code text, p_option_ids uuid[], p_voter_id text, p_voter_name text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  p public.polls%rowtype;
  ids uuid[];
  n int;
  vname text := nullif(btrim(coalesce(p_voter_name, '')), '');
begin
  perform public.check_rate('vote', 60, 60);

  if p_voter_id is null or char_length(p_voter_id) not between 16 and 64 then
    raise exception 'INVALID: Ungültige Teilnehmer-ID.' using errcode = 'P0001';
  end if;
  if vname is not null and char_length(vname) > 40 then
    raise exception 'INVALID: Der Name darf max. 40 Zeichen lang sein.' using errcode = 'P0001';
  end if;

  select * into p from public.polls where code = upper(p_code) for update;
  if not found then
    raise exception 'NOT_FOUND: Abstimmung nicht gefunden.' using errcode = 'P0001';
  end if;
  if p.status <> 'open' or (p.expires_at is not null and p.expires_at <= now()) then
    raise exception 'CLOSED: Diese Abstimmung ist beendet.' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(distinct x), '{}') into ids from unnest(coalesce(p_option_ids, '{}')) x;
  if coalesce(array_length(ids, 1), 0) = 0 then
    raise exception 'INVALID: Bitte wähle mindestens eine Option.' using errcode = 'P0001';
  end if;
  if not p.multiple_choice and array_length(ids, 1) > 1 then
    raise exception 'INVALID: Es ist nur eine Auswahl erlaubt.' using errcode = 'P0001';
  end if;
  select count(*) into n from public.poll_options where poll_id = p.id and id = any(ids);
  if n <> array_length(ids, 1) then
    raise exception 'INVALID: Ungültige Option.' using errcode = 'P0001';
  end if;
  if not p.anonymous and vname is null then
    raise exception 'INVALID: Bitte gib deinen Namen an.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.votes where poll_id = p.id and voter_identifier = p_voter_id) then
    raise exception 'ALREADY_VOTED: Du hast bereits abgestimmt.' using errcode = 'P0001';
  end if;

  insert into public.votes(poll_id, option_id, voter_identifier, voter_name)
    select p.id, x, p_voter_id, case when p.anonymous then null else vname end from unnest(ids) x;
  update public.poll_stats set voter_count = voter_count + 1 where poll_id = p.id;
end $$;

-- ---------- RPC: Lesen (Zusatzdaten) ----------
create or replace function public.get_my_votes(p_code text, p_voter_id text) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(v.option_id), '{}')
  from public.votes v join public.polls p on p.id = v.poll_id
  where p.code = upper(p_code) and v.voter_identifier = p_voter_id;
$$;

create or replace function public.get_voters(p_code text)
returns table(option_id uuid, voter_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select v.option_id, v.voter_name, v.created_at
  from public.votes v join public.polls p on p.id = v.poll_id
  where p.code = upper(p_code) and not p.anonymous and public.results_visible(p.id)
  order by v.created_at desc limit 500;
$$;

create or replace function public.get_timeline(p_code text)
returns table(ts timestamptz, votes int)
language sql stable security definer set search_path = public as $$
  select v.created_at, 1
  from public.votes v join public.polls p on p.id = v.poll_id
  where p.code = upper(p_code) and public.results_visible(p.id)
  order by v.created_at limit 5000;
$$;

create or replace function public.get_stats() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'total_polls',  (select count(*) from public.polls),
    'active_polls', (select count(*) from public.polls
                     where status = 'open' and (expires_at is null or expires_at > now())),
    'closed_polls', (select count(*) from public.polls
                     where status = 'closed' or (expires_at is not null and expires_at <= now())),
    'total_votes',  (select count(distinct (poll_id, voter_identifier)) from public.votes)
  );
$$;

-- ---------- RPC: Admin ----------
create or replace function public.verify_admin(p_code text, p_token text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform public.check_rate('verify', 60, 60);
  perform public.assert_admin(p_code, p_token);
  return true;
exception when others then
  return false;
end $$;

create or replace function public.admin_set_status(p_code text, p_token text, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  perform public.check_rate('admin', 60, 60);
  if p_status not in ('open', 'closed') then
    raise exception 'INVALID: Ungültiger Status.' using errcode = 'P0001';
  end if;
  pid := public.assert_admin(p_code, p_token);
  -- Beim Wiedereröffnen einer abgelaufenen Abstimmung wird das Enddatum entfernt
  update public.polls set status = p_status, updated_at = now(),
    expires_at = case when p_status = 'open' and expires_at is not null and expires_at <= now() then null else expires_at end
  where id = pid;
end $$;

create or replace function public.admin_update_options(p_code text, p_token text, p_options text[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
  opts text[];
  o text;
  i int := 0;
begin
  perform public.check_rate('admin', 60, 60);
  pid := public.assert_admin(p_code, p_token);
  if exists (select 1 from public.votes where poll_id = pid) then
    raise exception 'INVALID: Optionen können nicht mehr geändert werden, sobald abgestimmt wurde.' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(btrim(x)), '{}') into opts
  from unnest(coalesce(p_options, '{}')) x where btrim(x) <> '';
  if array_length(opts, 1) is null or array_length(opts, 1) < 2 or array_length(opts, 1) > 30 then
    raise exception 'INVALID: Es werden 2 bis 30 Antwortmöglichkeiten benötigt.' using errcode = 'P0001';
  end if;
  foreach o in array opts loop
    if char_length(o) > 120 then
      raise exception 'INVALID: Antwortmöglichkeiten dürfen max. 120 Zeichen lang sein.' using errcode = 'P0001';
    end if;
  end loop;
  delete from public.poll_options where poll_id = pid;
  foreach o in array opts loop
    insert into public.poll_options(poll_id, text, position) values (pid, o, i);
    i := i + 1;
  end loop;
  update public.polls set updated_at = now() where id = pid;
end $$;

create or replace function public.admin_reset(p_code text, p_token text) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  perform public.check_rate('admin', 60, 60);
  pid := public.assert_admin(p_code, p_token);
  delete from public.votes where poll_id = pid;
  update public.poll_results set vote_count = 0 where poll_id = pid;
  update public.poll_stats set voter_count = 0 where poll_id = pid;
  update public.polls set updated_at = now() where id = pid;
end $$;

create or replace function public.admin_delete(p_code text, p_token text) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  perform public.check_rate('admin', 60, 60);
  pid := public.assert_admin(p_code, p_token);
  delete from public.polls where id = pid;
end $$;

-- ---------- Row Level Security ----------
alter table public.polls        enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_results enable row level security;
alter table public.poll_stats   enable row level security;
alter table public.votes        enable row level security;
alter table public.poll_secrets enable row level security;
alter table public.rate_limits  enable row level security;

drop policy if exists "polls readable" on public.polls;
create policy "polls readable" on public.polls for select to anon, authenticated using (true);

drop policy if exists "options readable" on public.poll_options;
create policy "options readable" on public.poll_options for select to anon, authenticated using (true);

drop policy if exists "results readable when visible" on public.poll_results;
create policy "results readable when visible" on public.poll_results for select to anon, authenticated
  using (public.results_visible(poll_id));
drop policy if exists "stats readable when visible" on public.poll_stats;
create policy "stats readable when visible" on public.poll_stats for select to anon, authenticated
  using (public.results_visible(poll_id));
-- votes, poll_secrets, rate_limits: bewusst KEINE Policies -> kein Zugriff über die API.

-- ---------- Rechte ----------
revoke all on public.polls, public.poll_options, public.poll_results, public.poll_stats, public.votes,
              public.poll_secrets, public.rate_limits from anon, authenticated;
grant select on public.polls, public.poll_options, public.poll_results, public.poll_stats to anon, authenticated;

revoke all on function
  public.trg_option_results(), public.trg_vote_count(), public.check_rate(text, int, int),
  public.gen_poll_code(), public.assert_admin(text, text), public.results_visible(uuid),
  public.create_poll(text, text, text[], boolean, boolean, boolean, boolean, timestamptz, text),
  public.cast_vote(text, uuid[], text, text), public.get_my_votes(text, text),
  public.get_voters(text), public.get_timeline(text), public.get_stats(),
  public.verify_admin(text, text), public.admin_set_status(text, text, text),
  public.admin_update_options(text, text, text[]), public.admin_reset(text, text),
  public.admin_delete(text, text)
  from public;

-- results_visible wird von der RLS-Policy im Kontext von anon benötigt
grant execute on function public.results_visible(uuid) to anon, authenticated;
grant execute on function
  public.create_poll(text, text, text[], boolean, boolean, boolean, boolean, timestamptz, text),
  public.cast_vote(text, uuid[], text, text), public.get_my_votes(text, text),
  public.get_voters(text), public.get_timeline(text), public.get_stats(),
  public.verify_admin(text, text), public.admin_set_status(text, text, text),
  public.admin_update_options(text, text, text[]), public.admin_reset(text, text),
  public.admin_delete(text, text)
  to anon, authenticated;

-- ---------- Realtime ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.polls;        exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.poll_options; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.poll_results; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.poll_stats;   exception when duplicate_object then null; end;
  end if;
end $$;
