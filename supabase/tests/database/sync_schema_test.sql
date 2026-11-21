begin;

select plan(55);

insert into auth.users (id, aud, role, email)
values
  ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'sync-owner@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'sync-other@example.test');

set local role anon;
select throws_ok(
  $$select public.apply_sync_batch('10000000-0000-0000-0000-000000000001', '[{"profile_id":"me","entity":"program","record_id":"p1","expected_version":0,"deleted":false,"payload":{"id":"p1","profileId":"me"}}]'::jsonb)$$,
  '42501', null, 'Anonymous role cannot execute sync RPC'
);
select throws_ok($$select count(*) from public.sync_records$$,
  '42501', null, 'Anonymous role cannot read synced records');
select throws_ok($$select count(*) from public.sync_record_history$$,
  '42501', null, 'Anonymous role cannot read record history');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

select is(has_function_privilege('anon', 'public.apply_sync_batch(uuid,jsonb)', 'EXECUTE'),
  false, 'Anonymous role has no RPC execute privilege');
select is(has_function_privilege('authenticated', 'public.apply_sync_batch(uuid,jsonb)', 'EXECUTE'),
  true, 'Authenticated role can execute the RPC');
select is(has_function_privilege('authenticated', 'public.validate_sync_record_links()', 'EXECUTE'),
  false, 'Authenticated role cannot call the trigger function');
select is(has_function_privilege('service_role', 'public.apply_sync_batch(uuid,jsonb)', 'EXECUTE'),
  false, 'Service role cannot bypass the client RPC controls');
select is(has_table_privilege('service_role', 'public.sync_records', 'INSERT'),
  false, 'Service role has no direct sync table insert privilege');
select is(has_table_privilege('authenticated', 'public.sync_records', 'INSERT'),
  false, 'Authenticated role has no direct insert privilege');
select is(has_table_privilege('authenticated', 'public.sync_records', 'UPDATE'),
  false, 'Authenticated role has no direct update privilege');
select is(has_table_privilege('authenticated', 'public.sync_records', 'DELETE'),
  false, 'Authenticated role has no direct delete privilege');

select throws_ok($$insert into public.sync_records
  (owner_id, profile_id, entity, record_id, version, payload)
  values (auth.uid(), 'me', 'program', 'direct-write', 1,
    '{"id":"direct-write","profileId":"me"}'::jsonb)$$,
  '42501', null, 'Direct table insert is rejected');
select throws_ok($$update public.sync_records set version = version + 1$$,
  '42501', null, 'Direct table update is rejected');
select throws_ok($$delete from public.sync_records$$,
  '42501', null, 'Direct table delete is rejected');

select throws_ok(
  $$select public.apply_sync_batch('10000000-0000-0000-0000-000000000001',
    '[{"profile_id":"me","entity":"program","record_id":"bad-json","expected_version":0,"deleted":false,"payload":[]}]'::jsonb)$$,
  '22023', 'Invalid record change', 'Non-object JSON payload is rejected by the RPC'
);
select throws_ok(
  $$select public.apply_sync_batch('10000000-0000-0000-0000-000000000008',
    '[{"profile_id":"me","entity":"program","record_id":"bad-profile","expected_version":0,"deleted":false,"payload":{"id":"bad-profile","profileId":"wife"}}]'::jsonb)$$,
  '23514', null, 'Payload profile cannot differ from the row profile'
);

