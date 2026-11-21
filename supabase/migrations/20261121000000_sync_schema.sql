-- ROCH&RANIA FIT — Supabase sync schema (V1)
-- Apply only to a development Supabase project after reviewing docs/SUPABASE.md.
-- All client writes go through apply_sync_batch(). Never grant table DML to clients.

create table if not exists public.sync_records (
  owner_id uuid not null references auth.users (id),
  profile_id text not null check (profile_id in ('me', 'wife')),
  entity text not null check (entity in ('program', 'cycle', 'session', 'profile_state', 'active_session')),
  record_id text not null check (length(record_id) between 1 and 200),
  version bigint not null check (version > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  primary key (owner_id, profile_id, entity, record_id),
  check ((
    (entity = 'program' and payload->>'id' = record_id and payload->>'profileId' = profile_id)
    or (entity = 'cycle' and payload->>'id' = record_id and payload->>'profileId' = profile_id
        and payload->>'status' in ('active', 'completed')
        and jsonb_typeof(payload->'programSnapshot') = 'object'
        and payload->'programSnapshot'->>'id' = payload->>'programId'
        and payload->'programSnapshot'->>'profileId' = profile_id)
    or (entity = 'session' and payload->>'id' = record_id and payload->>'profileId' = profile_id
        and payload->>'finished' is not null)
    or (entity = 'profile_state' and record_id = 'profile' and payload->>'profileId' = profile_id
        and payload ? 'activeCycleId')
    or (entity = 'active_session' and record_id = 'current' and payload->>'profileId' = profile_id
        and payload->>'finished' is null)
  ) is true)
);

create index if not exists sync_records_owner_profile_updated
  on public.sync_records (owner_id, profile_id, updated_at desc);

create table if not exists public.sync_record_history (
  change_id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id),
  profile_id text not null check (profile_id in ('me', 'wife')),
  entity text not null check (entity in ('program', 'cycle', 'session', 'profile_state', 'active_session')),
  record_id text not null,
  version bigint not null check (version > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  deleted_at timestamptz,
  op_id uuid not null,
  changed_at timestamptz not null default clock_timestamp(),
  unique (owner_id, profile_id, entity, record_id, version)
);

create index if not exists sync_history_owner_cursor
  on public.sync_record_history (owner_id, change_id);

create table if not exists public.sync_operations (
  owner_id uuid not null references auth.users (id),
  op_id uuid not null,
  request_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (owner_id, op_id)
);

alter table public.sync_records enable row level security;
alter table public.sync_record_history enable row level security;
alter table public.sync_operations enable row level security;

drop policy if exists sync_records_owner_select on public.sync_records;
create policy sync_records_owner_select on public.sync_records
  for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists sync_history_owner_select on public.sync_record_history;
create policy sync_history_owner_select on public.sync_record_history
  for select to authenticated using ((select auth.uid()) = owner_id);

-- Operation receipts are deliberately only accessible inside the RPC.
revoke all on public.sync_records, public.sync_record_history, public.sync_operations from anon, authenticated, service_role;
grant select on public.sync_records, public.sync_record_history to authenticated;

create or replace function public.validate_sync_record_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  row_record record;
  active_cycle_id text;
  active_cycle_count integer := 0;
  state_cycle_id text;
  linked_cycle jsonb;
  program_deleted_at timestamptz;
begin
  -- Runs as the table owner after all rows in the RPC transaction have been written.
  for row_record in
    select r.entity, r.record_id, r.payload, r.deleted_at
    from public.sync_records as r
    where r.owner_id = new.owner_id and r.profile_id = new.profile_id
  loop
    if row_record.entity = 'cycle' then
      select p.deleted_at into program_deleted_at
      from public.sync_records as p
      where p.owner_id = new.owner_id and p.profile_id = new.profile_id
        and p.entity = 'program' and p.record_id = row_record.payload->>'programId';
      if not found then
        raise exception using errcode = '23514', message = 'Cycle references a missing program';
      end if;
      if row_record.deleted_at is not null and row_record.payload->>'status' = 'active' then
        raise exception using errcode = '23514', message = 'An active cycle cannot be tombstoned';
      end if;
      if row_record.deleted_at is null and row_record.payload->>'status' = 'active' then
        active_cycle_count := active_cycle_count + 1;
        active_cycle_id := row_record.record_id;
        if program_deleted_at is not null then
          raise exception using errcode = '23514', message = 'Active cycle cannot reference a deleted program';
        end if;
      end if;
    elsif row_record.entity = 'session' then
      select c.payload into linked_cycle
      from public.sync_records as c
      where c.owner_id = new.owner_id and c.profile_id = new.profile_id
        and c.entity = 'cycle' and c.record_id = row_record.payload->>'cycleId';
      if linked_cycle is null or linked_cycle->>'programId' is distinct from row_record.payload->>'programId' then
        raise exception using errcode = '23514', message = 'Session references a missing or mismatched cycle';
      end if;
    elsif row_record.entity = 'profile_state' then
      state_cycle_id := nullif(row_record.payload->>'activeCycleId', 'null');
      if row_record.payload->'activeCycleId' = 'null'::jsonb then state_cycle_id := null; end if;
    elsif row_record.entity = 'active_session' and row_record.deleted_at is null then
      select c.payload into linked_cycle
      from public.sync_records as c
      where c.owner_id = new.owner_id and c.profile_id = new.profile_id
        and c.entity = 'cycle' and c.record_id = row_record.payload->>'cycleId'
        and c.deleted_at is null and c.payload->>'status' = 'active';
      if linked_cycle is null then
        raise exception using errcode = '23514', message = 'Active session requires the active cycle';
      end if;
    end if;
  end loop;

  if active_cycle_count > 1 then
    raise exception using errcode = '23514', message = 'Profile has more than one active cycle';
  end if;
  if active_cycle_id is not null then
    if state_cycle_id is distinct from active_cycle_id then
      raise exception using errcode = '23514', message = 'Profile state must reference its active cycle';
    end if;
  elsif state_cycle_id is not null then
    raise exception using errcode = '23514', message = 'Profile state references a non-active cycle';
  end if;
  return null;
end;
$function$;

drop trigger if exists sync_records_validate_links on public.sync_records;
create constraint trigger sync_records_validate_links
  after insert or update on public.sync_records
  deferrable initially deferred
  for each row execute function public.validate_sync_record_links();

create or replace function public.apply_sync_batch(p_op_id uuid, p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_id uuid := auth.uid();
  profile_key text;
  request_fingerprint text;
  prior_operation public.sync_operations%rowtype;
  change_item jsonb;
  current_record public.sync_records%rowtype;
  conflicts jsonb := '[]'::jsonb;
  applied jsonb := '[]'::jsonb;
  next_version bigint;
  is_deleted boolean;
  result_value jsonb;
  distinct_count integer;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;
  if p_op_id is null or jsonb_typeof(p_changes) <> 'array'
     or jsonb_array_length(p_changes) < 1 or jsonb_array_length(p_changes) > 100 then
    raise exception using errcode = '22023', message = 'Invalid operation or batch size';
  end if;
  profile_key := p_changes->0->>'profile_id';
  if profile_key not in ('me', 'wife') then
    raise exception using errcode = '22023', message = 'Invalid profile';
  end if;
  if exists (select 1 from jsonb_array_elements(p_changes) as changes(item) where item->>'profile_id' is distinct from profile_key) then
    raise exception using errcode = '22023', message = 'A batch must contain one profile only';
  end if;
  select count(*) into distinct_count from (
    select distinct item->>'entity', item->>'record_id'
    from jsonb_array_elements(p_changes) as changes(item)
  ) as keys_in_batch;
  if distinct_count <> jsonb_array_length(p_changes) then
    raise exception using errcode = '22023', message = 'Duplicate record in batch';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_changes) as changes(item)
    where item->>'entity' not in ('program', 'cycle', 'session', 'profile_state', 'active_session')
      or nullif(item->>'record_id', '') is null
      or jsonb_typeof(item->'payload') <> 'object'
      or coalesce(item->>'expected_version', '') !~ '^[0-9]+$'
      or coalesce(item->>'deleted', '') not in ('true', 'false')
      or (item->>'entity' = 'profile_state' and item->>'deleted' = 'true')
  ) then
    raise exception using errcode = '22023', message = 'Invalid record change';
  end if;

  request_fingerprint := md5(p_changes::text);
  -- Serialize all operations for this shared account. This makes absent-row CAS,
  -- idempotency checks and sequence-backed history cursors deterministic.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('roch-rania:' || caller_id::text, 0));
  select * into prior_operation from public.sync_operations
   where owner_id = caller_id and op_id = p_op_id;
  if found then
    if prior_operation.request_hash <> request_fingerprint then
      raise exception using errcode = '22023', message = 'Operation id was reused with different content';
    end if;
    return prior_operation.result;
  end if;

  for change_item in select changes.item from jsonb_array_elements(p_changes) as changes(item) loop
    select * into current_record from public.sync_records
     where owner_id = caller_id and profile_id = profile_key
       and entity = change_item->>'entity' and record_id = change_item->>'record_id';
    if coalesce(current_record.version, 0) <> (change_item->>'expected_version')::bigint then
      conflicts := conflicts || jsonb_build_array(jsonb_build_object(
        'entity', change_item->>'entity', 'record_id', change_item->>'record_id',
        'expected_version', (change_item->>'expected_version')::bigint,
        'remote', case when current_record.version is null then null else jsonb_build_object(
          'version', current_record.version, 'payload', current_record.payload,
          'deleted_at', current_record.deleted_at, 'updated_at', current_record.updated_at) end));
    end if;
  end loop;
  if jsonb_array_length(conflicts) > 0 then
    result_value := jsonb_build_object('status', 'conflict', 'op_id', p_op_id, 'conflicts', conflicts);
    insert into public.sync_operations (owner_id, op_id, request_hash, result)
      values (caller_id, p_op_id, request_fingerprint, result_value);
    return result_value;
  end if;

  if exists (
    select 1 from public.sync_records as active
    where active.owner_id = caller_id and active.profile_id = profile_key
      and active.entity = 'active_session' and active.record_id = 'current'
      and active.deleted_at is null
  ) and exists (
    select 1 from jsonb_array_elements(p_changes) as changes(item)
    where item->>'entity' in ('cycle', 'profile_state')
  ) then
    raise exception using errcode = '23514', message = 'Cannot change a cycle while a session is active';
  end if;

  for change_item in select changes.item from jsonb_array_elements(p_changes) as changes(item) loop
    select * into current_record from public.sync_records
     where owner_id = caller_id and profile_id = profile_key
       and entity = change_item->>'entity' and record_id = change_item->>'record_id';
    next_version := coalesce(current_record.version, 0) + 1;
    is_deleted := (change_item->>'deleted')::boolean;
    insert into public.sync_record_history
      (owner_id, profile_id, entity, record_id, version, payload, deleted_at, op_id)
    values (caller_id, profile_key, change_item->>'entity', change_item->>'record_id',
      next_version, change_item->'payload', case when is_deleted then clock_timestamp() else null end, p_op_id);
    insert into public.sync_records
      (owner_id, profile_id, entity, record_id, version, payload, updated_at, deleted_at)
    values (caller_id, profile_key, change_item->>'entity', change_item->>'record_id',
      next_version, change_item->'payload', clock_timestamp(),
      case when is_deleted then clock_timestamp() else null end)
    on conflict (owner_id, profile_id, entity, record_id) do update set
      version = excluded.version, payload = excluded.payload,
      updated_at = excluded.updated_at, deleted_at = excluded.deleted_at;
    applied := applied || jsonb_build_array(jsonb_build_object(
      'entity', change_item->>'entity', 'record_id', change_item->>'record_id', 'version', next_version));
  end loop;

  result_value := jsonb_build_object('status', 'applied', 'op_id', p_op_id, 'records', applied);
  insert into public.sync_operations (owner_id, op_id, request_hash, result)
    values (caller_id, p_op_id, request_fingerprint, result_value);
  return result_value;
end;
$function$;

revoke all on function public.apply_sync_batch(uuid, jsonb) from public, anon, service_role;
grant execute on function public.apply_sync_batch(uuid, jsonb) to authenticated;
revoke all on function public.validate_sync_record_links() from public, anon, authenticated, service_role;

