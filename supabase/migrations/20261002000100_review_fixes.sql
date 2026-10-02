-- Review fixes for Plan 2 Tasks 4-7:
-- 1. commit_turn must bind the session update to the course it's called for,
--    not just the session id, so a mismatched course_slug argument cannot
--    silently touch another course's session.
-- 2. Indexes supporting common lookups.

create or replace function public.commit_turn(p jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (p ->> 'user_id')::uuid;
  v_session uuid := (p ->> 'session_id')::uuid;
  v_course text := p ->> 'course_slug';
  v_rows integer;
begin
  update public.sessions
     set state = p -> 'session_state',
         pending_question = nullif(p -> 'pending_question', 'null'::jsonb),
         version = version + 1,
         updated_at = now(),
         completed_at = case when (p ->> 'completed')::boolean then now() else null end
   where id = v_session
     and user_id = v_user
     and course_slug = v_course
     and version = (p ->> 'expected_version')::integer
     and completed_at is null;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'stale_session';
  end if;

  insert into public.prompt_states (user_id, course_slug, item_key, prompt_type, phase, rung, streak, fsrs, updated_at)
  select v_user, v_course, s ->> 'itemKey', s ->> 'promptType', s ->> 'phase',
         (s ->> 'rung')::smallint, (s ->> 'streak')::smallint, nullif(s -> 'fsrs', 'null'::jsonb), now()
    from jsonb_array_elements(coalesce(p -> 'prompt_states', '[]'::jsonb)) as s
  on conflict (user_id, course_slug, item_key, prompt_type) do update
     set phase = excluded.phase, rung = excluded.rung, streak = excluded.streak,
         fsrs = excluded.fsrs, updated_at = now();

  if jsonb_typeof(p -> 'answer') = 'object' then
    insert into public.answers (user_id, course_slug, session_id, question_id, context, kind, item_key,
                                prompt_type, format, rung, given_text, given_item_key, correct, response_ms)
    values (v_user, v_course, v_session,
            (p -> 'answer' ->> 'question_id')::uuid,
            p -> 'answer' ->> 'context',
            p -> 'answer' ->> 'kind',
            p -> 'answer' ->> 'item_key',
            p -> 'answer' ->> 'prompt_type',
            p -> 'answer' ->> 'format',
            (p -> 'answer' ->> 'rung')::smallint,
            p -> 'answer' ->> 'given_text',
            p -> 'answer' ->> 'given_item_key',
            (p -> 'answer' ->> 'correct')::boolean,
            (p -> 'answer' ->> 'response_ms')::integer);
  end if;

  if jsonb_typeof(p -> 'confusion') = 'object' then
    insert into public.confusions (user_id, course_slug, asked_item_key, answered_item_key, count, last_at)
    values (v_user, v_course, p -> 'confusion' ->> 'asked', p -> 'confusion' ->> 'answered', 1, now())
    on conflict (user_id, course_slug, asked_item_key, answered_item_key) do update
       set count = public.confusions.count + 1, last_at = now();
  end if;

  if jsonb_typeof(p -> 'enrollment') = 'object' then
    update public.enrollments
       set placement_completed_at = coalesce(placement_completed_at, (p -> 'enrollment' ->> 'placement_completed_at')::timestamptz),
           passed_at = coalesce(passed_at, (p -> 'enrollment' ->> 'passed_at')::timestamptz)
     where user_id = v_user and course_slug = v_course;
  end if;

  if jsonb_typeof(p -> 'exam_attempt') = 'object' then
    insert into public.exam_attempts (user_id, course_slug, session_id, score, total, passed, missed_item_keys)
    values (v_user, v_course, v_session,
            (p -> 'exam_attempt' ->> 'score')::integer,
            (p -> 'exam_attempt' ->> 'total')::integer,
            (p -> 'exam_attempt' ->> 'passed')::boolean,
            array(select jsonb_array_elements_text(p -> 'exam_attempt' -> 'missed_item_keys')));
  end if;
end;
$$;

revoke all on function public.commit_turn(jsonb) from public, anon, authenticated;
grant execute on function public.commit_turn(jsonb) to service_role;

create index if not exists exam_attempts_user_course on public.exam_attempts (user_id, course_slug);
create index if not exists answers_session on public.answers (session_id);
create index if not exists exam_attempts_session on public.exam_attempts (session_id);
create index if not exists sessions_user on public.sessions (user_id);