select is(
  public.apply_sync_batch('10000000-0000-0000-0000-000000000002',
    '[{"profile_id":"me","entity":"program","record_id":"p1","expected_version":0,"deleted":false,"payload":{"id":"p1","profileId":"me","name":"P1"}}]'::jsonb)->>'status',
  'applied', 'First program write is applied'
);
select is(
  public.apply_sync_batch('10000000-0000-0000-0000-000000000002',
    '[{"profile_id":"me","entity":"program","record_id":"p1","expected_version":0,"deleted":false,"payload":{"id":"p1","profileId":"me","name":"P1"}}]'::jsonb)->>'status',
  'applied', 'Retry after an applied response loss returns the stored result'
);
select is((select count(*)::integer from public.sync_record_history
  where owner_id = auth.uid() and entity = 'program' and record_id = 'p1'),
  1, 'Applied operation retry creates no duplicate history version'
);
select throws_ok(
  $$select public.apply_sync_batch('10000000-0000-0000-0000-000000000002',
    '[{"profile_id":"me","entity":"program","record_id":"p1","expected_version":0,"deleted":false,"payload":{"id":"p1","profileId":"me","name":"Different"}}]'::jsonb)$$,
  '22023', 'Operation id was reused with different content', 'Reusing an op_id with a different payload is rejected'
);

select is(
  public.apply_sync_batch('10000000-0000-0000-0000-000000000003',
    '[
      {"profile_id":"me","entity":"program","record_id":"p1","expected_version":0,"deleted":false,"payload":{"id":"p1","profileId":"me","name":"Stale"}},
      {"profile_id":"me","entity":"program","record_id":"p3","expected_version":0,"deleted":false,"payload":{"id":"p3","profileId":"me","name":"Must not be written"}}
    ]'::jsonb)->>'status',
  'conflict', 'A stale member makes the whole batch conflict'
);
select is((select payload->>'name' from public.sync_records
  where owner_id = auth.uid() and profile_id = 'me' and entity = 'program' and record_id = 'p1'),
  'P1', 'Conflict leaves the existing record unchanged'
);
select is((select count(*)::integer from public.sync_records
  where owner_id = auth.uid() and profile_id = 'me' and entity = 'program' and record_id = 'p3'),
  0, 'Conflict does not partially write another batch member'
);
select is(
  public.apply_sync_batch('10000000-0000-0000-0000-000000000003',
    '[
      {"profile_id":"me","entity":"program","record_id":"p1","expected_version":0,"deleted":false,"payload":{"id":"p1","profileId":"me","name":"Stale"}},
      {"profile_id":"me","entity":"program","record_id":"p3","expected_version":0,"deleted":false,"payload":{"id":"p3","profileId":"me","name":"Must not be written"}}
    ]'::jsonb)->'conflicts'->0->'remote'->>'version',
  '1', 'Retry after a lost conflict response returns its original conflict snapshot'
);

select is(public.apply_sync_batch('10000000-0000-0000-0000-000000000004',
  '[{"profile_id":"me","entity":"program","record_id":"p1","expected_version":1,"deleted":false,"payload":{"id":"p1","profileId":"me","name":"P1 updated"}}]'::jsonb)->>'status',
  'applied', 'A new operation can advance the record after conflict resolution');
select is(
  public.apply_sync_batch('10000000-0000-0000-0000-000000000003',
    '[
      {"profile_id":"me","entity":"program","record_id":"p1","expected_version":0,"deleted":false,"payload":{"id":"p1","profileId":"me","name":"Stale"}},
      {"profile_id":"me","entity":"program","record_id":"p3","expected_version":0,"deleted":false,"payload":{"id":"p3","profileId":"me","name":"Must not be written"}}
    ]'::jsonb)->'conflicts'->0->'remote'->>'version',
  '1', 'Replaying a lost conflict response stays idempotent after the server advances');
select is(public.apply_sync_batch('10000000-0000-0000-0000-000000000005',
  '[{"profile_id":"me","entity":"program","record_id":"p2","expected_version":0,"deleted":false,"payload":{"id":"p2","profileId":"me","name":"P2"}}]'::jsonb)->>'status',
  'applied', 'Second program can be created for cycle transition');

