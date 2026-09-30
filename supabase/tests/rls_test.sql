-- Testskript (lokal gegen Postgres mit anon-Rolle): psql -v ON_ERROR_STOP=1 -f rls_test.sql
\set ON_ERROR_STOP on
set role anon;
select public.create_poll('Welchen Film?', null, array['Interstellar','Avengers',' ','Inception'], false, false, true, true, null, 'admintoken-1234567890-abcdef') as code \gset
\echo CODE :code
select count(*) as options from public.poll_options;                        -- 3
select public.cast_vote(:'code', array[(select id from public.poll_options where text='Inception')], 'voter-aaaaaaaaaaaaaaaa', 'Anna');
select o.text, r.vote_count from public.poll_options o join public.poll_results r on r.option_id=o.id order by o.position;
select voter_count from public.poll_stats;
-- Doppelstimme muss scheitern
do $$ begin
  perform public.cast_vote((select code from public.polls limit 1), array[(select id from public.poll_options limit 1)], 'voter-aaaaaaaaaaaaaaaa', 'Anna');
  raise exception 'SOLLTE FEHLSCHLAGEN';
exception when others then raise notice 'OK doppelt: %', sqlerrm; end $$;
-- Name Pflicht
do $$ begin
  perform public.cast_vote((select code from public.polls limit 1), array[(select id from public.poll_options limit 1)], 'voter-bbbbbbbbbbbbbbbb', '');
  raise exception 'SOLLTE FEHLSCHLAGEN';
exception when others then raise notice 'OK name: %', sqlerrm; end $$;
-- Direkter Zugriff verboten
do $$ begin perform count(*) from public.votes; raise exception 'SOLLTE FEHLSCHLAGEN';
exception when insufficient_privilege then raise notice 'OK votes gesperrt'; end $$;
do $$ begin perform count(*) from public.poll_secrets; raise exception 'SOLLTE FEHLSCHLAGEN';
exception when insufficient_privilege then raise notice 'OK secrets gesperrt'; end $$;
do $$ begin insert into public.polls(code,question) values ('ABCDEF','hack'); raise exception 'SOLLTE FEHLSCHLAGEN';
exception when insufficient_privilege then raise notice 'OK insert gesperrt'; end $$;
do $$ begin update public.poll_results set vote_count = 999; raise exception 'SOLLTE FEHLSCHLAGEN';
exception when insufficient_privilege then raise notice 'OK update gesperrt'; end $$;
-- Voter-Namen
select voter_name from public.get_voters(:'code');
select count(*) as timeline from public.get_timeline(:'code');
select public.get_my_votes(:'code','voter-aaaaaaaaaaaaaaaa') as mine;
-- Admin
select public.verify_admin(:'code','wrong-token-wrong-token') as bad, public.verify_admin(:'code','admintoken-1234567890-abcdef') as good;
do $$ begin perform public.admin_reset((select code from public.polls limit 1), 'wrong-token-wrong-token'); raise exception 'SOLLTE FEHLSCHLAGEN';
exception when others then raise notice 'OK admin: %', sqlerrm; end $$;
do $$ begin perform public.admin_update_options((select code from public.polls limit 1), 'admintoken-1234567890-abcdef', array['a','b']); raise exception 'SOLLTE FEHLSCHLAGEN';
exception when others then raise notice 'OK edit nach Vote gesperrt: %', sqlerrm; end $$;
select public.admin_set_status(:'code','admintoken-1234567890-abcdef','closed');
do $$ begin perform public.cast_vote((select code from public.polls limit 1), array[(select id from public.poll_options limit 1)], 'voter-cccccccccccccccc', 'Bob'); raise exception 'SOLLTE FEHLSCHLAGEN';
exception when others then raise notice 'OK closed: %', sqlerrm; end $$;
select public.admin_set_status(:'code','admintoken-1234567890-abcdef','open');
select public.admin_reset(:'code','admintoken-1234567890-abcdef');
select sum(vote_count) as after_reset from public.poll_results;
select public.admin_update_options(:'code','admintoken-1234567890-abcdef', array['x','y','z']);
select text from public.poll_options order by position;
-- Versteckte Ergebnisse
select public.create_poll('Geheim?', 'desc', array['Ja','Nein'], true, true, false, false, now() + interval '1 hour', 'admintoken-1234567890-abcdef') as code2 \gset
select public.cast_vote(:'code2', (select array_agg(o.id) from public.poll_options o join public.polls p on p.id=o.poll_id where p.code=:'code2'), 'voter-aaaaaaaaaaaaaaaa', null);
select count(*) as visible_results_hidden_poll from public.poll_results r join public.polls p on p.id=r.poll_id where p.code=:'code2'; -- 0
select public.get_stats();
select public.admin_delete(:'code2','admintoken-1234567890-abcdef');
select count(*) as polls_left from public.polls;
