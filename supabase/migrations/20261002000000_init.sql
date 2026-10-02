-- Recall Atlas: per-user learning state. Content lives in the repo (course_slug / item_key).

create table public.enrollments (
  user_id uuid not null references auth.users (id) on delete cascade,
  course_slug text not null,
  placement_completed_at timestamptz,
  passed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, course_slug)
);

create table public.prompt_states (
  user_id uuid not null references auth.users (id) on delete cascade,
  course_slug text not null,
  item_key text not null,
  prompt_type text not null,
  phase text not null check (phase in ('new', 'learning', 'review')),
  rung smallint not null check (rung between 0 and 3),
  streak smallint not null default 0,
  fsrs jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_slug, item_key, prompt_type)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_slug text not null,
  kind text not null check (kind in ('study', 'placement', 'exam')),
  state jsonb not null,
  pending_question jsonb,
  version integer not null default 0,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index sessions_one_active_per_course
  on public.sessions (user_id, course_slug) where completed_at is null;

create table public.answers (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  course_slug text not null,
  session_id uuid not null references public.sessions (id) on delete cascade,
  question_id uuid not null unique,
  context text not null check (context in ('study', 'placement', 'exam')),
  kind text not null check (kind in ('prompt', 'contrast')),
  item_key text not null,
  prompt_type text,
  format text not null,
  rung smallint,
  given_text text,
  given_item_key text,
  correct boolean not null,
  response_ms integer,
  created_at timestamptz not null default now()
);
create index answers_user_course_time on public.answers (user_id, course_slug, created_at);

create table public.confusions (
  user_id uuid not null references auth.users (id) on delete cascade,
  course_slug text not null,
  asked_item_key text not null,
  answered_item_key text not null,
  count integer not null default 1,
  last_at timestamptz not null default now(),
  primary key (user_id, course_slug, asked_item_key, answered_item_key)
);

create table public.exam_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  course_slug text not null,
  session_id uuid not null references public.sessions (id) on delete cascade,
  score integer not null,
  total integer not null,
  passed boolean not null,
  missed_item_keys text[] not null default '{}',
  finished_at timestamptz not null default now()
);

-- Row level security: learners may read only their own rows. There are no
-- insert/update/delete policies; all writes go through server code using the
-- secret key (which bypasses RLS) and the commit_turn function below.
alter table public.enrollments enable row level security;
alter table public.prompt_states enable row level security;
alter table public.sessions enable row level security;
alter table public.answers enable row level security;
alter table public.confusions enable row level security;
alter table public.exam_attempts enable row level security;

create policy "read own enrollments" on public.enrollments
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "read own prompt states" on public.prompt_states
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "read own sessions" on public.sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "read own answers" on public.answers
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "read own confusions" on public.confusions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "read own exam attempts" on public.exam_attempts
  for select to authenticated using ((select auth.uid()) = user_id);

-- Atomically applies one answered turn. Raises 'stale_session' if the session
-- is not active or its version moved on (double submit, second tab).
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