select is(
  public.apply_sync_batch('10000000-0000-0000-0000-000000000006',
    '[
      {"profile_id":"me","entity":"cycle","record_id":"cycle-1","expected_version":0,"deleted":false,"payload":{"id":"cycle-1","profileId":"me","programId":"p1","programSnapshot":{"id":"p1","profileId":"me"},"status":"active"}},
      {"profile_id":"me","entity":"profile_state","record_id":"profile","expected_version":0,"deleted":false,"payload":{"profileId":"me","activeCycleId":"cycle-1"}}
    ]'::jsonb)->>'status',
  'applied', 'First cycle and profile state are linked'
);
set constraints sync_records_validate_links immediate;
select throws_ok(
  $$select public.apply_sync_batch('10000000-0000-0000-0000-000000000015',
    '[{"profile_id":"me","entity":"cycle","record_id":"cycle-extra","expected_version":0,"deleted":false,"payload":{"id":"cycle-extra","profileId":"me","programId":"p2","programSnapshot":{"id":"p2","profileId":"me"},"status":"active"}}]'::jsonb)$$,
  '23514', 'Profile has more than one active cycle', 'Deferred invariant rejects a second active cycle');
select throws_ok(
  $$select public.apply_sync_batch('10000000-0000-0000-0000-000000000007',
    '[{"profile_id":"me","entity":"cycle","record_id":"cycle-1","expected_version":1,"deleted":true,"payload":{"id":"cycle-1","profileId":"me","programId":"p1","programSnapshot":{"id":"p1","profileId":"me"},"status":"active"}}]'::jsonb)$$,
  '23514', 'An active cycle cannot be tombstoned', 'An active cycle cannot be logically deleted');

select is(public.apply_sync_batch('10000000-0000-0000-0000-000000000009',
  '[{"profile_id":"me","entity":"active_session","record_id":"current","expected_version":0,"deleted":false,"payload":{"id":"workout-a","profileId":"me","cycleId":"cycle-1","finished":null}}]'::jsonb)->>'status',
  'applied', 'First device acquires the per-profile active-session record');
select is(public.apply_sync_batch('10000000-0000-0000-0000-00000000000a',
  '[{"profile_id":"me","entity":"active_session","record_id":"current","expected_version":0,"deleted":false,"payload":{"id":"workout-b","profileId":"me","cycleId":"cycle-1","finished":null}}]'::jsonb)->>'status',
  'conflict', 'Concurrent active session on a second device conflicts');
select is((select payload->>'id' from public.sync_records
  where owner_id = auth.uid() and profile_id = 'me' and entity = 'active_session' and record_id = 'current'),
  'workout-a', 'Concurrent start does not replace the first workout');

select throws_ok(
  $$select public.apply_sync_batch('10000000-0000-0000-0000-00000000000c',
    '[
      {"profile_id":"me","entity":"program","record_id":"atomic-p","expected_version":0,"deleted":false,"payload":{"id":"atomic-p","profileId":"me"}},
      {"profile_id":"me","entity":"session","record_id":"bad-session","expected_version":0,"deleted":false,"payload":{"id":"bad-session","profileId":"me","programId":"atomic-p","cycleId":"missing-cycle","finished":"2026-01-01T12:00:00Z"}}
    ]'::jsonb)$$,
  '23514', 'Session references a missing or mismatched cycle', 'Invalid cross-record link aborts the whole batch'
);
select is((select count(*)::integer from public.sync_records
  where owner_id = auth.uid() and profile_id = 'me' and entity = 'program' and record_id = 'atomic-p'),
  0, 'Constraint failure leaves no partial program write');
select is((select count(*)::integer from public.sync_record_history
  where owner_id = auth.uid() and profile_id = 'me' and entity = 'program' and record_id = 'atomic-p'),
  0, 'Constraint failure leaves no partial history version');

select throws_ok(
  $$select public.apply_sync_batch('10000000-0000-0000-0000-00000000000d',
    '[{"profile_id":"me","entity":"program","record_id":"p1","expected_version":2,"deleted":true,"payload":{"id":"p1","profileId":"me","name":"P1 updated"}}]'::jsonb)$$,
  '23514', 'Active cycle cannot reference a deleted program', 'Active cycle prevents its program from being tombstoned'
);
select is((select deleted_at is null from public.sync_records
  where owner_id = auth.uid() and profile_id = 'me' and entity = 'program' and record_id = 'p1'),
  true, 'Rejected active-program deletion writes nothing');

select throws_ok(
  $$select public.apply_sync_batch('10000000-0000-0000-0000-00000000000e',
    '[
      {"profile_id":"me","entity":"cycle","record_id":"cycle-1","expected_version":1,"deleted":false,"payload":{"id":"cycle-1","profileId":"me","programId":"p1","programSnapshot":{"id":"p1","profileId":"me"},"status":"completed"}},
      {"profile_id":"me","entity":"cycle","record_id":"cycle-2","expected_version":0,"deleted":false,"payload":{"id":"cycle-2","profileId":"me","programId":"p2","programSnapshot":{"id":"p2","profileId":"me"},"status":"active"}},
      {"profile_id":"me","entity":"profile_state","record_id":"profile","expected_version":1,"deleted":false,"payload":{"profileId":"me","activeCycleId":"cycle-2"}},
      {"profile_id":"me","entity":"active_session","record_id":"current","expected_version":1,"deleted":true,"payload":{"id":"workout-a","profileId":"me","cycleId":"cycle-1","finished":null}}
    ]'::jsonb)$$,
  '23514', 'Cannot change a cycle while a session is active', 'Cycle transition is refused while a workout is still active');
select is((select payload->>'status' from public.sync_records
  where owner_id = auth.uid() and profile_id = 'me' and entity = 'cycle' and record_id = 'cycle-1'),
  'active', 'Refused cycle transition does not partially end the current cycle');

select is(public.apply_sync_batch('10000000-0000-0000-0000-00000000000f',
  '[
    {"profile_id":"me","entity":"active_session","record_id":"current","expected_version":1,"deleted":true,"payload":{"id":"workout-a","profileId":"me","cycleId":"cycle-1","finished":null}},
    {"profile_id":"me","entity":"session","record_id":"workout-a","expected_version":0,"deleted":false,"payload":{"id":"workout-a","profileId":"me","programId":"p1","cycleId":"cycle-1","finished":"2026-01-01T12:00:00Z"}}
  ]'::jsonb)->>'status',
  'applied', 'Finishing a workout writes its history and tombstones the active-session slot');

select is(public.apply_sync_batch('10000000-0000-0000-0000-000000000010',
  '[
    {"profile_id":"me","entity":"cycle","record_id":"cycle-1","expected_version":1,"deleted":false,"payload":{"id":"cycle-1","profileId":"me","programId":"p1","programSnapshot":{"id":"p1","profileId":"me"},"status":"completed"}},
    {"profile_id":"me","entity":"cycle","record_id":"cycle-2","expected_version":0,"deleted":false,"payload":{"id":"cycle-2","profileId":"me","programId":"p2","programSnapshot":{"id":"p2","profileId":"me"},"status":"active"}},
    {"profile_id":"me","entity":"profile_state","record_id":"profile","expected_version":1,"deleted":false,"payload":{"profileId":"me","activeCycleId":"cycle-2"}}
  ]'::jsonb)->>'status',
  'applied', 'Ending one cycle and activating the next is valid in a single batch');
select is((select count(*)::integer from public.sync_records
  where owner_id = auth.uid() and profile_id = 'me' and entity = 'cycle'
    and deleted_at is null and payload->>'status' = 'active'),
  1, 'Cycle transition leaves exactly one active cycle');

select throws_ok(
  $$select public.apply_sync_batch('10000000-0000-0000-0000-000000000011',
    '[{"profile_id":"me","entity":"program","record_id":"p2","expected_version":1,"deleted":true,"payload":{"id":"p2","profileId":"me","name":"P2"}}]'::jsonb)$$,
  '23514', 'Active cycle cannot reference a deleted program', 'Active cycle prevents deletion of its program');
select is((select deleted_at is null from public.sync_records
  where owner_id = auth.uid() and profile_id = 'me' and entity = 'program' and record_id = 'p2'),
  true, 'Rejected deletion of active program leaves its row unchanged');

select is(public.apply_sync_batch('10000000-0000-0000-0000-000000000012',
  '[
    {"profile_id":"me","entity":"cycle","record_id":"cycle-2","expected_version":1,"deleted":false,"payload":{"id":"cycle-2","profileId":"me","programId":"p2","programSnapshot":{"id":"p2","profileId":"me"},"status":"completed"}},
    {"profile_id":"me","entity":"profile_state","record_id":"profile","expected_version":2,"deleted":false,"payload":{"profileId":"me","activeCycleId":null}},
    {"profile_id":"me","entity":"session","record_id":"workout-b","expected_version":0,"deleted":false,"payload":{"id":"workout-b","profileId":"me","programId":"p2","cycleId":"cycle-2","finished":"2026-01-02T12:00:00Z"}}
  ]'::jsonb)->>'status',
  'applied', 'Completed cycle and session can be stored together');
select is(public.apply_sync_batch('10000000-0000-0000-0000-000000000013',
  '[{"profile_id":"me","entity":"program","record_id":"p2","expected_version":1,"deleted":true,"payload":{"id":"p2","profileId":"me","name":"P2"}}]'::jsonb)->>'status',
  'applied', 'Program can be tombstoned after its cycle is completed');
select is((select count(*)::integer from public.sync_records
  where owner_id = auth.uid() and profile_id = 'me' and entity = 'session' and record_id = 'workout-b'),
  1, 'Completed session remains available after its program is tombstoned');
select is((select deleted_at is not null from public.sync_records
  where owner_id = auth.uid() and profile_id = 'me' and entity = 'program' and record_id = 'p2'),
  true, 'Program deletion is represented as a tombstone');
select is(public.apply_sync_batch('10000000-0000-0000-0000-000000000016',
  '[{"profile_id":"me","entity":"cycle","record_id":"cycle-2","expected_version":2,"deleted":true,"payload":{"id":"cycle-2","profileId":"me","programId":"p2","programSnapshot":{"id":"p2","profileId":"me"},"status":"completed"}}]'::jsonb)->>'status',
  'applied', 'Completed cycle can be tombstoned while preserving its historical row');
select is((select count(*)::integer from public.sync_records
  where owner_id = auth.uid() and profile_id = 'me' and entity = 'session' and record_id = 'workout-b'),
  1, 'Completed session remains linked after its cycle is tombstoned');
select throws_ok(
  $$select public.apply_sync_batch('10000000-0000-0000-0000-000000000014',
    '[
      {"profile_id":"me","entity":"cycle","record_id":"cycle-3","expected_version":0,"deleted":false,"payload":{"id":"cycle-3","profileId":"me","programId":"p2","programSnapshot":{"id":"p2","profileId":"me"},"status":"active"}},
      {"profile_id":"me","entity":"profile_state","record_id":"profile","expected_version":3,"deleted":false,"payload":{"profileId":"me","activeCycleId":"cycle-3"}}
    ]'::jsonb)$$,
  '23514', 'Active cycle cannot reference a deleted program', 'Tombstoned program cannot be reactivated in a new cycle');
select is((select count(*)::integer from public.sync_records
  where owner_id = auth.uid() and profile_id = 'me' and entity = 'cycle' and record_id = 'cycle-3'),
  0, 'Rejected reactivation leaves no partial cycle');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select is((select count(*)::integer from public.sync_records), 0,
  'Another Auth account cannot read current records');
select is((select count(*)::integer from public.sync_record_history), 0,
  'Another Auth account cannot read version history');

select * from finish();
rollback;
