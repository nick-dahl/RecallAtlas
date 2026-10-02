# Recall Atlas — Plan 2: Persistence, Auth & Study Services

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist learner progress in a hosted Supabase project, add magic-link sign-in, and expose placement / study / exam flows as server-side services and server actions that never leak answers to the browser.

**Architecture:**
- **Services** (`lib/study/*-service.ts`) orchestrate the Plan 1 engine against a per-user `UserStore` interface. They are unit-tested with an in-memory store.
- **`SupabaseStore`** implements the same interface against Postgres. A shared contract test suite runs against both stores.
- **Writes:** every answer is committed atomically by the Postgres function `commit_turn`, with optimistic concurrency on `sessions.version`.
- **Browser view:** the browser only ever receives a `QuestionView`. Choices carry opaque ids, flags arrive as scrubbed data URIs, and no item keys are included.
- **Server actions** are thin: authenticate, then call a service.

**Tech Stack:** Next.js 16 (`proxy.ts`, async `cookies()`), `@supabase/supabase-js` 2.117.2, `@supabase/ssr` 0.12.7, Postgres (RLS + plpgsql), `pg` (migration script), svgo 4, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-01-recall-atlas-design.md` (§5 updated for this plan, §6, §8).
**Builds on:** Plan 1, especially its "Notes for Plan 2" section. This plan implements those notes.

**Conventions:**
- Repo `C:\Users\nickd\dev\recall-atlas`. Use a feature branch `plan-2-persistence`.
- Commands work in PowerShell and bash.
- Colocated tests:
  - `*.test.ts` are unit tests, run by `npm test`.
  - `*.int.test.ts` are integration tests against the hosted dev project, run by `npm run test:integration`.
- Every commit message ends with a blank line, then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- The engine (`lib/engine`) is not modified in this plan.

---

## File map

| File | Responsibility |
|---|---|
| `.env.example` | Documented env vars (committed). `.env.local` holds real values (git-ignored) |
| `lib/env.ts` | Typed, validated env access |
| `vitest.config.mts` / `vitest.integration.config.mts` | Unit vs integration runs; `server-only` stubbed for tests |
| `scripts/db-push.ts` | Applies `supabase/migrations/*.sql` in order via `pg`, tracked in `private.migrations` |
| `supabase/migrations/20261002000000_init.sql` | Tables, RLS, `commit_turn` |
| `scripts/build-content.ts` (modify) | Writes flags to `content/flags/`, optimized and scrubbed by svgo |
| `lib/content/flag-art.ts` | Flag → data URI (server-side, cached) |
| `lib/db/serialize.ts` | Row ↔ `PromptState`; revives FSRS `Date`s |
| `lib/db/store.ts` | `UserStore` interface, records, errors |
| `lib/db/memory-store.ts` | In-memory `UserStore` (tests) |
| `lib/db/store-contract.ts` | Shared contract suite for any `UserStore` |
| `lib/db/supabase-store.ts` | Postgres `UserStore` |
| `lib/supabase/admin.ts` | Secret-key client (server only) |
| `lib/supabase/server.ts` | Cookie-bound session client, `getUserId`, `requireUserId` |
| `lib/supabase/proxy.ts` + `proxy.ts` | Session refresh + protected-route redirect |
| `lib/study/types.ts` | `PendingQuestion`, `QuestionView`, `FeedbackView`, responses, `ServiceError` |
| `lib/study/issue.ts` | Issue a question with opaque choice ids; grade a submission |
| `lib/study/present.ts` | Presenter (course-specific) + `toQuestionView` |
| `lib/study/presenters.ts` | `getPresenter(course)` registry (server) |
| `lib/study/validate.ts` | Parse untrusted action input |
| `lib/study/context.ts` | `ServiceContext` |
| `lib/study/turn.ts` | Shared turn helpers (load, issue, log, feedback, view) |
| `lib/study/overview-service.ts` | Enroll + course overview |
| `lib/study/placement-service.ts` | Placement sweep |
| `lib/study/study-service.ts` | Study sessions |
| `lib/study/exam-service.ts` | Final exam |
| `lib/study/test-helpers.ts` | Test context + "perfect learner" |
| `lib/server/random.ts` | `cryptoRng`, `newId` |
| `lib/server/context.ts` | Build a real `ServiceContext` for a user |
| `lib/auth/safe-next.ts` | Open-redirect-safe `next` param |
| `app/login/*`, `app/auth/*` | Magic-link login, callback, sign-out |
| `app/actions/course.ts` | Server actions for all flows |
| `app/dashboard/*` | Minimal signed-in page (Plan 3 replaces it) |

---

### Task 1: Hosted Supabase project (performed by the user)

This task needs a human with a Supabase account. The controller asks the user to complete it and to put the values into `.env.local`; the controller must not ask for secrets to be pasted into chat. Task 2 creates `.env.example`. Until then, use the variable names below.

- [ ] **Step 1: Create the project.** At https://supabase.com/dashboard, create a new project (free tier):
  - Name: `recall-atlas-dev`.
  - Database password: use **letters and digits only**. The migration script passes it inside a URL.
  - Region: nearest to you.
  - Keep "Data API" enabled.
- [ ] **Step 2: Configure auth URLs.** Go to **Authentication → URL Configuration**:
  - Site URL: `http://localhost:3000`
  - Redirect URLs: add `http://localhost:3000/auth/callback`
- [ ] **Step 3: Collect the values into `C:\Users\nickd\dev\recall-atlas\.env.local`:**
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
  SUPABASE_SECRET_KEY=sb_secret_...
  SUPABASE_DB_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
  ```
  - **URL and keys:** Project Settings → API Keys. If the project only shows legacy keys, use the `anon` key as the publishable key and the `service_role` key as the secret key.
  - **DB URL:** Connect → **Session pooler** connection string (IPv4-compatible), with the password filled in.
- [ ] **Step 4: Confirm** to the controller that `.env.local` exists. Don't paste its contents.

---

### Task 2: Dependencies, env, test configs, migration runner

**Files:**
- Create: `.env.example`, `lib/env.ts`, `vitest.integration.config.mts`, `scripts/db-push.ts`, `supabase/migrations/.gitkeep`
- Modify: `.gitignore`, `vitest.config.mts`, `package.json`

- [ ] **Step 1: Create the feature branch and install dependencies**

```powershell
cd C:\Users\nickd\dev\recall-atlas
git checkout -b plan-2-persistence
npm install @supabase/supabase-js@2.117.2 @supabase/ssr@0.12.7 server-only
npm install -D svgo@4.1.0 pg @types/pg
```

Expected: no `ERR!`.

- [ ] **Step 2: Commit `.env.example` but not real env files**

Append to `.gitignore`:

```
!.env.example
```

Create `.env.example`:

```
# Copy to .env.local and fill in (see docs/superpowers/plans/2026-10-02-plan-2-persistence-auth-services.md, Task 1).
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
# Server only. Never prefix with NEXT_PUBLIC_.
SUPABASE_SECRET_KEY=sb_secret_...
# Session pooler connection string, used only by `npm run db:push`.
SUPABASE_DB_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

- [ ] **Step 3: Create `lib/env.ts`**

```ts
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`);
  }
  return value;
}

export function publicEnv() {
  return {
    supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL'),
    supabasePublishableKey: required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  };
}

/** Server-only values. Never import the result into client components. */
export function serverEnv() {
  return { ...publicEnv(), supabaseSecretKey: required('SUPABASE_SECRET_KEY') };
}
```

- [ ] **Step 4: Split unit and integration test configs**

Replace `vitest.config.mts` with:

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': root,
      // `server-only` throws outside React Server Components; tests run in plain Node.
      'server-only': path.join(root, 'node_modules', 'server-only', 'empty.js'),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', '**/*.int.test.ts'],
  },
});
```

Create `vitest.integration.config.mts`:

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': root,
      'server-only': path.join(root, 'node_modules', 'server-only', 'empty.js'),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.int.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
    env: loadEnv('test', root, ''),
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
```

Check that `node_modules/server-only/empty.js` exists (`Test-Path node_modules/server-only/empty.js`). If it doesn't, point the alias at a new `test/server-only-stub.ts` containing `export {};`.

- [ ] **Step 5: Create the migration runner**

Create `supabase/migrations/.gitkeep` (empty) and `scripts/db-push.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { Client } from 'pg';

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error('Missing SUPABASE_DB_URL in .env.local');

  const dir = path.join(process.cwd(), 'supabase', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(
      'create schema if not exists private; ' +
        'create table if not exists private.migrations (name text primary key, applied_at timestamptz not null default now())',
    );
    const { rows } = await client.query<{ name: string }>('select name from private.migrations');
    const applied = new Set(rows.map((r) => r.name));
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip    ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into private.migrations (name) values ($1)', [file]);
        await client.query('commit');
        console.log(`applied ${file}`);
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 6: Add scripts**

In `package.json` `"scripts"` add:

```json
"test:integration": "vitest run --config vitest.integration.config.mts",
"db:push": "tsx scripts/db-push.ts"
```

- [ ] **Step 7: Verify**

```powershell
npm test
npm run typecheck
npm run db:push
```

Expected:
- `npm test`: 136 tests still pass.
- `npm run typecheck`: clean.
- `npm run db:push`: connects and prints nothing, since there are no `.sql` files yet. If it fails with a connection or SSL error, check `SUPABASE_DB_URL` (it must be the session pooler URL) before changing code.

- [ ] **Step 8: Commit**

```powershell
git add .gitignore .env.example lib/env.ts vitest.config.mts vitest.integration.config.mts scripts/db-push.ts supabase package.json package-lock.json
git commit -m "chore: add Supabase deps, env access, integration test config, migration runner"
```

---

### Task 3: Scrubbed flag art outside `public/`

**Files:**
- Modify: `scripts/build-content.ts`, `scripts/lib/build-countries.ts`, `scripts/lib/build-countries.test.ts`, `lib/content/types.ts`, `lib/content/world-flags.ts`, `lib/content/world-flags.test.ts`, `next.config.ts`
- Create: `lib/content/flag-art.ts`, `lib/content/flag-art.test.ts`
- Move: `public/flags/*.svg` → `content/flags/*.svg` (regenerated)

Why: `public/flags/ec.svg` and the SVG's own `id="flag-icons-ec"` both reveal the answer to a Flag → Name question. Flags are now served only as data URIs built server-side from scrubbed files. A data URI also isolates each SVG's internal ids, so eight inline flags on one page can't clash.

- [ ] **Step 1: Write the failing flag-art test**

Create `lib/content/flag-art.test.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { flagDataUri } from './flag-art';
import { WORLD_FLAGS } from './world-flags';

describe('flagDataUri', () => {
  it('returns an SVG data URI for every World Flags item', () => {
    for (const item of WORLD_FLAGS.items) {
      expect(flagDataUri(item.key)).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    }
  });

  it('never contains identifying markup', () => {
    for (const item of WORLD_FLAGS.items) {
      const svg = decodeURIComponent(flagDataUri(item.key).split(',')[1]);
      expect(svg).not.toContain('flag-icons');
      expect(svg).not.toMatch(new RegExp(`id="${item.key.toLowerCase()}"`, 'i'));
    }
  });

  it('no longer ships flags from public/', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'public', 'flags'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/content/flag-art.test.ts`
Expected: FAIL. `Failed to resolve import "./flag-art"`.

- [ ] **Step 3: Drop the public flag path from content records**

In `lib/content/types.ts`, delete the `flag` field (and its comment) from `CountryRecord`.

In `scripts/lib/build-countries.ts`, delete the line that sets `flag: \`/flags/${c.key.toLowerCase()}.svg\`,` in the returned record.

In `scripts/lib/build-countries.test.ts`, delete the test `'points each country at its flag path'`.

In `lib/content/world-flags.ts`, delete the `flagPath` function.

- [ ] **Step 4: Write optimized, scrubbed flags to `content/flags/`**

Replace `scripts/build-content.ts` with:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { optimize } from 'svgo';
import worldCountries from 'world-countries';
import { GROUP_ORDER } from './content-config';
import { buildCountries, type RawCountry } from './lib/build-countries';

const root = process.cwd();
const { countries, warnings } = buildCountries(worldCountries as unknown as RawCountry[]);

for (const group of GROUP_ORDER) {
  if (!countries.some((c) => c.group === group)) throw new Error(`Group "${group}" has no countries`);
}

const flagSrc = path.join(root, 'node_modules', 'flag-icons', 'flags', '4x3');
const flagDest = path.join(root, 'content', 'flags');
fs.rmSync(path.join(root, 'public', 'flags'), { recursive: true, force: true });
fs.rmSync(flagDest, { recursive: true, force: true });
fs.mkdirSync(flagDest, { recursive: true });

let totalBytes = 0;
for (const c of countries) {
  const file = `${c.key.toLowerCase()}.svg`;
  const src = path.join(flagSrc, file);
  if (!fs.existsSync(src)) throw new Error(`Missing flag asset: ${src}`);
  const { data } = optimize(fs.readFileSync(src, 'utf8'), {
    multipass: true,
    plugins: ['preset-default', { name: 'removeAttrs', params: { attrs: 'svg:id' } }],
  });
  if (data.includes('flag-icons')) throw new Error(`Flag ${file} still contains identifying markup`);
  fs.writeFileSync(path.join(flagDest, file), data);
  totalBytes += Buffer.byteLength(data);
}

fs.writeFileSync(path.join(root, 'content', 'countries.json'), JSON.stringify(countries, null, 2) + '\n');

for (const w of warnings) console.warn(`warn: ${w}`);
console.log(
  `Wrote ${countries.length} countries to content/countries.json and ${countries.length} flags ` +
    `(${(totalBytes / 1024).toFixed(0)} KB) to content/flags/.`,
);
```

(If the existing script differs from the plan's Task 15 version, for example because it already has the empty-group check, keep the behavior above. It is a superset.)

- [ ] **Step 5: Implement the loader**

Create `lib/content/flag-art.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';

const FLAG_DIR = path.join(process.cwd(), 'content', 'flags');
const cache = new Map<string, string>();

/**
 * A flag as an `<img src>`-ready data URI. Server-side only (reads the file system).
 * Data URIs keep the country code out of URLs and isolate each SVG's internal ids.
 */
export function flagDataUri(itemKey: string): string {
  const cached = cache.get(itemKey);
  if (cached) return cached;
  const svg = fs.readFileSync(path.join(FLAG_DIR, `${itemKey.toLowerCase()}.svg`), 'utf8');
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  cache.set(itemKey, uri);
  return uri;
}
```

- [ ] **Step 6: Ship `content/flags` with the server bundle**

In `next.config.ts`, add to the config object:

```ts
  outputFileTracingIncludes: {
    '/**': ['./content/flags/**/*'],
  },
```

- [ ] **Step 7: Update the World Flags test**

In `lib/content/world-flags.test.ts`:
- Remove the `flagPath` import.
- Change the "has a flag file for every item" test to check `path.join(process.cwd(), 'content', 'flags', \`${item.key.toLowerCase()}.svg\`)`.

- [ ] **Step 8: Regenerate and verify**

```powershell
npm run content:build
npx vitest run lib/content scripts
```

Expected:
- `content:build` prints `Wrote 197 countries … 197 flags (<N> KB) to content/flags/.`, and `public/flags/` is gone.
- All content and script tests pass, including the drift test against the regenerated `countries.json` and the new flag-art tests.

Record the KB figure in your report.

- [ ] **Step 9: Full check and commit**

```powershell
npm test
npm run typecheck
npm run lint
git add -A content public scripts lib/content next.config.ts
git commit -m "feat(content): serve scrubbed, optimized flags as data URIs from content/flags"
```

---

### Task 4: Database schema, RLS, and `commit_turn`

**Files:**
- Create: `supabase/migrations/20261002000000_init.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20261002000000_init.sql`:

```sql
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
```

- [ ] **Step 2: Apply it**

Run: `npm run db:push`
Expected: `applied 20261002000000_init.sql`. Running it again prints `skip    20261002000000_init.sql`.

- [ ] **Step 3: Sanity-check in the dashboard**

In the Supabase dashboard **Table Editor**, the six tables exist with RLS enabled. That's enough for now; the integration tests in Task 7 verify behavior.

- [ ] **Step 4: Commit**

```powershell
git add supabase
git commit -m "feat(db): add schema, RLS policies, and atomic commit_turn function"
```

---

### Task 5: Row serialization

**Files:**
- Create: `lib/db/serialize.ts`, `lib/db/serialize.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/db/serialize.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { graduate, isDue, newPromptState, type PromptState } from '@/lib/engine';
import { NOW } from '@/lib/engine/test-fixtures';
import { reviveCard, rowToPromptState, type PromptStateRow } from './serialize';

const learningRung3: PromptState = { ...newPromptState('EC', 'flag_to_name'), phase: 'learning', rung: 3 };

/** What Postgres jsonb hands back: Dates become ISO strings. */
function viaJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toRow(state: PromptState): PromptStateRow {
  const json = viaJson(state);
  return {
    item_key: json.itemKey,
    prompt_type: json.promptType,
    phase: json.phase,
    rung: json.rung,
    streak: json.streak,
    fsrs: json.fsrs as unknown as Record<string, unknown> | null,
  };
}

describe('rowToPromptState', () => {
  it('round-trips a graduated prompt, reviving FSRS dates so isDue works', () => {
    const graduated = graduate(learningRung3, NOW);
    const revived = rowToPromptState(toRow(graduated));
    expect(revived).toEqual(graduated);
    expect(revived.fsrs!.due).toBeInstanceOf(Date);
    expect(isDue(revived, graduated.fsrs!.due)).toBe(true);
    expect(isDue(revived, NOW)).toBe(false);
  });

  it('keeps a null FSRS card null', () => {
    const fresh = newPromptState('EC', 'name_to_flag');
    expect(rowToPromptState(toRow(fresh))).toEqual(fresh);
  });
});

describe('reviveCard', () => {
  it('handles a missing last_review', () => {
    const card = reviveCard({ due: NOW.toISOString(), stability: 1, difficulty: 5, reps: 0, lapses: 0, state: 0 });
    expect(card!.due).toEqual(NOW);
    expect(card!.last_review).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/db/serialize.test.ts`
Expected: FAIL. `Failed to resolve import "./serialize"`.

- [ ] **Step 3: Implement**

Create `lib/db/serialize.ts`:

```ts
import type { Card } from 'ts-fsrs';
import type { Phase, PromptState, Rung } from '@/lib/engine';

export interface PromptStateRow {
  item_key: string;
  prompt_type: string;
  phase: Phase;
  rung: number;
  streak: number;
  fsrs: Record<string, unknown> | null;
}

/** jsonb turns a ts-fsrs Card's Dates into ISO strings; turn them back. */
export function reviveCard(json: Record<string, unknown> | null): Card | null {
  if (!json) return null;
  const card = { ...json, due: new Date(json.due as string) } as unknown as Card;
  if (json.last_review) card.last_review = new Date(json.last_review as string);
  else delete card.last_review;
  return card;
}

export function rowToPromptState(row: PromptStateRow): PromptState {
  return {
    itemKey: row.item_key,
    promptType: row.prompt_type,
    phase: row.phase,
    rung: row.rung as Rung,
    streak: row.streak,
    fsrs: reviveCard(row.fsrs),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/db/serialize.test.ts`
Expected: PASS (3 tests). If `toEqual` fails on `last_review`, check whether ts-fsrs's `createEmptyCard` sets `last_review: undefined`. If it does, delete the key in the test's expected value rather than changing the reviver to add `undefined`.

- [ ] **Step 5: Commit**

```powershell
git add lib/db
git commit -m "feat(db): serialize prompt states and revive FSRS dates"
```

---

### Task 6: Study types, `UserStore`, in-memory store, contract suite

**Files:**
- Create: `lib/study/types.ts`, `lib/db/store.ts`, `lib/db/memory-store.ts`, `lib/db/store-contract.ts`, `lib/db/memory-store.test.ts`

- [ ] **Step 1: Create the study types (needed by the store interface)**

Create `lib/study/types.ts`:

```ts
import type { Format, QuestionRung, QueueEntry, StudyOutcome } from '@/lib/engine';

export type SessionKind = 'study' | 'placement' | 'exam';

/** Server-side record of a question shown to the learner. Never sent to the browser. */
export interface PendingQuestion {
  questionId: string;
  entry: QueueEntry;
  rung: QuestionRung;
  format: Format;
  /** Opaque choice id → item key, in display order. Empty for intro/typed. */
  choices: { id: string; itemKey: string }[];
  /** ISO timestamp; response time is measured server-side from this. */
  issuedAt: string;
}

export type AnswerResponse =
  | { kind: 'choice'; choiceId: string }
  | { kind: 'typed'; text: string }
  | { kind: 'dont-know' }
  | { kind: 'ack' };

export interface SubmissionInput {
  sessionId: string;
  questionId: string;
  response: AnswerResponse;
}

/** Everything the browser sees about a question. Contains no item keys. */
export interface QuestionView {
  sessionId: string;
  questionId: string;
  sessionKind: SessionKind;
  format: Format;
  progress: { answered: number; total: number };
  /** Flag → Name shows a flag; Name → Flag shows a name; intros show both. */
  prompt: { name?: string; flag?: string };
  choices?: { id: string; label?: string; flag?: string }[];
  /** Contrast drills: the two confused items side by side, labelled. */
  pair?: { name: string; flag: string }[];
}

export interface ItemView {
  name: string;
  flag: string;
}

export interface FeedbackView {
  correct: boolean;
  typo: boolean;
  answer: ItemView;
  /** The other item the learner's answer resolved to, if any. */
  given?: ItemView;
  outcome?: StudyOutcome;
  contrastQueued?: boolean;
}

export type EndReason =
  | 'complete'
  | 'caught_up'
  | 'come_back_later'
  | 'more_new_available'
  | 'placement_complete'
  | 'exam_finished';

export interface EndView {
  reason: EndReason;
  examResult?: { score: number; total: number; passed: boolean; missed: ItemView[] };
}

export interface TurnResult {
  feedback?: FeedbackView;
  next: QuestionView | null;
  end?: EndView;
}

export type ServiceErrorCode =
  | 'not_enrolled'
  | 'placement_pending'
  | 'placement_done'
  | 'exam_in_progress'
  | 'exam_not_ready'
  | 'no_active_session'
  | 'stale_question'
  | 'invalid_response';

export class ServiceError extends Error {
  constructor(public readonly code: ServiceErrorCode) {
    super(code);
    this.name = 'ServiceError';
  }
}
```

- [ ] **Step 2: Create the store interface**

Create `lib/db/store.ts`:

```ts
import type { Confusion, PromptState } from '@/lib/engine';
import type { PendingQuestion, SessionKind } from '@/lib/study/types';

export interface EnrollmentRecord {
  courseSlug: string;
  placementCompletedAt: Date | null;
  passedAt: Date | null;
  createdAt: Date;
}

export interface SessionRecord {
  id: string;
  courseSlug: string;
  kind: SessionKind;
  /** Engine session object (StudySession, QueueSession, or ExamState). */
  state: unknown;
  pendingQuestion: PendingQuestion | null;
  version: number;
  startedAt: Date;
  updatedAt: Date;
}

export interface AnswerLog {
  questionId: string;
  context: SessionKind;
  kind: 'prompt' | 'contrast';
  itemKey: string;
  promptType: string | null;
  format: string;
  rung: number | null;
  givenText: string | null;
  givenItemKey: string | null;
  correct: boolean;
  responseMs: number | null;
}

export interface ExamAttemptRecord {
  sessionId: string;
  score: number;
  total: number;
  passed: boolean;
  missedItemKeys: string[];
  finishedAt: Date;
}

export interface TurnCommit {
  sessionId: string;
  expectedVersion: number;
  sessionState: unknown;
  pendingQuestion: PendingQuestion | null;
  completed: boolean;
  /** Only the prompt states that changed this turn. */
  promptStates: PromptState[];
  answer?: AnswerLog;
  /** Increments the pair's count by one. */
  confusion?: { asked: string; answered: string };
  /** Milestones are set once and never overwritten. */
  enrollment?: { placementCompletedAt?: Date; passedAt?: Date };
  examAttempt?: { score: number; total: number; passed: boolean; missedItemKeys: string[] };
}

export class StaleSessionError extends Error {
  constructor() {
    super('stale_session');
    this.name = 'StaleSessionError';
  }
}

export class SessionConflictError extends Error {
  constructor() {
    super('session_conflict');
    this.name = 'SessionConflictError';
  }
}

/** Persistence for one user. Every method is implicitly scoped to that user. */
export interface UserStore {
  getEnrollment(courseSlug: string): Promise<EnrollmentRecord | null>;
  /** Idempotent. */
  enroll(courseSlug: string): Promise<EnrollmentRecord>;
  /** No-op if already set. */
  setPlacementCompleted(courseSlug: string, at: Date): Promise<void>;
  /** Stored (touched) prompt states only, FSRS dates revived. Use hydrateStates for the full set. */
  getPromptStates(courseSlug: string): Promise<PromptState[]>;
  /** Sorted by asked, then answered key. */
  getConfusions(courseSlug: string): Promise<Confusion[]>;
  getActiveSession(courseSlug: string): Promise<SessionRecord | null>;
  /** Throws SessionConflictError if the course already has an active session. */
  createSession(args: {
    courseSlug: string;
    kind: SessionKind;
    state: unknown;
    pendingQuestion: PendingQuestion | null;
  }): Promise<SessionRecord>;
  completeSession(sessionId: string): Promise<void>;
  /** Atomic. Throws StaleSessionError if the session is inactive or its version moved on. */
  commitTurn(courseSlug: string, commit: TurnCommit): Promise<void>;
  getExamAttempts(courseSlug: string): Promise<ExamAttemptRecord[]>;
}
```

- [ ] **Step 3: Write the contract suite**

Create `lib/db/store-contract.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { graduate, isDue, newPromptState, type PromptState } from '@/lib/engine';
import { NOW } from '@/lib/engine/test-fixtures';
import { SessionConflictError, StaleSessionError, type UserStore } from './store';

const SLUG = 'contract-course';
const graduated = (key: string): PromptState =>
  graduate({ ...newPromptState(key, 'flag_to_name'), phase: 'learning', rung: 3 }, NOW);

/** Behavior every UserStore must share. Run against MemoryStore (unit) and SupabaseStore (integration). */
export function describeStoreContract(
  name: string,
  setup: () => Promise<{ store: UserStore; cleanup?: () => Promise<void> }>,
) {
  describe(`${name} satisfies the UserStore contract`, () => {
    let store: UserStore;
    let cleanup: (() => Promise<void>) | undefined;

    beforeEach(async () => {
      ({ store, cleanup } = await setup());
    });
    afterEach(async () => {
      await cleanup?.();
    });

    async function openSession(state: unknown = { step: 0 }) {
      await store.enroll(SLUG);
      return store.createSession({ courseSlug: SLUG, kind: 'study', state, pendingQuestion: null });
    }

    it('enrolls idempotently', async () => {
      expect(await store.getEnrollment(SLUG)).toBeNull();
      const first = await store.enroll(SLUG);
      const second = await store.enroll(SLUG);
      expect(second.createdAt).toEqual(first.createdAt);
      expect(first).toMatchObject({ courseSlug: SLUG, placementCompletedAt: null, passedAt: null });
    });

    it('sets placement completion once', async () => {
      await store.enroll(SLUG);
      const at = new Date('2026-10-02T10:00:00Z');
      await store.setPlacementCompleted(SLUG, at);
      await store.setPlacementCompleted(SLUG, new Date('2026-10-03T10:00:00Z'));
      expect((await store.getEnrollment(SLUG))!.placementCompletedAt).toEqual(at);
    });

    it('creates one active session per course and rejects a second', async () => {
      const session = await openSession({ step: 1 });
      expect(session.version).toBe(0);
      const active = await store.getActiveSession(SLUG);
      expect(active).toMatchObject({ id: session.id, kind: 'study', state: { step: 1 }, pendingQuestion: null });
      await expect(
        store.createSession({ courseSlug: SLUG, kind: 'exam', state: {}, pendingQuestion: null }),
      ).rejects.toBeInstanceOf(SessionConflictError);
    });

    it('commits a turn: state, version, prompt states with revived dates', async () => {
      const session = await openSession();
      const ec = graduated('EC');
      await store.commitTurn(SLUG, {
        sessionId: session.id,
        expectedVersion: 0,
        sessionState: { step: 1 },
        pendingQuestion: null,
        completed: false,
        promptStates: [ec],
      });
      const active = await store.getActiveSession(SLUG);
      expect(active).toMatchObject({ version: 1, state: { step: 1 } });
      const [loaded] = await store.getPromptStates(SLUG);
      expect(loaded).toEqual(ec);
      expect(isDue(loaded, ec.fsrs!.due)).toBe(true);
    });

    it('rejects a stale version and a completed session', async () => {
      const session = await openSession();
      const base = { sessionId: session.id, sessionState: {}, pendingQuestion: null, promptStates: [] };
      await expect(
        store.commitTurn(SLUG, { ...base, expectedVersion: 5, completed: false }),
      ).rejects.toBeInstanceOf(StaleSessionError);
      await store.commitTurn(SLUG, { ...base, expectedVersion: 0, completed: true });
      expect(await store.getActiveSession(SLUG)).toBeNull();
      await expect(
        store.commitTurn(SLUG, { ...base, expectedVersion: 1, completed: false }),
      ).rejects.toBeInstanceOf(StaleSessionError);
    });

    it('increments confusions and returns them sorted', async () => {
      const session = await openSession();
      const commit = (v: number, asked: string, answered: string) =>
        store.commitTurn(SLUG, {
          sessionId: session.id,
          expectedVersion: v,
          sessionState: {},
          pendingQuestion: null,
          completed: false,
          promptStates: [],
          confusion: { asked, answered },
        });
      await commit(0, 'TD', 'RO');
      await commit(1, 'EC', 'CO');
      await commit(2, 'TD', 'RO');
      expect(await store.getConfusions(SLUG)).toEqual([
        { asked: 'EC', answered: 'CO', count: 1 },
        { asked: 'TD', answered: 'RO', count: 2 },
      ]);
    });

    it('records answers, enrollment milestones (set once) and exam attempts', async () => {
      const session = await openSession();
      const passedAt = new Date('2026-10-02T12:00:00Z');
      await store.commitTurn(SLUG, {
        sessionId: session.id,
        expectedVersion: 0,
        sessionState: {},
        pendingQuestion: null,
        completed: false,
        promptStates: [],
        answer: {
          questionId: randomUUID(),
          context: 'exam',
          kind: 'prompt',
          itemKey: 'EC',
          promptType: 'flag_to_name',
          format: 'typed',
          rung: 3,
          givenText: 'Ecuador',
          givenItemKey: 'EC',
          correct: true,
          responseMs: 1200,
        },
        enrollment: { passedAt },
        examAttempt: { score: 1, total: 1, passed: true, missedItemKeys: [] },
      });
      await store.commitTurn(SLUG, {
        sessionId: session.id,
        expectedVersion: 1,
        sessionState: {},
        pendingQuestion: null,
        completed: true,
        promptStates: [],
        enrollment: { passedAt: new Date('2027-01-01T00:00:00Z') },
      });
      expect((await store.getEnrollment(SLUG))!.passedAt).toEqual(passedAt);
      const attempts = await store.getExamAttempts(SLUG);
      expect(attempts).toHaveLength(1);
      expect(attempts[0]).toMatchObject({ sessionId: session.id, score: 1, total: 1, passed: true, missedItemKeys: [] });
    });

    it('completes a session', async () => {
      const session = await openSession();
      await store.completeSession(session.id);
      expect(await store.getActiveSession(SLUG)).toBeNull();
    });
  });
}
```

- [ ] **Step 4: Write the failing memory-store test**

Create `lib/db/memory-store.test.ts`:

```ts
import { describeStoreContract } from './store-contract';
import { MemoryStore } from './memory-store';

describeStoreContract('MemoryStore', async () => ({ store: new MemoryStore() }));
```

- [ ] **Step 5: Run to verify it fails**

Run: `npx vitest run lib/db/memory-store.test.ts`
Expected: FAIL. `Failed to resolve import "./memory-store"`.

- [ ] **Step 6: Implement the memory store**

Create `lib/db/memory-store.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { Confusion, PromptState } from '@/lib/engine';
import { stateKey } from '@/lib/engine';
import type { SessionKind, PendingQuestion } from '@/lib/study/types';
import {
  SessionConflictError,
  StaleSessionError,
  type AnswerLog,
  type EnrollmentRecord,
  type ExamAttemptRecord,
  type SessionRecord,
  type TurnCommit,
  type UserStore,
} from './store';

interface StoredSession extends SessionRecord {
  completedAt: Date | null;
}

const clone = <T>(value: T): T => structuredClone(value);

/** In-memory UserStore for unit tests. Mirrors SupabaseStore semantics (see store-contract.ts). */
export class MemoryStore implements UserStore {
  readonly answers: (AnswerLog & { courseSlug: string })[] = [];
  private readonly enrollments = new Map<string, EnrollmentRecord>();
  private readonly states = new Map<string, Map<string, PromptState>>();
  private readonly confusions = new Map<string, Map<string, Confusion>>();
  private readonly sessions: StoredSession[] = [];
  private readonly attempts = new Map<string, ExamAttemptRecord[]>();

  constructor(private readonly clock: () => Date = () => new Date()) {}

  async getEnrollment(courseSlug: string) {
    const e = this.enrollments.get(courseSlug);
    return e ? clone(e) : null;
  }

  async enroll(courseSlug: string) {
    if (!this.enrollments.has(courseSlug)) {
      this.enrollments.set(courseSlug, { courseSlug, placementCompletedAt: null, passedAt: null, createdAt: this.clock() });
    }
    return clone(this.enrollments.get(courseSlug)!);
  }

  async setPlacementCompleted(courseSlug: string, at: Date) {
    const e = this.enrollments.get(courseSlug);
    if (e && !e.placementCompletedAt) e.placementCompletedAt = at;
  }

  async getPromptStates(courseSlug: string) {
    return clone([...(this.states.get(courseSlug)?.values() ?? [])]);
  }

  async getConfusions(courseSlug: string) {
    return clone(
      [...(this.confusions.get(courseSlug)?.values() ?? [])].sort(
        (a, b) => a.asked.localeCompare(b.asked) || a.answered.localeCompare(b.answered),
      ),
    );
  }

  async getActiveSession(courseSlug: string) {
    const s = this.sessions.find((x) => x.courseSlug === courseSlug && x.completedAt === null);
    if (!s) return null;
    const { completedAt: _completedAt, ...record } = s;
    return clone(record);
  }

  async createSession(args: { courseSlug: string; kind: SessionKind; state: unknown; pendingQuestion: PendingQuestion | null }) {
    if (await this.getActiveSession(args.courseSlug)) throw new SessionConflictError();
    const now = this.clock();
    const session: StoredSession = {
      id: randomUUID(),
      courseSlug: args.courseSlug,
      kind: args.kind,
      state: clone(args.state),
      pendingQuestion: clone(args.pendingQuestion),
      version: 0,
      startedAt: now,
      updatedAt: now,
      completedAt: null,
    };
    this.sessions.push(session);
    const { completedAt: _completedAt, ...record } = session;
    return clone(record);
  }

  async completeSession(sessionId: string) {
    const s = this.sessions.find((x) => x.id === sessionId);
    if (s && !s.completedAt) s.completedAt = this.clock();
  }

  async commitTurn(courseSlug: string, commit: TurnCommit) {
    const s = this.sessions.find((x) => x.id === commit.sessionId);
    if (!s || s.courseSlug !== courseSlug || s.completedAt || s.version !== commit.expectedVersion) {
      throw new StaleSessionError();
    }
    const now = this.clock();
    s.state = clone(commit.sessionState);
    s.pendingQuestion = clone(commit.pendingQuestion);
    s.version += 1;
    s.updatedAt = now;
    if (commit.completed) s.completedAt = now;

    if (!this.states.has(courseSlug)) this.states.set(courseSlug, new Map());
    for (const st of commit.promptStates) this.states.get(courseSlug)!.set(stateKey(st.itemKey, st.promptType), clone(st));

    if (commit.answer) this.answers.push({ ...clone(commit.answer), courseSlug });

    if (commit.confusion) {
      if (!this.confusions.has(courseSlug)) this.confusions.set(courseSlug, new Map());
      const map = this.confusions.get(courseSlug)!;
      const key = `${commit.confusion.asked}>${commit.confusion.answered}`;
      const existing = map.get(key);
      map.set(key, { ...commit.confusion, count: (existing?.count ?? 0) + 1 });
    }

    const e = this.enrollments.get(courseSlug);
    if (e && commit.enrollment) {
      e.placementCompletedAt ??= commit.enrollment.placementCompletedAt ?? null;
      e.passedAt ??= commit.enrollment.passedAt ?? null;
    }

    if (commit.examAttempt) {
      const list = this.attempts.get(courseSlug) ?? [];
      list.push({ ...clone(commit.examAttempt), sessionId: s.id, finishedAt: now });
      this.attempts.set(courseSlug, list);
    }
  }

  async getExamAttempts(courseSlug: string) {
    return clone(this.attempts.get(courseSlug) ?? []);
  }

  // ---- Test seeding helpers (not part of UserStore) ----

  seedPromptStates(courseSlug: string, states: PromptState[]) {
    if (!this.states.has(courseSlug)) this.states.set(courseSlug, new Map());
    for (const st of states) this.states.get(courseSlug)!.set(stateKey(st.itemKey, st.promptType), clone(st));
  }

  seedConfusion(courseSlug: string, asked: string, answered: string, count: number) {
    if (!this.confusions.has(courseSlug)) this.confusions.set(courseSlug, new Map());
    this.confusions.get(courseSlug)!.set(`${asked}>${answered}`, { asked, answered, count });
  }

  /** Simulate time passing for an active session (e.g. staleness tests). */
  backdateActiveSession(courseSlug: string, updatedAt: Date) {
    const s = this.sessions.find((x) => x.courseSlug === courseSlug && x.completedAt === null);
    if (s) s.updatedAt = updatedAt;
  }
}
```

- [ ] **Step 7: Run to verify it passes**

Run: `npx vitest run lib/db`
Expected: PASS (8 contract tests + 3 serialize tests). If lint flags the `_completedAt` destructuring as unused, disable that one rule for the line with an inline `// eslint-disable-next-line @typescript-eslint/no-unused-vars` comment, or restructure with a `toRecord` helper. Don't weaken the lint config.

- [ ] **Step 8: Commit**

```powershell
npm run typecheck
npm run lint
git add lib/db lib/study/types.ts
git commit -m "feat(db): add UserStore interface, contract suite, and in-memory store"
```

---

### Task 7: Supabase store + integration tests

**Files:**
- Create: `lib/supabase/admin.ts`, `lib/db/supabase-store.ts`, `lib/db/supabase-store.int.test.ts`, `lib/db/rls.int.test.ts`

- [ ] **Step 1: Create the secret-key client**

Create `lib/supabase/admin.ts`:

```ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env';

/** Bypasses RLS. Server-only; every query must filter by the authenticated user's id. */
export function createAdminClient() {
  const env = serverEnv();
  return createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **Step 2: Write the integration test (contract against Supabase)**

Create `lib/db/supabase-store.int.test.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { describeStoreContract } from './store-contract';
import { createSupabaseStore } from './supabase-store';

const admin = createAdminClient();

describeStoreContract('SupabaseStore', async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: `it-${randomUUID()}@example.com`,
    password: randomUUID(),
    email_confirm: true,
  });
  if (error) throw error;
  const userId = data.user.id;
  return {
    store: createSupabaseStore(admin, userId),
    cleanup: async () => {
      await admin.auth.admin.deleteUser(userId);
    },
  };
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm run test:integration -- lib/db/supabase-store.int.test.ts`
Expected: FAIL. `Failed to resolve import "./supabase-store"`.

- [ ] **Step 4: Implement**

Create `lib/db/supabase-store.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Confusion, PromptState } from '@/lib/engine';
import type { PendingQuestion, SessionKind } from '@/lib/study/types';
import { rowToPromptState, type PromptStateRow } from './serialize';
import {
  SessionConflictError,
  StaleSessionError,
  type EnrollmentRecord,
  type ExamAttemptRecord,
  type SessionRecord,
  type TurnCommit,
  type UserStore,
} from './store';

interface EnrollmentRow {
  course_slug: string;
  placement_completed_at: string | null;
  passed_at: string | null;
  created_at: string;
}

interface SessionRow {
  id: string;
  course_slug: string;
  kind: SessionKind;
  state: unknown;
  pending_question: PendingQuestion | null;
  version: number;
  started_at: string;
  updated_at: string;
}

const toDate = (v: string | null) => (v ? new Date(v) : null);

function toEnrollment(row: EnrollmentRow): EnrollmentRecord {
  return {
    courseSlug: row.course_slug,
    placementCompletedAt: toDate(row.placement_completed_at),
    passedAt: toDate(row.passed_at),
    createdAt: new Date(row.created_at),
  };
}

function toSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    courseSlug: row.course_slug,
    kind: row.kind,
    state: row.state,
    pendingQuestion: row.pending_question,
    version: row.version,
    startedAt: new Date(row.started_at),
    updatedAt: new Date(row.updated_at),
  };
}

function fail(context: string, error: { message: string }): never {
  throw new Error(`${context}: ${error.message}`);
}

/** Postgres-backed UserStore. `admin` must be a secret-key client; every query is scoped to `userId`. */
export function createSupabaseStore(admin: SupabaseClient, userId: string): UserStore {
  const SESSION_COLUMNS = 'id, course_slug, kind, state, pending_question, version, started_at, updated_at';

  async function getEnrollment(courseSlug: string): Promise<EnrollmentRecord | null> {
    const { data, error } = await admin
      .from('enrollments')
      .select('course_slug, placement_completed_at, passed_at, created_at')
      .eq('user_id', userId)
      .eq('course_slug', courseSlug)
      .maybeSingle<EnrollmentRow>();
    if (error) fail('getEnrollment', error);
    return data ? toEnrollment(data) : null;
  }

  return {
    getEnrollment,

    async enroll(courseSlug) {
      const { error } = await admin
        .from('enrollments')
        .upsert({ user_id: userId, course_slug: courseSlug }, { onConflict: 'user_id,course_slug', ignoreDuplicates: true });
      if (error) fail('enroll', error);
      return (await getEnrollment(courseSlug))!;
    },

    async setPlacementCompleted(courseSlug, at) {
      const { error } = await admin
        .from('enrollments')
        .update({ placement_completed_at: at.toISOString() })
        .eq('user_id', userId)
        .eq('course_slug', courseSlug)
        .is('placement_completed_at', null);
      if (error) fail('setPlacementCompleted', error);
    },

    async getPromptStates(courseSlug): Promise<PromptState[]> {
      const { data, error } = await admin
        .from('prompt_states')
        .select('item_key, prompt_type, phase, rung, streak, fsrs')
        .eq('user_id', userId)
        .eq('course_slug', courseSlug)
        .returns<PromptStateRow[]>();
      if (error) fail('getPromptStates', error);
      return (data ?? []).map(rowToPromptState);
    },

    async getConfusions(courseSlug): Promise<Confusion[]> {
      const { data, error } = await admin
        .from('confusions')
        .select('asked_item_key, answered_item_key, count')
        .eq('user_id', userId)
        .eq('course_slug', courseSlug)
        .order('asked_item_key')
        .order('answered_item_key')
        .returns<{ asked_item_key: string; answered_item_key: string; count: number }[]>();
      if (error) fail('getConfusions', error);
      return (data ?? []).map((r) => ({ asked: r.asked_item_key, answered: r.answered_item_key, count: r.count }));
    },

    async getActiveSession(courseSlug) {
      const { data, error } = await admin
        .from('sessions')
        .select(SESSION_COLUMNS)
        .eq('user_id', userId)
        .eq('course_slug', courseSlug)
        .is('completed_at', null)
        .maybeSingle<SessionRow>();
      if (error) fail('getActiveSession', error);
      return data ? toSession(data) : null;
    },

    async createSession({ courseSlug, kind, state, pendingQuestion }) {
      const { data, error } = await admin
        .from('sessions')
        .insert({ user_id: userId, course_slug: courseSlug, kind, state, pending_question: pendingQuestion })
        .select(SESSION_COLUMNS)
        .single<SessionRow>();
      if (error) {
        if (error.code === '23505') throw new SessionConflictError();
        fail('createSession', error);
      }
      return toSession(data);
    },

    async completeSession(sessionId) {
      const { error } = await admin
        .from('sessions')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('user_id', userId)
        .is('completed_at', null);
      if (error) fail('completeSession', error);
    },

    async commitTurn(courseSlug, c: TurnCommit) {
      const p = {
        user_id: userId,
        session_id: c.sessionId,
        course_slug: courseSlug,
        expected_version: c.expectedVersion,
        session_state: c.sessionState,
        pending_question: c.pendingQuestion,
        completed: c.completed,
        prompt_states: c.promptStates,
        answer: c.answer
          ? {
              question_id: c.answer.questionId,
              context: c.answer.context,
              kind: c.answer.kind,
              item_key: c.answer.itemKey,
              prompt_type: c.answer.promptType,
              format: c.answer.format,
              rung: c.answer.rung,
              given_text: c.answer.givenText,
              given_item_key: c.answer.givenItemKey,
              correct: c.answer.correct,
              response_ms: c.answer.responseMs,
            }
          : null,
        confusion: c.confusion ?? null,
        enrollment: c.enrollment
          ? {
              placement_completed_at: c.enrollment.placementCompletedAt?.toISOString() ?? null,
              passed_at: c.enrollment.passedAt?.toISOString() ?? null,
            }
          : null,
        exam_attempt: c.examAttempt
          ? {
              score: c.examAttempt.score,
              total: c.examAttempt.total,
              passed: c.examAttempt.passed,
              missed_item_keys: c.examAttempt.missedItemKeys,
            }
          : null,
      };
      const { error } = await admin.rpc('commit_turn', { p });
      if (error) {
        if (error.message.includes('stale_session')) throw new StaleSessionError();
        fail('commitTurn', error);
      }
    },

    async getExamAttempts(courseSlug): Promise<ExamAttemptRecord[]> {
      const { data, error } = await admin
        .from('exam_attempts')
        .select('session_id, score, total, passed, missed_item_keys, finished_at')
        .eq('user_id', userId)
        .eq('course_slug', courseSlug)
        .order('finished_at')
        .returns<
          { session_id: string; score: number; total: number; passed: boolean; missed_item_keys: string[]; finished_at: string }[]
        >();
      if (error) fail('getExamAttempts', error);
      return (data ?? []).map((r) => ({
        sessionId: r.session_id,
        score: r.score,
        total: r.total,
        passed: r.passed,
        missedItemKeys: r.missed_item_keys,
        finishedAt: new Date(r.finished_at),
      }));
    },
  };
}
```

Note: if `.returns<T>()` is deprecated in supabase-js 2.117 (a typecheck warning or error), use `.overrideTypes<T, { merge: false }>()` or a cast on `data` instead. Report which.

- [ ] **Step 5: Run the contract against Supabase**

Run: `npm run test:integration -- lib/db/supabase-store.int.test.ts`
Expected: PASS (8 tests). Any difference from `MemoryStore` is a bug in one of the two stores. Fix the store rather than the contract, unless the contract is wrong for both.

- [ ] **Step 6: Write the RLS test**

Create `lib/db/rls.int.test.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newPromptState } from '@/lib/engine';
import { publicEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSupabaseStore } from './supabase-store';

const admin = createAdminClient();
const env = publicEnv();
const SLUG = 'rls-course';

async function makeUser() {
  const email = `rls-${randomUUID()}@example.com`;
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient(env.supabaseUrl, env.supabasePublishableKey, { auth: { persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  const store = createSupabaseStore(admin, data.user.id);
  await store.enroll(SLUG);
  const session = await store.createSession({ courseSlug: SLUG, kind: 'study', state: {}, pendingQuestion: null });
  await store.commitTurn(SLUG, {
    sessionId: session.id,
    expectedVersion: 0,
    sessionState: {},
    pendingQuestion: null,
    completed: false,
    promptStates: [newPromptState('EC', 'flag_to_name')],
  });
  return { id: data.user.id, client };
}

describe('row level security', () => {
  let a: { id: string; client: SupabaseClient };
  let b: { id: string; client: SupabaseClient };

  beforeAll(async () => {
    a = await makeUser();
    b = await makeUser();
  });
  afterAll(async () => {
    await admin.auth.admin.deleteUser(a.id);
    await admin.auth.admin.deleteUser(b.id);
  });

  it('lets a signed-in user read only their own rows', async () => {
    for (const table of ['enrollments', 'prompt_states', 'sessions']) {
      const { data, error } = await a.client.from(table).select('user_id');
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
      expect(data!.every((r) => r.user_id === a.id)).toBe(true);
    }
  });

  it('rejects direct writes from the browser client', async () => {
    const insert = await a.client.from('prompt_states').insert({
      user_id: a.id,
      course_slug: SLUG,
      item_key: 'CO',
      prompt_type: 'flag_to_name',
      phase: 'review',
      rung: 3,
      streak: 0,
    });
    expect(insert.error).not.toBeNull();

    const update = await a.client.from('enrollments').update({ passed_at: new Date().toISOString() }).eq('user_id', a.id).select();
    expect(update.data ?? []).toHaveLength(0);
  });

  it('does not let users call commit_turn', async () => {
    const { error } = await a.client.rpc('commit_turn', { p: {} });
    expect(error).not.toBeNull();
  });

  it('shows anonymous clients nothing', async () => {
    const anon = createClient(env.supabaseUrl, env.supabasePublishableKey, { auth: { persistSession: false } });
    const { data } = await anon.from('prompt_states').select('user_id');
    expect(data ?? []).toHaveLength(0);
  });
});
```

- [ ] **Step 7: Run all integration tests**

Run: `npm run test:integration`
Expected: PASS (8 contract + 4 RLS tests). Tests create and delete their own users. If user creation fails with a rate limit, wait a minute and rerun. Don't add retries to the code.

- [ ] **Step 8: Commit**

```powershell
npm run typecheck
npm run lint
git add lib/supabase lib/db
git commit -m "feat(db): add Supabase-backed UserStore with contract and RLS integration tests"
```

---

### Task 8: Issuing questions, grading submissions, presenting views, validating input

**Files:**
- Create: `lib/server/random.ts`, `lib/study/issue.ts`, `lib/study/present.ts`, `lib/study/presenters.ts`, `lib/study/validate.ts`
- Test: `lib/study/issue.test.ts`, `lib/study/present.test.ts`, `lib/study/validate.test.ts`

- [ ] **Step 1: Create server randomness helpers**

Create `lib/server/random.ts`:

```ts
import { seededRng, type Rng } from '@/lib/engine';

/** Fresh unpredictable RNG per request; the engine itself never calls Math.random. */
export function cryptoRng(): Rng {
  const [seed] = crypto.getRandomValues(new Uint32Array(1));
  return seededRng(seed);
}

export function newId(): string {
  return crypto.randomUUID();
}
```

- [ ] **Step 2: Write the failing issue/grade tests**

Create `lib/study/issue.test.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seededRng } from '@/lib/engine';
import { NOW, TEST_COURSE } from '@/lib/engine/test-fixtures';
import { gradeSubmission, issueQuestion } from './issue';
import { ServiceError } from './types';

const issue = (entry: Parameters<typeof issueQuestion>[0]['entry'], rung: 1 | 2 | 3) =>
  issueQuestion({ entry, rung, course: TEST_COURSE, confusions: [], rng: seededRng(7), now: NOW, newId: randomUUID });

describe('issueQuestion', () => {
  it('gives each choice an opaque id and records the issue time', () => {
    const q = issue({ kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, 1);
    expect(q.format).toBe('mc-text');
    expect(q.choices).toHaveLength(4);
    expect(q.choices.map((c) => c.itemKey)).toContain('EC');
    expect(new Set(q.choices.map((c) => c.id)).size).toBe(4);
    expect(q.choices.every((c) => c.id !== c.itemKey)).toBe(true);
    expect(q.issuedAt).toBe(NOW.toISOString());
  });

  it('issues typed questions without choices', () => {
    expect(issue({ kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, 3)).toMatchObject({
      format: 'typed',
      choices: [],
    });
  });
});

describe('gradeSubmission', () => {
  const mc = issue({ kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, 1);
  const typed = issue({ kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, 3);
  const choiceFor = (key: string) => mc.choices.find((c) => c.itemKey === key);

  it('grades a correct choice and a wrong choice (reporting the confused item)', () => {
    expect(gradeSubmission(mc, { kind: 'choice', choiceId: choiceFor('EC')!.id }, TEST_COURSE)).toEqual({
      correct: true,
      typo: false,
      answeredItemKey: null,
    });
    const wrong = mc.choices.find((c) => c.itemKey !== 'EC')!;
    expect(gradeSubmission(mc, { kind: 'choice', choiceId: wrong.id }, TEST_COURSE)).toEqual({
      correct: false,
      typo: false,
      answeredItemKey: wrong.itemKey,
    });
  });

  it('grades typed answers with the engine rules', () => {
    expect(gradeSubmission(typed, { kind: 'typed', text: 'Equador' }, TEST_COURSE)).toEqual({
      correct: true,
      typo: true,
      answeredItemKey: null,
    });
  });

  it('treats "I don\'t know" as wrong with no confusion', () => {
    expect(gradeSubmission(typed, { kind: 'dont-know' }, TEST_COURSE)).toEqual({
      correct: false,
      typo: false,
      answeredItemKey: null,
    });
  });

  it('rejects choices that were never offered and responses of the wrong kind', () => {
    const bad = (fn: () => unknown) => expect(fn).toThrowError(new ServiceError('invalid_response'));
    bad(() => gradeSubmission(mc, { kind: 'choice', choiceId: randomUUID() }, TEST_COURSE));
    bad(() => gradeSubmission(mc, { kind: 'typed', text: 'Ecuador' }, TEST_COURSE));
    bad(() => gradeSubmission(typed, { kind: 'choice', choiceId: randomUUID() }, TEST_COURSE));
    bad(() => gradeSubmission(typed, { kind: 'ack' }, TEST_COURSE));
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run lib/study/issue.test.ts`
Expected: FAIL. `Failed to resolve import "./issue"`.

- [ ] **Step 4: Implement issue/grade**

Create `lib/study/issue.ts`:

```ts
import {
  buildQuestion,
  getItem,
  gradeChoice,
  gradeTyped,
  type AnswerGrade,
  type Confusion,
  type CourseDef,
  type QuestionRung,
  type QueueEntry,
  type Rng,
} from '@/lib/engine';
import { ServiceError, type AnswerResponse, type PendingQuestion } from './types';

export function issueQuestion(args: {
  entry: QueueEntry;
  rung: QuestionRung;
  course: CourseDef;
  confusions: readonly Confusion[];
  rng: Rng;
  now: Date;
  newId: () => string;
}): PendingQuestion {
  const { entry, rung, course, confusions, rng, now, newId } = args;
  const question = buildQuestion({ entry, rung, course, confusions, rng });
  return {
    questionId: newId(),
    entry,
    rung,
    format: question.format,
    choices: (question.choiceKeys ?? []).map((itemKey) => ({ id: newId(), itemKey })),
    issuedAt: now.toISOString(),
  };
}

/** The single grading entry point: validates the response against what was actually issued. */
export function gradeSubmission(pending: PendingQuestion, response: AnswerResponse, course: CourseDef): AnswerGrade {
  const target = pending.entry.itemKey;
  switch (response.kind) {
    case 'dont-know':
      return { correct: false, typo: false, answeredItemKey: null };
    case 'typed':
      if (pending.format !== 'typed') throw new ServiceError('invalid_response');
      return gradeTyped(response.text, getItem(course, target), course.items);
    case 'choice': {
      const choice = pending.choices.find((c) => c.id === response.choiceId);
      if (!choice) throw new ServiceError('invalid_response');
      return gradeChoice(choice.itemKey, target);
    }
    default:
      throw new ServiceError('invalid_response');
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run lib/study/issue.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Write the failing presenter tests**

Create `lib/study/present.test.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seededRng, type QueueEntry } from '@/lib/engine';
import { NOW, TEST_COURSE } from '@/lib/engine/test-fixtures';
import { WORLD_FLAGS } from '@/lib/content/world-flags';
import { issueQuestion } from './issue';
import { flagPresenter, toQuestionView } from './present';
import { getPresenter } from './presenters';

const fakeFlag = (key: string) => `flag#${TEST_COURSE.items.findIndex((i) => i.key === key)}`;
const presenter = flagPresenter(TEST_COURSE, fakeFlag);
const session = { id: 'session-1', kind: 'study' as const, progress: { answered: 3, total: 20 } };

function view(entry: QueueEntry, rung: 1 | 2 | 3, course = TEST_COURSE, p = presenter) {
  const pending = issueQuestion({ entry, rung, course, confusions: [], rng: seededRng(3), now: NOW, newId: randomUUID });
  return { pending, view: toQuestionView({ pending, session, course, presenter: p }) };
}

/** No string anywhere in the view may equal an item key. */
function expectNoKeys(value: unknown, keys: Set<string>) {
  const json = JSON.stringify(value);
  for (const key of keys) expect(json).not.toContain(`"${key}"`);
  expect(json).not.toContain('itemKey');
}
const KEYS = new Set(TEST_COURSE.items.map((i) => i.key));

describe('toQuestionView', () => {
  it('shows a flag for Flag → Name and names as choices', () => {
    const { view: v } = view({ kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, 1);
    expect(v).toMatchObject({ sessionId: 'session-1', sessionKind: 'study', format: 'mc-text', progress: { answered: 3, total: 20 } });
    expect(v.prompt).toEqual({ flag: fakeFlag('EC') });
    expect(v.choices).toHaveLength(4);
    expect(v.choices!.map((c) => c.label)).toContain('Ecuador');
    expectNoKeys(v, KEYS);
  });

  it('shows a name for Name → Flag and flags as choices', () => {
    const { view: v } = view({ kind: 'prompt', itemKey: 'TD', promptType: 'name_to_flag' }, 3);
    expect(v.prompt).toEqual({ name: 'Chad' });
    expect(v.choices).toHaveLength(8);
    expect(v.choices!.every((c) => c.flag && !c.label)).toBe(true);
    expectNoKeys(v, KEYS);
  });

  it('shows name and flag for an intro card, with no choices', () => {
    const { view: v } = view({ kind: 'intro', itemKey: 'EC' }, 1);
    expect(v).toMatchObject({ format: 'intro', prompt: { name: 'Ecuador', flag: fakeFlag('EC') } });
    expect(v.choices).toBeUndefined();
  });

  it('shows a labelled pair and flag choices for a contrast drill', () => {
    const { view: v } = view({ kind: 'contrast', itemKey: 'TD', otherKey: 'RO' }, 1);
    expect(v.format).toBe('contrast');
    expect(v.prompt).toEqual({ name: 'Chad' });
    expect(v.pair).toEqual([
      { name: 'Chad', flag: fakeFlag('TD') },
      { name: 'Romania', flag: fakeFlag('RO') },
    ]);
    expect(v.choices).toHaveLength(2);
    expectNoKeys(v, KEYS);
  });

  it('with real World Flags art, carries no identifying markup', () => {
    const real = getPresenter(WORLD_FLAGS);
    const { view: v } = view({ kind: 'prompt', itemKey: 'EC', promptType: 'name_to_flag' }, 3, WORLD_FLAGS, real);
    const json = JSON.stringify(v);
    expect(json).not.toContain('flag-icons');
    expect(json).not.toContain('/flags/');
    expectNoKeys(v, new Set(WORLD_FLAGS.items.map((i) => i.key)));
  });
});
```

- [ ] **Step 7: Run to verify it fails**

Run: `npx vitest run lib/study/present.test.ts`
Expected: FAIL. `Failed to resolve import "./present"`.

- [ ] **Step 8: Implement presenters**

Create `lib/study/present.ts`:

```ts
import { getItem, type CourseDef, type Format, type PromptEntry } from '@/lib/engine';
import type { ItemView, PendingQuestion, QuestionView, SessionKind } from './types';

/** Course-specific rendering of items into browser-safe views (names + image data, never keys). */
export interface Presenter {
  prompt(entry: PromptEntry): QuestionView['prompt'];
  choice(itemKey: string, format: Format): { label?: string; flag?: string };
  item(itemKey: string): ItemView;
}

export function flagPresenter(course: CourseDef, flag: (itemKey: string) => string): Presenter {
  const name = (key: string) => getItem(course, key).name;
  return {
    prompt: (entry) => (entry.promptType === 'flag_to_name' ? { flag: flag(entry.itemKey) } : { name: name(entry.itemKey) }),
    choice: (key, format) => (format === 'mc-text' ? { label: name(key) } : { flag: flag(key) }),
    item: (key) => ({ name: name(key), flag: flag(key) }),
  };
}

export function toQuestionView(args: {
  pending: PendingQuestion;
  session: { id: string; kind: SessionKind; progress: { answered: number; total: number } };
  course: CourseDef;
  presenter: Presenter;
}): QuestionView {
  const { pending, session, course, presenter } = args;
  const base = {
    sessionId: session.id,
    questionId: pending.questionId,
    sessionKind: session.kind,
    format: pending.format,
    progress: session.progress,
  };
  const choices = pending.choices.length
    ? pending.choices.map((c) => ({ id: c.id, ...presenter.choice(c.itemKey, pending.format) }))
    : undefined;
  const { entry } = pending;

  if (entry.kind === 'intro') return { ...base, prompt: presenter.item(entry.itemKey) };
  if (entry.kind === 'contrast') {
    return {
      ...base,
      prompt: { name: getItem(course, entry.itemKey).name },
      pair: [presenter.item(entry.itemKey), presenter.item(entry.otherKey)],
      choices,
    };
  }
  return { ...base, prompt: presenter.prompt(entry), choices };
}
```

Create `lib/study/presenters.ts`:

```ts
import 'server-only';
import { flagDataUri } from '@/lib/content/flag-art';
import type { CourseDef } from '@/lib/engine';
import { flagPresenter, type Presenter } from './present';

export function getPresenter(course: CourseDef): Presenter {
  switch (course.slug) {
    case 'world-flags':
      return flagPresenter(course, flagDataUri);
    default:
      throw new Error(`No presenter for course ${course.slug}`);
  }
}
```

- [ ] **Step 9: Run to verify it passes**

Run: `npx vitest run lib/study/present.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 10: Write the failing validation tests**

Create `lib/study/validate.test.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ServiceError } from './types';
import { parseStudyOptions, parseSubmission } from './validate';

const ids = { sessionId: randomUUID(), questionId: randomUUID() };

describe('parseSubmission', () => {
  it('accepts each well-formed response kind', () => {
    const choiceId = randomUUID();
    expect(parseSubmission({ ...ids, response: { kind: 'choice', choiceId } }).response).toEqual({ kind: 'choice', choiceId });
    expect(parseSubmission({ ...ids, response: { kind: 'typed', text: 'Chad' } }).response).toEqual({ kind: 'typed', text: 'Chad' });
    expect(parseSubmission({ ...ids, response: { kind: 'dont-know' } }).response).toEqual({ kind: 'dont-know' });
    expect(parseSubmission({ ...ids, response: { kind: 'ack', extra: 1 } }).response).toEqual({ kind: 'ack' });
  });

  it.each([
    null,
    'nope',
    { ...ids, sessionId: 'not-a-uuid', response: { kind: 'ack' } },
    { ...ids, response: { kind: 'choice', choiceId: 'EC' } },
    { ...ids, response: { kind: 'typed', text: 'x'.repeat(101) } },
    { ...ids, response: { kind: 'typed', text: 42 } },
    { ...ids, response: { kind: 'hack' } },
  ])('rejects %j', (input) => {
    expect(() => parseSubmission(input)).toThrowError(new ServiceError('invalid_response'));
  });
});

describe('parseStudyOptions', () => {
  it('defaults and validates', () => {
    expect(parseStudyOptions(undefined)).toEqual({ mode: 'normal', size: 20 });
    expect(parseStudyOptions({ mode: 'practice-ahead', size: 40 })).toEqual({ mode: 'practice-ahead', size: 40 });
    expect(() => parseStudyOptions({ size: 7 })).toThrowError(new ServiceError('invalid_response'));
    expect(() => parseStudyOptions({ mode: 'turbo' })).toThrowError(new ServiceError('invalid_response'));
  });
});
```

- [ ] **Step 11: Run to verify it fails**

Run: `npx vitest run lib/study/validate.test.ts`
Expected: FAIL. `Failed to resolve import "./validate"`.

- [ ] **Step 12: Implement validation**

Create `lib/study/validate.ts`:

```ts
import type { StudyMode } from '@/lib/engine';
import { ServiceError, type AnswerResponse, type SubmissionInput } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TYPED_LENGTH = 100;
const SESSION_SIZES = [10, 20, 40];

const invalid = (): never => {
  throw new ServiceError('invalid_response');
};
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

function parseResponse(value: unknown): AnswerResponse {
  if (!isRecord(value)) return invalid();
  switch (value.kind) {
    case 'ack':
      return { kind: 'ack' };
    case 'dont-know':
      return { kind: 'dont-know' };
    case 'choice':
      return isUuid(value.choiceId) ? { kind: 'choice', choiceId: value.choiceId } : invalid();
    case 'typed':
      return typeof value.text === 'string' && value.text.length <= MAX_TYPED_LENGTH
        ? { kind: 'typed', text: value.text }
        : invalid();
    default:
      return invalid();
  }
}

/** Server actions receive untrusted input; never pass it to services unparsed. */
export function parseSubmission(input: unknown): SubmissionInput {
  if (!isRecord(input) || !isUuid(input.sessionId) || !isUuid(input.questionId)) return invalid();
  return { sessionId: input.sessionId, questionId: input.questionId, response: parseResponse(input.response) };
}

export function parseStudyOptions(input: unknown): { mode: StudyMode; size: number } {
  const value = isRecord(input) ? input : {};
  const mode = value.mode ?? 'normal';
  const size = value.size ?? 20;
  if (mode !== 'normal' && mode !== 'practice-ahead') return invalid();
  if (typeof size !== 'number' || !SESSION_SIZES.includes(size)) return invalid();
  return { mode, size };
}
```

- [ ] **Step 13: Run to verify it passes, then commit**

```powershell
npx vitest run lib/study
npm run typecheck
npm run lint
git add lib/server lib/study
git commit -m "feat(study): issue questions with opaque choices, grade submissions, present safe views, validate input"
```

Expected: all `lib/study` tests pass (6 + 5 + 9).

---

### Task 9: Service context, turn helpers, overview service

**Files:**
- Create: `lib/study/context.ts`, `lib/study/turn.ts`, `lib/study/overview-service.ts`, `lib/study/test-helpers.ts`
- Test: `lib/study/overview-service.test.ts`

- [ ] **Step 1: Create the context and test helpers**

Create `lib/study/context.ts`:

```ts
import type { CourseDef, Rng } from '@/lib/engine';
import type { UserStore } from '@/lib/db/store';
import type { Presenter } from './present';

/** Everything a service needs for one request, for one user and one course. */
export interface ServiceContext {
  store: UserStore;
  course: CourseDef;
  presenter: Presenter;
  now: Date;
  rng: Rng;
  newId: () => string;
}
```

Create `lib/study/test-helpers.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { getItem, graduate, initialStates, introduce, seededRng, type CourseDef } from '@/lib/engine';
import { NOW, TEST_COURSE } from '@/lib/engine/test-fixtures';
import { MemoryStore } from '@/lib/db/memory-store';
import type { UserStore } from '@/lib/db/store';
import type { ServiceContext } from './context';
import { flagPresenter } from './present';
import type { AnswerResponse, PendingQuestion } from './types';

export const fakeFlag = (key: string) => `flag#${TEST_COURSE.items.findIndex((i) => i.key === key)}`;

export function testContext(store: UserStore, opts: { now?: Date; seed?: number; course?: CourseDef } = {}): ServiceContext {
  const course = opts.course ?? TEST_COURSE;
  return {
    store,
    course,
    presenter: flagPresenter(course, fakeFlag),
    now: opts.now ?? NOW,
    rng: seededRng(opts.seed ?? 1),
    newId: randomUUID,
  };
}

/** A MemoryStore whose clock can be moved, plus an enrollment for TEST_COURSE. */
export async function enrolledStore(opts: { placementDone?: boolean } = {}) {
  let clock = NOW;
  const store = new MemoryStore(() => clock);
  await store.enroll(TEST_COURSE.slug);
  if (opts.placementDone) await store.setPlacementCompleted(TEST_COURSE.slug, NOW);
  return { store, setClock: (d: Date) => (clock = d) };
}

export function allGraduated(course: CourseDef = TEST_COURSE, at = NOW) {
  return initialStates(course).map((s) => graduate({ ...introduce(s), rung: 3 }, at));
}

/** Reads the server-side pending question (tests only; the browser never sees this). */
export async function pendingFor(store: UserStore, slug = TEST_COURSE.slug): Promise<PendingQuestion> {
  const active = await store.getActiveSession(slug);
  if (!active?.pendingQuestion) throw new Error('No pending question');
  return active.pendingQuestion;
}

export function correctResponse(pending: PendingQuestion, course: CourseDef = TEST_COURSE): AnswerResponse {
  const { entry } = pending;
  if (entry.kind === 'intro') return { kind: 'ack' };
  if (pending.format === 'typed') return { kind: 'typed', text: getItem(course, entry.itemKey).name };
  return { kind: 'choice', choiceId: pending.choices.find((c) => c.itemKey === entry.itemKey)!.id };
}

export function wrongChoice(pending: PendingQuestion): AnswerResponse & { itemKey: string } {
  const other = pending.choices.find((c) => c.itemKey !== pending.entry.itemKey)!;
  return { kind: 'choice', choiceId: other.id, itemKey: other.itemKey };
}
```

- [ ] **Step 2: Create shared turn helpers**

Create `lib/study/turn.ts`:

```ts
import type { AnswerGrade, Confusion, QuestionRung, QueueEntry } from '@/lib/engine';
import type { AnswerLog, EnrollmentRecord, SessionRecord } from '@/lib/db/store';
import type { ServiceContext } from './context';
import { issueQuestion } from './issue';
import { toQuestionView } from './present';
import {
  ServiceError,
  type AnswerResponse,
  type FeedbackView,
  type PendingQuestion,
  type QuestionView,
  type SessionKind,
  type SubmissionInput,
} from './types';

export async function requireEnrollment(ctx: ServiceContext): Promise<EnrollmentRecord> {
  const enrollment = await ctx.store.getEnrollment(ctx.course.slug);
  if (!enrollment) throw new ServiceError('not_enrolled');
  return enrollment;
}

/** Loads the active session for a submission and checks it is the question we issued. */
export async function loadTurn(
  ctx: ServiceContext,
  input: SubmissionInput,
  kind: SessionKind,
): Promise<{ active: SessionRecord; pending: PendingQuestion }> {
  const active = await ctx.store.getActiveSession(ctx.course.slug);
  if (!active || active.id !== input.sessionId || active.kind !== kind) throw new ServiceError('no_active_session');
  const pending = active.pendingQuestion;
  if (!pending || pending.questionId !== input.questionId) throw new ServiceError('stale_question');
  return { active, pending };
}

export function issue(
  ctx: ServiceContext,
  entry: QueueEntry,
  rung: QuestionRung,
  confusions: readonly Confusion[],
): PendingQuestion {
  return issueQuestion({ entry, rung, course: ctx.course, confusions, rng: ctx.rng, now: ctx.now, newId: ctx.newId });
}

export function view(
  ctx: ServiceContext,
  pending: PendingQuestion,
  session: { id: string; kind: SessionKind },
  progress: { answered: number; total: number },
): QuestionView {
  return toQuestionView({ pending, session: { ...session, progress }, course: ctx.course, presenter: ctx.presenter });
}

export function answerLog(
  ctx: ServiceContext,
  pending: PendingQuestion,
  response: AnswerResponse,
  grade: AnswerGrade,
  context: SessionKind,
): AnswerLog {
  const { entry } = pending;
  return {
    questionId: pending.questionId,
    context,
    kind: entry.kind === 'contrast' ? 'contrast' : 'prompt',
    itemKey: entry.itemKey,
    promptType: entry.kind === 'prompt' ? entry.promptType : null,
    format: pending.format,
    rung: entry.kind === 'prompt' ? pending.rung : null,
    givenText: response.kind === 'typed' ? response.text : null,
    givenItemKey: grade.correct ? entry.itemKey : grade.answeredItemKey,
    correct: grade.correct,
    responseMs: Math.max(0, ctx.now.getTime() - Date.parse(pending.issuedAt)),
  };
}

/** Prompt answers that resolve to a different item are confusions; contrast drills never are. */
export function confusionFor(pending: PendingQuestion, grade: AnswerGrade): { asked: string; answered: string } | undefined {
  const { entry } = pending;
  if (entry.kind !== 'prompt' || grade.correct || !grade.answeredItemKey || grade.answeredItemKey === entry.itemKey) {
    return undefined;
  }
  return { asked: entry.itemKey, answered: grade.answeredItemKey };
}

export function feedbackFor(ctx: ServiceContext, pending: PendingQuestion, grade: AnswerGrade): FeedbackView {
  return {
    correct: grade.correct,
    typo: grade.typo,
    answer: ctx.presenter.item(pending.entry.itemKey),
    given: grade.answeredItemKey ? ctx.presenter.item(grade.answeredItemKey) : undefined,
  };
}
```

- [ ] **Step 3: Write the failing overview tests**

Create `lib/study/overview-service.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MemoryStore } from '@/lib/db/memory-store';
import { days, NOW, TEST_COURSE } from '@/lib/engine/test-fixtures';
import { enroll, getCourseOverview } from './overview-service';
import { allGraduated, enrolledStore, testContext } from './test-helpers';

describe('getCourseOverview', () => {
  it('reports an unenrolled course', async () => {
    const overview = await getCourseOverview(testContext(new MemoryStore()));
    expect(overview).toMatchObject({ slug: TEST_COURSE.slug, enrolled: false, status: null, nudge: false });
  });

  it('reports a fresh enrollment as placement with nothing graduated', async () => {
    const { store } = await enrolledStore();
    const overview = await getCourseOverview(testContext(store));
    expect(overview).toMatchObject({
      enrolled: true,
      status: 'placement',
      readiness: { graduated: 0, total: 34 },
      dueCount: 0,
      activeSessionKind: null,
      nudge: false,
    });
    expect(overview.tiles).toHaveLength(17);
    expect(overview.tiles.every((t) => t.tile === 'new')).toBe(true);
  });

  it('reports exam_ready, then passed with a retention nudge once memory fades', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    store.seedPromptStates(TEST_COURSE.slug, allGraduated());
    expect((await getCourseOverview(testContext(store))).status).toBe('exam_ready');

    const session = await store.createSession({ courseSlug: TEST_COURSE.slug, kind: 'exam', state: {}, pendingQuestion: null });
    await store.commitTurn(TEST_COURSE.slug, {
      sessionId: session.id,
      expectedVersion: 0,
      sessionState: {},
      pendingQuestion: null,
      completed: true,
      promptStates: [],
      enrollment: { passedAt: NOW },
    });
    const later = await getCourseOverview(testContext(store, { now: days(90) }));
    expect(later).toMatchObject({ status: 'passed', nudge: true });
    expect(later.retentionHealth).toBeLessThan(0.9);
    expect(later.dueCount).toBe(34);
  });

  it('names the top confusions', async () => {
    const { store } = await enrolledStore();
    store.seedConfusion(TEST_COURSE.slug, 'TD', 'RO', 3);
    const overview = await getCourseOverview(testContext(store));
    expect(overview.topConfusions).toEqual([{ a: 'Romania', b: 'Chad', count: 3 }]);
  });
});

describe('enroll', () => {
  it('is idempotent', async () => {
    const ctx = testContext(new MemoryStore());
    await enroll(ctx);
    await enroll(ctx);
    expect((await getCourseOverview(ctx)).enrolled).toBe(true);
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npx vitest run lib/study/overview-service.test.ts`
Expected: FAIL. `Failed to resolve import "./overview-service"`.

- [ ] **Step 5: Implement**

Create `lib/study/overview-service.ts`:

```ts
import {
  deriveStatus,
  dueCount,
  getItem,
  hydrateStates,
  itemTileState,
  needsReviewNudge,
  readiness,
  retentionHealth,
  topConfusions,
  type EnrollmentStatus,
  type TileState,
} from '@/lib/engine';
import type { ServiceContext } from './context';
import type { SessionKind } from './types';

export interface CourseOverview {
  slug: string;
  title: string;
  enrolled: boolean;
  status: EnrollmentStatus | null;
  passedAt: Date | null;
  readiness: { graduated: number; total: number };
  dueCount: number;
  retentionHealth: number;
  nudge: boolean;
  activeSessionKind: SessionKind | null;
  /** The mastery grid. Keys are fine here: this is a reference view, not a question. */
  tiles: { key: string; name: string; group: string; tile: TileState }[];
  topConfusions: { a: string; b: string; count: number }[];
}

export async function enroll(ctx: ServiceContext): Promise<void> {
  await ctx.store.enroll(ctx.course.slug);
}

export async function getCourseOverview(ctx: ServiceContext): Promise<CourseOverview> {
  const { course, store, now } = ctx;
  const [enrollment, stored, confusions, active] = await Promise.all([
    store.getEnrollment(course.slug),
    store.getPromptStates(course.slug),
    store.getConfusions(course.slug),
    store.getActiveSession(course.slug),
  ]);
  const states = hydrateStates(course, stored);
  const status = enrollment
    ? deriveStatus({
        course,
        states,
        placementCompleted: enrollment.placementCompletedAt !== null,
        passedAt: enrollment.passedAt,
      })
    : null;
  const health = retentionHealth(states, now);
  const byItem = new Map<string, typeof states>();
  for (const s of states) byItem.set(s.itemKey, [...(byItem.get(s.itemKey) ?? []), s]);

  return {
    slug: course.slug,
    title: course.title,
    enrolled: enrollment !== null,
    status,
    passedAt: enrollment?.passedAt ?? null,
    readiness: readiness(course, states),
    dueCount: dueCount(states, now),
    retentionHealth: health,
    nudge: status ? needsReviewNudge(health, status) : false,
    activeSessionKind: active?.kind ?? null,
    tiles: course.items.map((item) => ({
      key: item.key,
      name: item.name,
      group: item.group,
      tile: itemTileState(byItem.get(item.key) ?? []),
    })),
    topConfusions: topConfusions(confusions, 5).map((c) => ({
      a: getItem(course, c.a).name,
      b: getItem(course, c.b).name,
      count: c.count,
    })),
  };
}
```

- [ ] **Step 6: Run to verify it passes, then commit**

```powershell
npx vitest run lib/study
npm run typecheck
npm run lint
git add lib/study
git commit -m "feat(study): add service context, turn helpers, and course overview"
```

Expected: 5 overview tests pass. (`topConfusions` orders a pair alphabetically by key, RO before TD, so the result is Romania then Chad.)

---

### Task 10: Placement service

**Files:**
- Create: `lib/study/placement-service.ts`
- Test: `lib/study/placement-service.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/study/placement-service.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MemoryStore } from '@/lib/db/memory-store';
import { TEST_COURSE } from '@/lib/engine/test-fixtures';
import { skipPlacement, startPlacement, submitPlacementAnswer } from './placement-service';
import { correctResponse, enrolledStore, pendingFor, testContext } from './test-helpers';
import { ServiceError } from './types';

const SLUG = TEST_COURSE.slug;

describe('placement', () => {
  it('requires enrollment', async () => {
    await expect(startPlacement(testContext(new MemoryStore()))).rejects.toEqual(new ServiceError('not_enrolled'));
  });

  it('asks a typed Flag → Name question for the first item and resumes the same question', async () => {
    const { store } = await enrolledStore();
    const ctx = testContext(store);
    const first = await startPlacement(ctx);
    expect(first.next).toMatchObject({ sessionKind: 'placement', format: 'typed', progress: { answered: 0, total: 17 } });
    expect(first.next!.prompt.flag).toBeDefined();
    expect((await pendingFor(store)).entry.itemKey).toBe('US');
    const again = await startPlacement(ctx);
    expect(again.next!.questionId).toBe(first.next!.questionId);
  });

  it('fast-tracks a correctly named item and moves on', async () => {
    const { store } = await enrolledStore();
    const ctx = testContext(store);
    const { next } = await startPlacement(ctx);
    const result = await submitPlacementAnswer(ctx, {
      sessionId: next!.sessionId,
      questionId: next!.questionId,
      response: { kind: 'typed', text: 'United States' },
    });
    expect(result.feedback).toMatchObject({ correct: true, answer: { name: 'United States' } });
    expect(result.next!.progress).toEqual({ answered: 1, total: 17 });
    const us = (await store.getPromptStates(SLUG)).filter((s) => s.itemKey === 'US');
    expect(us).toHaveLength(2);
    expect(us.every((s) => s.phase === 'review')).toBe(true);
    expect(store.answers).toHaveLength(1);
    expect(store.answers[0]).toMatchObject({ context: 'placement', correct: true, itemKey: 'US' });
  });

  it('records a confusion and leaves the item new on a wrong answer', async () => {
    const { store } = await enrolledStore();
    const ctx = testContext(store);
    let turn = await startPlacement(ctx);
    turn = await submitPlacementAnswer(ctx, {
      sessionId: turn.next!.sessionId,
      questionId: turn.next!.questionId,
      response: { kind: 'typed', text: 'United States' },
    });
    expect((await pendingFor(store)).entry.itemKey).toBe('EC');
    const wrong = await submitPlacementAnswer(ctx, {
      sessionId: turn.next!.sessionId,
      questionId: turn.next!.questionId,
      response: { kind: 'typed', text: 'Colombia' },
    });
    expect(wrong.feedback).toMatchObject({ correct: false, given: { name: 'Colombia' } });
    expect(await store.getConfusions(SLUG)).toEqual([{ asked: 'EC', answered: 'CO', count: 1 }]);
    expect((await store.getPromptStates(SLUG)).some((s) => s.itemKey === 'EC')).toBe(false);
  });

  it('completes placement after the last item', async () => {
    const { store } = await enrolledStore();
    const ctx = testContext(store);
    let turn = await startPlacement(ctx);
    while (turn.next) {
      const pending = await pendingFor(store);
      turn = await submitPlacementAnswer(ctx, {
        sessionId: turn.next.sessionId,
        questionId: turn.next.questionId,
        response: correctResponse(pending),
      });
    }
    expect(turn.end).toEqual({ reason: 'placement_complete' });
    expect((await store.getEnrollment(SLUG))!.placementCompletedAt).not.toBeNull();
    expect(await store.getActiveSession(SLUG)).toBeNull();
    await expect(startPlacement(ctx)).rejects.toEqual(new ServiceError('placement_done'));
  });

  it('rejects a stale question id', async () => {
    const { store } = await enrolledStore();
    const ctx = testContext(store);
    const { next } = await startPlacement(ctx);
    const input = { sessionId: next!.sessionId, questionId: next!.questionId, response: { kind: 'dont-know' as const } };
    await submitPlacementAnswer(ctx, input);
    await expect(submitPlacementAnswer(ctx, input)).rejects.toEqual(new ServiceError('stale_question'));
  });

  it('can be skipped, closing any open placement session', async () => {
    const { store } = await enrolledStore();
    const ctx = testContext(store);
    await startPlacement(ctx);
    await skipPlacement(ctx);
    expect((await store.getEnrollment(SLUG))!.placementCompletedAt).not.toBeNull();
    expect(await store.getActiveSession(SLUG)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/study/placement-service.test.ts`
Expected: FAIL. `Failed to resolve import "./placement-service"`.

- [ ] **Step 3: Implement**

Create `lib/study/placement-service.ts`:

```ts
import {
  advance,
  applyPlacementAnswer,
  buildPlacementQueue,
  currentEntry,
  hydrateStates,
  type QueueSession,
} from '@/lib/engine';
import type { ServiceContext } from './context';
import { gradeSubmission } from './issue';
import { answerLog, confusionFor, feedbackFor, issue, loadTurn, requireEnrollment, view } from './turn';
import { ServiceError, type SubmissionInput, type TurnResult } from './types';

const progressOf = (q: QueueSession) => ({ answered: q.position, total: q.queue.length });

/** Starts the placement sweep, or resumes the one in progress. */
export async function startPlacement(ctx: ServiceContext): Promise<TurnResult> {
  const { store, course, now } = ctx;
  const enrollment = await requireEnrollment(ctx);
  if (enrollment.placementCompletedAt) throw new ServiceError('placement_done');

  const active = await store.getActiveSession(course.slug);
  if (active?.kind === 'placement' && active.pendingQuestion) {
    return { next: view(ctx, active.pendingQuestion, active, progressOf(active.state as QueueSession)) };
  }
  if (active?.kind === 'exam') throw new ServiceError('exam_in_progress');
  if (active) await store.completeSession(active.id);

  const states = hydrateStates(course, await store.getPromptStates(course.slug));
  const queue = buildPlacementQueue(course, states);
  const entry = currentEntry(queue);
  if (!entry) {
    await store.setPlacementCompleted(course.slug, now);
    return { next: null, end: { reason: 'placement_complete' } };
  }
  const pending = issue(ctx, entry, 3, []);
  const session = await store.createSession({ courseSlug: course.slug, kind: 'placement', state: queue, pendingQuestion: pending });
  return { next: view(ctx, pending, session, progressOf(queue)) };
}

export async function submitPlacementAnswer(ctx: ServiceContext, input: SubmissionInput): Promise<TurnResult> {
  const { store, course, now } = ctx;
  const { active, pending } = await loadTurn(ctx, input, 'placement');
  const { entry } = pending;
  if (entry.kind !== 'prompt') throw new ServiceError('invalid_response');

  const grade = gradeSubmission(pending, input.response, course);
  const states = hydrateStates(course, await store.getPromptStates(course.slug));
  const updated = applyPlacementAnswer({ states, itemKey: entry.itemKey, correct: grade.correct, now });
  const queue = advance(active.state as QueueSession);
  const nextEntry = currentEntry(queue);
  const nextPending = nextEntry ? issue(ctx, nextEntry, 3, []) : null;
  const completed = nextPending === null;

  await store.commitTurn(course.slug, {
    sessionId: active.id,
    expectedVersion: active.version,
    sessionState: queue,
    pendingQuestion: nextPending,
    completed,
    promptStates: grade.correct ? updated.filter((s) => s.itemKey === entry.itemKey) : [],
    answer: answerLog(ctx, pending, input.response, grade, 'placement'),
    confusion: confusionFor(pending, grade),
    enrollment: completed ? { placementCompletedAt: now } : undefined,
  });

  return {
    feedback: feedbackFor(ctx, pending, grade),
    next: nextPending ? view(ctx, nextPending, active, progressOf(queue)) : null,
    end: completed ? { reason: 'placement_complete' } : undefined,
  };
}

/** Marks placement done without (finishing) the sweep. */
export async function skipPlacement(ctx: ServiceContext): Promise<void> {
  const { store, course, now } = ctx;
  await requireEnrollment(ctx);
  const active = await store.getActiveSession(course.slug);
  if (active?.kind === 'placement') await store.completeSession(active.id);
  await store.setPlacementCompleted(course.slug, now);
}
```

- [ ] **Step 4: Run to verify it passes, then commit**

```powershell
npx vitest run lib/study/placement-service.test.ts
npm run typecheck
npm run lint
git add lib/study
git commit -m "feat(study): add placement sweep service"
```

Expected: 7 tests pass.

---

### Task 11: Study service

**Files:**
- Create: `lib/study/study-service.ts`
- Test: `lib/study/study-service.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/study/study-service.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { days, TEST_COURSE } from '@/lib/engine/test-fixtures';
import { endStudy, startStudy, submitStudyAnswer } from './study-service';
import { allGraduated, correctResponse, enrolledStore, pendingFor, testContext, wrongChoice } from './test-helpers';
import { ServiceError, type TurnResult } from './types';

const SLUG = TEST_COURSE.slug;

async function answer(ctx: ReturnType<typeof testContext>, turn: TurnResult, response: Parameters<typeof submitStudyAnswer>[1]['response']) {
  return submitStudyAnswer(ctx, { sessionId: turn.next!.sessionId, questionId: turn.next!.questionId, response });
}

describe('startStudy', () => {
  it('requires placement to be completed or skipped', async () => {
    const { store } = await enrolledStore();
    await expect(startStudy(testContext(store))).rejects.toEqual(new ServiceError('placement_pending'));
  });

  it('opens with an intro card for the first item and resumes the same question', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    const ctx = testContext(store);
    const first = await startStudy(ctx);
    expect(first.next).toMatchObject({ sessionKind: 'study', format: 'intro', prompt: { name: 'United States' } });
    expect((await startStudy(ctx)).next!.questionId).toBe(first.next!.questionId);
  });

  it('replaces a study session idle for more than 24 hours', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    const first = await startStudy(testContext(store));
    store.backdateActiveSession(SLUG, days(-2));
    const fresh = await startStudy(testContext(store));
    expect(fresh.next!.sessionId).not.toBe(first.next!.sessionId);
  });

  it('is blocked while an exam is in progress', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    await store.createSession({ courseSlug: SLUG, kind: 'exam', state: {}, pendingQuestion: null });
    await expect(startStudy(testContext(store))).rejects.toEqual(new ServiceError('exam_in_progress'));
  });

  it('ends immediately with caught_up when everything is graduated and nothing is due', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    store.seedPromptStates(SLUG, allGraduated());
    expect(await startStudy(testContext(store))).toEqual({ next: null, end: { reason: 'caught_up' } });
  });
});

describe('submitStudyAnswer', () => {
  it('runs a full session for a perfect learner and logs every graded answer', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    const ctx = testContext(store);
    let turn = await startStudy(ctx);
    let graded = 0;
    while (turn.next) {
      const pending = await pendingFor(store);
      if (pending.entry.kind === 'prompt') graded++;
      turn = await answer(ctx, turn, correctResponse(pending));
    }
    expect(turn.end).toEqual({ reason: 'complete' });
    expect(graded).toBe(20);
    expect(store.answers.filter((a) => a.context === 'study')).toHaveLength(20);
    const states = await store.getPromptStates(SLUG);
    expect(states.some((s) => s.phase === 'learning' || s.phase === 'review')).toBe(true);
    expect(await store.getActiveSession(SLUG)).toBeNull();
  });

  it('acknowledges intros without logging an answer', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    const ctx = testContext(store);
    const turn = await startStudy(ctx);
    const result = await answer(ctx, turn, { kind: 'ack' });
    expect(result.feedback).toBeUndefined();
    expect(store.answers).toHaveLength(0);
    expect((await store.getPromptStates(SLUG)).filter((s) => s.itemKey === 'US' && s.phase === 'learning')).toHaveLength(2);
  });

  it('reports feedback and queues a contrast drill when a confusion repeats', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    for (const other of TEST_COURSE.items) {
      if (other.key !== 'US') store.seedConfusion(SLUG, 'US', other.key, 1);
    }
    const ctx = testContext(store);
    let turn = await startStudy(ctx);
    let pending = await pendingFor(store);
    while (!(pending.entry.kind === 'prompt' && pending.entry.itemKey === 'US')) {
      turn = await answer(ctx, turn, correctResponse(pending));
      pending = await pendingFor(store);
    }
    const wrong = wrongChoice(pending);
    const result = await answer(ctx, turn, { kind: 'choice', choiceId: wrong.choiceId });
    expect(result.feedback).toMatchObject({ correct: false, answer: { name: 'United States' }, outcome: 'dropped', contrastQueued: true });
    expect(result.next).toMatchObject({ format: 'contrast', prompt: { name: 'United States' } });
    expect(result.next!.pair).toHaveLength(2);

    const drill = await pendingFor(store);
    const after = await answer(ctx, result, correctResponse(drill));
    expect(after.feedback).toMatchObject({ correct: true });
    expect(store.answers.at(-1)).toMatchObject({ kind: 'contrast', context: 'study' });
  });

  it('rejects invalid responses and stale questions', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    const ctx = testContext(store);
    const turn = await startStudy(ctx);
    await expect(answer(ctx, turn, { kind: 'dont-know' })).rejects.toEqual(new ServiceError('invalid_response'));
    await answer(ctx, turn, { kind: 'ack' });
    await expect(answer(ctx, turn, { kind: 'ack' })).rejects.toEqual(new ServiceError('stale_question'));
  });
});

describe('endStudy', () => {
  it('closes the active study session', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    const ctx = testContext(store);
    await startStudy(ctx);
    await endStudy(ctx);
    expect(await store.getActiveSession(SLUG)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/study/study-service.test.ts`
Expected: FAIL. `Failed to resolve import "./study-service"`.

- [ ] **Step 3: Implement**

Create `lib/study/study-service.ts`:

```ts
import {
  applyContrast,
  applyIntro,
  applyStudyAnswer,
  hydrateStates,
  newItemsInOrder,
  nextEntry,
  rungForState,
  startStudySession,
  stateKey,
  type Confusion,
  type PromptState,
  type StudyMode,
  type StudySession,
} from '@/lib/engine';
import type { ServiceContext } from './context';
import { gradeSubmission } from './issue';
import { answerLog, confusionFor, feedbackFor, issue, loadTurn, requireEnrollment, view } from './turn';
import {
  ServiceError,
  type EndReason,
  type FeedbackView,
  type PendingQuestion,
  type SubmissionInput,
  type TurnResult,
} from './types';

export const STUDY_SESSION_STALE_MS = 24 * 60 * 60 * 1000;

const progressOf = (s: StudySession) => ({ answered: s.answered, total: s.size });

function issueNext(
  ctx: ServiceContext,
  states: PromptState[],
  session: StudySession,
  confusions: readonly Confusion[],
): PendingQuestion | null {
  const entry = nextEntry({ course: ctx.course, states, session, now: ctx.now });
  if (!entry) return null;
  if (entry.kind !== 'prompt') return issue(ctx, entry, 1, confusions);
  const state = states.find((s) => s.itemKey === entry.itemKey && s.promptType === entry.promptType)!;
  return issue(ctx, entry, rungForState(state), confusions);
}

function endReason(ctx: ServiceContext, states: PromptState[], session: StudySession): EndReason {
  if (session.answered >= session.size) return 'complete';
  if (states.some((s) => s.phase === 'learning')) return 'come_back_later';
  if (newItemsInOrder(ctx.course, states).length > 0) return 'more_new_available';
  return 'caught_up';
}

/** Starts a study session, or resumes a recent one. */
export async function startStudy(
  ctx: ServiceContext,
  opts: { mode?: StudyMode; size?: number } = {},
): Promise<TurnResult> {
  const { store, course, now } = ctx;
  const enrollment = await requireEnrollment(ctx);
  if (!enrollment.placementCompletedAt) throw new ServiceError('placement_pending');

  const active = await store.getActiveSession(course.slug);
  if (active?.kind === 'exam') throw new ServiceError('exam_in_progress');
  if (active?.kind === 'study' && active.pendingQuestion && now.getTime() - active.updatedAt.getTime() < STUDY_SESSION_STALE_MS) {
    return { next: view(ctx, active.pendingQuestion, active, progressOf(active.state as StudySession)) };
  }
  if (active) await store.completeSession(active.id);

  const [stored, confusions] = await Promise.all([store.getPromptStates(course.slug), store.getConfusions(course.slug)]);
  const states = hydrateStates(course, stored);
  const session = startStudySession(opts);
  const pending = issueNext(ctx, states, session, confusions);
  if (!pending) return { next: null, end: { reason: endReason(ctx, states, session) } };

  const record = await store.createSession({ courseSlug: course.slug, kind: 'study', state: session, pendingQuestion: pending });
  return { next: view(ctx, pending, record, progressOf(session)) };
}

export async function submitStudyAnswer(ctx: ServiceContext, input: SubmissionInput): Promise<TurnResult> {
  const { store, course, now } = ctx;
  const { active, pending } = await loadTurn(ctx, input, 'study');
  const [stored, storedConfusions] = await Promise.all([
    store.getPromptStates(course.slug),
    store.getConfusions(course.slug),
  ]);
  let states = hydrateStates(course, stored);
  let session = active.state as StudySession;
  let confusions: Confusion[] = storedConfusions;
  let changed: PromptState[] = [];
  let feedback: FeedbackView | undefined;
  let answer;
  let confusion;
  const { entry } = pending;

  if (entry.kind === 'intro') {
    if (input.response.kind !== 'ack') throw new ServiceError('invalid_response');
    const result = applyIntro({ session, itemKey: entry.itemKey, states });
    session = result.session;
    states = result.states;
    changed = states.filter((s) => s.itemKey === entry.itemKey);
  } else if (entry.kind === 'contrast') {
    const grade = gradeSubmission(pending, input.response, course);
    session = applyContrast(session);
    answer = answerLog(ctx, pending, input.response, grade, 'study');
    feedback = feedbackFor(ctx, pending, grade);
  } else {
    const grade = gradeSubmission(pending, input.response, course);
    const key = stateKey(entry.itemKey, entry.promptType);
    const current = states.find((s) => stateKey(s.itemKey, s.promptType) === key)!;
    const result = applyStudyAnswer({ session, state: current, confusions, grade, now });
    session = result.session;
    confusions = result.confusions;
    states = states.map((s) => (stateKey(s.itemKey, s.promptType) === key ? result.state : s));
    changed = [result.state];
    answer = answerLog(ctx, pending, input.response, grade, 'study');
    confusion = confusionFor(pending, grade);
    feedback = { ...feedbackFor(ctx, pending, grade), outcome: result.outcome, contrastQueued: result.contrastQueued };
  }

  const nextPending = issueNext(ctx, states, session, confusions);
  const completed = nextPending === null;
  await store.commitTurn(course.slug, {
    sessionId: active.id,
    expectedVersion: active.version,
    sessionState: session,
    pendingQuestion: nextPending,
    completed,
    promptStates: changed,
    answer,
    confusion,
  });

  return {
    feedback,
    next: nextPending ? view(ctx, nextPending, active, progressOf(session)) : null,
    end: completed ? { reason: endReason(ctx, states, session) } : undefined,
  };
}

/** Ends the active study session early. Progress already committed is kept. */
export async function endStudy(ctx: ServiceContext): Promise<void> {
  const active = await ctx.store.getActiveSession(ctx.course.slug);
  if (active?.kind === 'study') await ctx.store.completeSession(active.id);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/study/study-service.test.ts`
Expected: PASS (10 tests).

Two tests depend on engine behavior, so check them first if they fail:
- **Contrast test:** it relies on the first wrong US answer being at rung 1 (outcome `dropped`; rung stays 1). If the engine reports `'dropped'` differently, assert on `contrastQueued` and `next.format` only. Don't change the engine.
- **Perfect-learner test:** it relies on the session reaching 20 graded answers. With 17 items that holds (proven by the Plan 1 simulation). If it ends early, print the end reason and the states before changing anything.

- [ ] **Step 5: Commit**

```powershell
npm run typecheck
npm run lint
git add lib/study
git commit -m "feat(study): add study session service (intros, answers, contrast drills, staleness)"
```

---

### Task 12: Exam service

**Files:**
- Create: `lib/study/exam-service.ts`
- Test: `lib/study/exam-service.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/study/exam-service.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TEST_COURSE } from '@/lib/engine/test-fixtures';
import { abandonExam, startExam, submitExamAnswer } from './exam-service';
import { startStudy } from './study-service';
import { allGraduated, correctResponse, enrolledStore, pendingFor, testContext } from './test-helpers';
import { ServiceError, type TurnResult } from './types';

const SLUG = TEST_COURSE.slug;

async function readyStore() {
  const { store } = await enrolledStore({ placementDone: true });
  store.seedPromptStates(SLUG, allGraduated());
  return store;
}

async function runExam(store: Awaited<ReturnType<typeof readyStore>>, missKey?: string): Promise<TurnResult> {
  const ctx = testContext(store);
  let turn = await startExam(ctx);
  while (turn.next) {
    const pending = await pendingFor(store);
    const response = pending.entry.itemKey === missKey ? { kind: 'dont-know' as const } : correctResponse(pending);
    turn = await submitExamAnswer(ctx, { sessionId: turn.next.sessionId, questionId: turn.next.questionId, response });
    expect(turn.feedback).toBeUndefined();
  }
  return turn;
}

describe('exam', () => {
  it('is locked until every prompt is graduated', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    await expect(startExam(testContext(store))).rejects.toEqual(new ServiceError('exam_not_ready'));
  });

  it('asks every item once at Recall and resumes the same question', async () => {
    const store = await readyStore();
    const ctx = testContext(store);
    const first = await startExam(ctx);
    expect(first.next).toMatchObject({ sessionKind: 'exam', progress: { answered: 0, total: 17 } });
    expect(['typed', 'flag-grid']).toContain(first.next!.format);
    expect((await startExam(ctx)).next!.questionId).toBe(first.next!.questionId);
  });

  it('passes at 100%, recording the attempt and the pass date', async () => {
    const store = await readyStore();
    const end = await runExam(store);
    expect(end.end).toMatchObject({ reason: 'exam_finished', examResult: { score: 17, total: 17, passed: true, missed: [] } });
    expect((await store.getEnrollment(SLUG))!.passedAt).not.toBeNull();
    expect(await store.getExamAttempts(SLUG)).toHaveLength(1);
    expect(store.answers.filter((a) => a.context === 'exam')).toHaveLength(17);
  });

  it('fails on a single miss, lapsing that prompt and naming it', async () => {
    const store = await readyStore();
    const end = await runExam(store, 'TD');
    expect(end.end).toMatchObject({
      reason: 'exam_finished',
      examResult: { score: 16, total: 17, passed: false, missed: [{ name: 'Chad' }] },
    });
    expect((await store.getEnrollment(SLUG))!.passedAt).toBeNull();
    expect((await store.getPromptStates(SLUG)).some((s) => s.itemKey === 'TD' && s.phase === 'learning')).toBe(true);
    await expect(startExam(testContext(store))).rejects.toEqual(new ServiceError('exam_not_ready'));
  });

  it('abandons a study session when the exam starts, and blocks study during the exam', async () => {
    const store = await readyStore();
    const ctx = testContext(store);
    await store.createSession({ courseSlug: SLUG, kind: 'study', state: {}, pendingQuestion: null });
    await startExam(ctx);
    expect((await store.getActiveSession(SLUG))!.kind).toBe('exam');
    await expect(startStudy(ctx)).rejects.toEqual(new ServiceError('exam_in_progress'));
  });

  it('can be abandoned without recording an attempt', async () => {
    const store = await readyStore();
    const ctx = testContext(store);
    await startExam(ctx);
    await abandonExam(ctx);
    expect(await store.getActiveSession(SLUG)).toBeNull();
    expect(await store.getExamAttempts(SLUG)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/study/exam-service.test.ts`
Expected: FAIL. `Failed to resolve import "./exam-service"`.

- [ ] **Step 3: Implement**

Create `lib/study/exam-service.ts`:

```ts
import {
  advance,
  applyExamAnswer,
  buildExamQueue,
  currentEntry,
  hydrateStates,
  isExamReady,
  scoreExam,
  stateKey,
  type QueueSession,
} from '@/lib/engine';
import type { ServiceContext } from './context';
import { gradeSubmission } from './issue';
import { answerLog, confusionFor, issue, loadTurn, requireEnrollment, view } from './turn';
import { ServiceError, type EndView, type SubmissionInput, type TurnResult } from './types';

export interface ExamState extends QueueSession {
  results: { itemKey: string; correct: boolean }[];
}

const progressOf = (s: QueueSession) => ({ answered: s.position, total: s.queue.length });

/** Starts the final exam (gated by readiness, checked only here), or resumes it. */
export async function startExam(ctx: ServiceContext): Promise<TurnResult> {
  const { store, course, rng } = ctx;
  await requireEnrollment(ctx);
  const active = await store.getActiveSession(course.slug);
  if (active?.kind === 'exam' && active.pendingQuestion) {
    return { next: view(ctx, active.pendingQuestion, active, progressOf(active.state as ExamState)) };
  }

  const [stored, confusions] = await Promise.all([store.getPromptStates(course.slug), store.getConfusions(course.slug)]);
  if (!isExamReady(course, hydrateStates(course, stored))) throw new ServiceError('exam_not_ready');
  if (active) await store.completeSession(active.id);

  const queue = buildExamQueue(course, rng);
  const state: ExamState = { ...queue, results: [] };
  // Exams are always asked at Recall (rung 3), never via rungForState.
  const pending = issue(ctx, currentEntry(queue)!, 3, confusions);
  const session = await store.createSession({ courseSlug: course.slug, kind: 'exam', state, pendingQuestion: pending });
  return { next: view(ctx, pending, session, progressOf(state)) };
}

/** No per-question feedback during the exam; the result arrives with the last answer. */
export async function submitExamAnswer(ctx: ServiceContext, input: SubmissionInput): Promise<TurnResult> {
  const { store, course, now, presenter } = ctx;
  const { active, pending } = await loadTurn(ctx, input, 'exam');
  const { entry } = pending;
  if (entry.kind !== 'prompt') throw new ServiceError('invalid_response');

  const grade = gradeSubmission(pending, input.response, course);
  const [stored, confusions] = await Promise.all([store.getPromptStates(course.slug), store.getConfusions(course.slug)]);
  const states = hydrateStates(course, stored);
  const key = stateKey(entry.itemKey, entry.promptType);
  const updated = applyExamAnswer(states.find((s) => stateKey(s.itemKey, s.promptType) === key)!, grade, now);

  const previous = active.state as ExamState;
  const state: ExamState = {
    ...advance(previous),
    results: [...previous.results, { itemKey: entry.itemKey, correct: grade.correct }],
  };
  const nextEntry = currentEntry(state);
  const nextPending = nextEntry ? issue(ctx, nextEntry, 3, confusions) : null;

  let end: EndView | undefined;
  let examAttempt;
  let enrollment;
  if (!nextPending) {
    const result = scoreExam(state.results, course.items.length);
    examAttempt = { score: result.score, total: result.total, passed: result.passed, missedItemKeys: result.missed };
    if (result.passed) enrollment = { passedAt: now };
    end = {
      reason: 'exam_finished',
      examResult: { score: result.score, total: result.total, passed: result.passed, missed: result.missed.map(presenter.item) },
    };
  }

  await store.commitTurn(course.slug, {
    sessionId: active.id,
    expectedVersion: active.version,
    sessionState: state,
    pendingQuestion: nextPending,
    completed: nextPending === null,
    promptStates: [updated],
    answer: answerLog(ctx, pending, input.response, grade, 'exam'),
    confusion: confusionFor(pending, grade),
    enrollment,
    examAttempt,
  });

  return { next: nextPending ? view(ctx, nextPending, active, progressOf(state)) : null, end };
}

/** Voids the attempt; FSRS updates already made stand. */
export async function abandonExam(ctx: ServiceContext): Promise<void> {
  const active = await ctx.store.getActiveSession(ctx.course.slug);
  if (active?.kind === 'exam') await ctx.store.completeSession(active.id);
}
```

- [ ] **Step 4: Run to verify it passes, then commit**

```powershell
npx vitest run lib/study
npm run typecheck
npm run lint
git add lib/study
git commit -m "feat(study): add final exam service"
```

Expected: 5 exam tests pass, and all of `lib/study` is green.

---

### Task 13: End-to-end service flow against Supabase

**Files:**
- Create: `lib/study/flow.int.test.ts`

This proves that the services, the real `SupabaseStore`, `commit_turn`, and the real World Flags content work together.

- [ ] **Step 1: Write the integration flow test**

Create `lib/study/flow.int.test.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seededRng } from '@/lib/engine';
import { WORLD_FLAGS } from '@/lib/content/world-flags';
import { createSupabaseStore } from '@/lib/db/supabase-store';
import type { UserStore } from '@/lib/db/store';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ServiceContext } from './context';
import { startExam, submitExamAnswer } from './exam-service';
import { enroll, getCourseOverview } from './overview-service';
import { startPlacement, submitPlacementAnswer } from './placement-service';
import { getPresenter } from './presenters';
import { startStudy, submitStudyAnswer } from './study-service';
import { correctResponse, pendingFor } from './test-helpers';
import { ServiceError } from './types';

const admin = createAdminClient();
let userId: string;
let store: UserStore;

const ctx = (): ServiceContext => ({
  store,
  course: WORLD_FLAGS,
  presenter: getPresenter(WORLD_FLAGS),
  now: new Date(),
  rng: seededRng(Date.now() % 100_000),
  newId: randomUUID,
});

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: `flow-${randomUUID()}@example.com`,
    password: randomUUID(),
    email_confirm: true,
  });
  if (error) throw error;
  userId = data.user.id;
  store = createSupabaseStore(admin, userId);
});

afterAll(async () => {
  await admin.auth.admin.deleteUser(userId);
});

describe('World Flags end to end on Supabase', () => {
  it('enrolls, rejects a duplicate submit, and sweeps placement with all correct answers', async () => {
    await enroll(ctx());
    let turn = await startPlacement(ctx());
    const first = turn.next!;
    turn = await submitPlacementAnswer(ctx(), {
      sessionId: first.sessionId,
      questionId: first.questionId,
      response: correctResponse(await pendingFor(store, WORLD_FLAGS.slug), WORLD_FLAGS),
    });
    await expect(
      submitPlacementAnswer(ctx(), { sessionId: first.sessionId, questionId: first.questionId, response: { kind: 'dont-know' } }),
    ).rejects.toEqual(new ServiceError('stale_question'));

    while (turn.next) {
      const pending = await pendingFor(store, WORLD_FLAGS.slug);
      turn = await submitPlacementAnswer(ctx(), {
        sessionId: turn.next.sessionId,
        questionId: turn.next.questionId,
        response: correctResponse(pending, WORLD_FLAGS),
      });
    }
    expect(turn.end).toEqual({ reason: 'placement_complete' });
    expect((await getCourseOverview(ctx())).status).toBe('exam_ready');
  }, 300_000);

  it('has nothing to study right after a perfect placement', async () => {
    expect(await startStudy(ctx())).toEqual({ next: null, end: { reason: 'caught_up' } });
  });

  it('passes the final exam with all correct answers', async () => {
    let turn = await startExam(ctx());
    while (turn.next) {
      const pending = await pendingFor(store, WORLD_FLAGS.slug);
      turn = await submitExamAnswer(ctx(), {
        sessionId: turn.next.sessionId,
        questionId: turn.next.questionId,
        response: correctResponse(pending, WORLD_FLAGS),
      });
    }
    expect(turn.end?.examResult).toMatchObject({ score: 197, total: 197, passed: true });
    const overview = await getCourseOverview(ctx());
    expect(overview.status).toBe('passed');
    expect(overview.passedAt).not.toBeNull();
  }, 300_000);

  it('can start a practice-ahead study session after passing', async () => {
    const turn = await startStudy(ctx(), { mode: 'practice-ahead', size: 10 });
    expect(turn.next?.sessionKind).toBe('study');
    await submitStudyAnswer(ctx(), {
      sessionId: turn.next!.sessionId,
      questionId: turn.next!.questionId,
      response: correctResponse(await pendingFor(store, WORLD_FLAGS.slug), WORLD_FLAGS),
    });
  });
});
```

- [ ] **Step 2: Run it**

Run: `npm run test:integration -- lib/study/flow.int.test.ts`
Expected: PASS (4 tests). This makes about 400 round trips to the hosted project, so it takes a few minutes. Record the duration in your report.

- [ ] **Step 3: Commit**

```powershell
git add lib/study/flow.int.test.ts
git commit -m "test(study): end-to-end placement, exam, and study flow against Supabase"
```

---

### Task 14: Auth: session clients, proxy, magic-link login, callback, sign-out

**Files:**
- Create: `lib/supabase/server.ts`, `lib/supabase/proxy.ts`, `proxy.ts`, `lib/auth/safe-next.ts`, `lib/auth/safe-next.test.ts`, `app/login/page.tsx`, `app/login/login-form.tsx`, `app/login/actions.ts`, `app/auth/callback/route.ts`, `app/auth/actions.ts`

Before writing this task's code, read `node_modules/next/dist/docs/01-app/02-guides/authentication.md`, `.../03-file-conventions/proxy.md` and `.../02-guides/server-actions.md`. This is Next.js 16, and AGENTS.md warns that APIs differ from older versions. If an API below conflicts with those docs, follow the docs and report the difference.

- [ ] **Step 1: Write the failing `safeNext` test**

Create `lib/auth/safe-next.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
  it.each([
    ['/study/world-flags', '/study/world-flags'],
    ['/dashboard?x=1', '/dashboard?x=1'],
    [null, '/dashboard'],
    ['', '/dashboard'],
    ['https://evil.example', '/dashboard'],
    ['//evil.example', '/dashboard'],
    ['/\\evil.example', '/dashboard'],
    ['dashboard', '/dashboard'],
  ])('%s → %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement**

Run: `npx vitest run lib/auth` → FAIL (missing module).

Create `lib/auth/safe-next.ts`:

```ts
const DEFAULT_NEXT = '/dashboard';

/** Only same-origin relative paths are allowed as post-login destinations (no open redirects). */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return DEFAULT_NEXT;
  return value;
}
```

Run: `npx vitest run lib/auth` → PASS (8 cases).

- [ ] **Step 3: Create the cookie-bound session client**

Create `lib/supabase/server.ts`:

```ts
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { publicEnv } from '@/lib/env';

/** Per-request client acting as the signed-in user (publishable key + auth cookies). */
export async function createSessionClient() {
  const cookieStore = await cookies();
  const env = publicEnv();
  return createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only; proxy.ts refreshes the session.
        }
      },
    },
  });
}

/** Verified user id (JWT checked via getClaims), or null. */
export async function getUserId(): Promise<string | null> {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}

export async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  if (!userId) redirect('/login');
  return userId;
}
```

- [ ] **Step 4: Create the proxy**

Create `lib/supabase/proxy.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicEnv } from '@/lib/env';

const PROTECTED_PREFIXES = ['/dashboard', '/courses', '/study', '/placement', '/exam'];

/** Refreshes the auth session cookie on every request and gates protected routes. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = publicEnv();
  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Do not run code between createServerClient and getClaims: it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

  if (!signedIn && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }
  return response;
}
```

Create `proxy.ts` (repo root):

```ts
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

- [ ] **Step 5: Create login, callback and sign-out**

Create `app/login/actions.ts`:

```ts
'use server';

import { headers } from 'next/headers';
import { safeNext } from '@/lib/auth/safe-next';
import { createSessionClient } from '@/lib/supabase/server';

export interface LoginState {
  status: 'idle' | 'sent' | 'error';
  message?: string;
}

export async function sendMagicLink(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 'error', message: 'Enter a valid email address.' };

  const next = safeNext(String(formData.get('next') ?? ''));
  const origin = (await headers()).get('origin') ?? 'http://localhost:3000';
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { status: 'error', message: error.message };
  return { status: 'sent' };
}
```

Create `app/login/login-form.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { sendMagicLink, type LoginState } from './actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: 'idle' });

  if (state.status === 'sent') {
    return <p className="text-lg">Check your email for a sign-in link.</p>;
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className="font-medium">
        Email
      </label>
      <input id="email" name="email" type="email" required autoFocus className="rounded border px-3 py-2" />
      <button type="submit" disabled={pending} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
        {pending ? 'Sending…' : 'Email me a sign-in link'}
      </button>
      {state.status === 'error' && <p className="text-red-600">{state.message}</p>}
    </form>
  );
}
```

Create `app/login/page.tsx`:

```tsx
import { safeNext } from '@/lib/auth/safe-next';
import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Sign in to Recall Atlas</h1>
      {error && <p className="text-red-600">That sign-in link didn&apos;t work. Request a new one.</p>}
      <LoginForm next={safeNext(next)} />
    </main>
  );
}
```

Create `app/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@/lib/auth/safe-next';
import { createSessionClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));
  if (code) {
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
```

Create `app/auth/actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { createSessionClient } from '@/lib/supabase/server';

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect('/login');
}
```

- [ ] **Step 6: Verify and commit**

```powershell
npm test
npm run typecheck
npm run lint
npm run build
git add lib/auth lib/supabase proxy.ts app/login app/auth
git commit -m "feat(auth): magic-link sign-in with Supabase SSR, session-refreshing proxy, sign-out"
```

Expected: all pass. The build lists `/login`, `/auth/callback` and `ƒ Proxy (Middleware)`, or similar.

---

### Task 15: Server actions and a minimal dashboard

**Files:**
- Create: `lib/server/context.ts`, `app/actions/course.ts`, `app/dashboard/page.tsx`, `app/dashboard/actions.ts`

- [ ] **Step 1: Build real service contexts**

Create `lib/server/context.ts`:

```ts
import 'server-only';
import type { CourseDef } from '@/lib/engine';
import { createSupabaseStore } from '@/lib/db/supabase-store';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ServiceContext } from '@/lib/study/context';
import { getPresenter } from '@/lib/study/presenters';
import { cryptoRng, newId } from './random';

export function createServiceContext(userId: string, course: CourseDef): ServiceContext {
  return {
    store: createSupabaseStore(createAdminClient(), userId),
    course,
    presenter: getPresenter(course),
    now: new Date(),
    rng: cryptoRng(),
    newId,
  };
}
```

- [ ] **Step 2: Create the server actions**

Create `app/actions/course.ts`:

```ts
'use server';

import { getCourse } from '@/lib/content/registry';
import { SessionConflictError, StaleSessionError } from '@/lib/db/store';
import { createServiceContext } from '@/lib/server/context';
import type { ServiceContext } from '@/lib/study/context';
import { abandonExam, startExam, submitExamAnswer } from '@/lib/study/exam-service';
import { enroll, getCourseOverview, type CourseOverview } from '@/lib/study/overview-service';
import { skipPlacement, startPlacement, submitPlacementAnswer } from '@/lib/study/placement-service';
import { endStudy, startStudy, submitStudyAnswer } from '@/lib/study/study-service';
import { ServiceError, type ServiceErrorCode, type TurnResult } from '@/lib/study/types';
import { parseStudyOptions, parseSubmission } from '@/lib/study/validate';
import { getUserId } from '@/lib/supabase/server';

export type ActionError = ServiceErrorCode | 'unauthorized' | 'unknown_course' | 'stale_session';
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

async function run<T>(slug: string, fn: (ctx: ServiceContext) => Promise<T>): Promise<ActionResult<T>> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: 'unauthorized' };
  const course = getCourse(slug);
  if (!course) return { ok: false, error: 'unknown_course' };
  try {
    return { ok: true, data: await fn(createServiceContext(userId, course)) };
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.code };
    if (error instanceof StaleSessionError || error instanceof SessionConflictError) {
      return { ok: false, error: 'stale_session' };
    }
    throw error;
  }
}

export async function enrollAction(slug: string): Promise<ActionResult<void>> {
  return run(slug, enroll);
}
export async function overviewAction(slug: string): Promise<ActionResult<CourseOverview>> {
  return run(slug, getCourseOverview);
}

export async function startPlacementAction(slug: string): Promise<ActionResult<TurnResult>> {
  return run(slug, startPlacement);
}
export async function submitPlacementAction(slug: string, input: unknown): Promise<ActionResult<TurnResult>> {
  return run(slug, (ctx) => submitPlacementAnswer(ctx, parseSubmission(input)));
}
export async function skipPlacementAction(slug: string): Promise<ActionResult<void>> {
  return run(slug, skipPlacement);
}

export async function startStudyAction(slug: string, options?: unknown): Promise<ActionResult<TurnResult>> {
  return run(slug, (ctx) => startStudy(ctx, parseStudyOptions(options)));
}
export async function submitStudyAction(slug: string, input: unknown): Promise<ActionResult<TurnResult>> {
  return run(slug, (ctx) => submitStudyAnswer(ctx, parseSubmission(input)));
}
export async function endStudyAction(slug: string): Promise<ActionResult<void>> {
  return run(slug, endStudy);
}

export async function startExamAction(slug: string): Promise<ActionResult<TurnResult>> {
  return run(slug, startExam);
}
export async function submitExamAction(slug: string, input: unknown): Promise<ActionResult<TurnResult>> {
  return run(slug, (ctx) => submitExamAnswer(ctx, parseSubmission(input)));
}
export async function abandonExamAction(slug: string): Promise<ActionResult<void>> {
  return run(slug, abandonExam);
}
```

If Next 16 rejects non-function exports (the `type` exports) in a `'use server'` file, move `ActionError` and `ActionResult` into `lib/study/action-result.ts` and import them.

- [ ] **Step 3: Create a minimal dashboard (Plan 3 replaces this)**

Create `app/dashboard/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { enrollAction, skipPlacementAction } from '@/app/actions/course';

export async function enrollWorldFlags() {
  await enrollAction('world-flags');
  revalidatePath('/dashboard');
}

export async function skipWorldFlagsPlacement() {
  await skipPlacementAction('world-flags');
  revalidatePath('/dashboard');
}
```

Create `app/dashboard/page.tsx`:

```tsx
import { signOut } from '@/app/auth/actions';
import { WORLD_FLAGS } from '@/lib/content/world-flags';
import { createServiceContext } from '@/lib/server/context';
import { getCourseOverview } from '@/lib/study/overview-service';
import { requireUserId } from '@/lib/supabase/server';
import { enrollWorldFlags, skipWorldFlagsPlacement } from './actions';

/** Temporary developer dashboard; Plan 3 builds the real one. */
export default async function DashboardPage() {
  const userId = await requireUserId();
  const overview = await getCourseOverview(createServiceContext(userId, WORLD_FLAGS));
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <section className="space-y-2 rounded border p-4">
        <h2 className="text-lg font-medium">{overview.title}</h2>
        {overview.enrolled ? (
          <ul className="list-inside list-disc text-sm">
            <li>Status: {overview.status}</li>
            <li>
              Graduated prompts: {overview.readiness.graduated} / {overview.readiness.total}
            </li>
            <li>Reviews due: {overview.dueCount}</li>
            <li>Active session: {overview.activeSessionKind ?? 'none'}</li>
          </ul>
        ) : (
          <form action={enrollWorldFlags}>
            <button className="rounded bg-black px-4 py-2 text-white">Enroll</button>
          </form>
        )}
        {overview.status === 'placement' && (
          <form action={skipWorldFlagsPlacement}>
            <button className="rounded border px-4 py-2">Skip placement</button>
          </form>
        )}
      </section>
      <form action={signOut}>
        <button className="text-sm underline">Sign out</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Verify and commit**

```powershell
npm test
npm run typecheck
npm run lint
npm run build
git add lib/server app/actions app/dashboard
git commit -m "feat: server actions for all flows and a minimal dashboard"
```

---

### Task 16: Manual smoke test and full verification

- [ ] **Step 1: Run every automated check**

```powershell
npm test
npm run test:integration
npm run typecheck
npm run lint
npm run build
```

Expected: all green. Record test counts and the integration run's duration.

- [ ] **Step 2: Manual sign-in smoke test (the user does this)**

Start `npm run dev`, then have the user:
1. Open http://localhost:3000/dashboard. They should be redirected to `/login?next=%2Fdashboard`.
2. Enter their email, open the magic-link email and click it. They should land on `/dashboard` signed in.
3. Click **Enroll**. Status shows `placement` and graduated prompts show `0 / 394`.
4. Click **Skip placement**. Status shows `learning`.
5. Click **Sign out**. They return to `/login`, and `/dashboard` redirects again.

The free tier's built-in email sender is rate-limited (a few emails per hour). If no email arrives, check **Authentication → Logs** in the Supabase dashboard rather than retrying repeatedly.

- [ ] **Step 3: Confirm no answers leak**

With the dev server running and a placement or study session started via the integration test helpers (or by calling `startStudyAction` from a temporary button), inspect a `QuestionView` in the network tab or a server log. It must contain no ISO country codes as values, no `flag-icons` and no `/flags/` URLs. (`present.test.ts` already asserts this; this step is a sanity check on the real wiring.)

- [ ] **Step 4: Commit any fixes**

```powershell
git add -A
git commit -m "chore: plan 2 verification fixes"
```

Skip this step if there's nothing to commit.

---

## Notes for Plan 3 (UI, e2e, deploy)

- **Renderers** consume `QuestionView` only:
  - `intro`: show name and flag, then Continue (submits `{ kind: 'ack' }`).
  - `mc-text`: label buttons.
  - `flag-grid`: `<img src={flag}>` buttons.
  - `typed`: an input, with an "I don't know" button and Esc for it.
  - `contrast`: two steps: show `pair` labelled, then "Which one is {prompt.name}?" with `choices`.
- **Feedback** is `FeedbackView` (answer and `given`, both with name and flag). Exams return no feedback, only `end.examResult`.
- **End-of-session copy by `EndView.reason`:**
  - `complete`
  - `caught_up`: All caught up, plus Practice ahead or Take exam.
  - `come_back_later`: Nothing left to practice right now.
  - `more_new_available`: Start another session to learn more.
  - `placement_complete`
  - `exam_finished`
- **Errors:**
  - `stale_question` / `stale_session`: refetch with `start*Action` (which resumes).
  - `unauthorized`: go to `/login`.
- **Course-home mastery grid:** `CourseOverview.tiles` has keys and names but no flags. Serving all 197 flags as data URIs on one page is heavy. Add a cached route (e.g. `/api/flag-art/[key]`, which is fine for the reference grid but must never be used inside a question) or a sprite.
- **Google sign-in:** needs a Google Cloud OAuth client and the Supabase Google provider. Do this alongside the Vercel deploy, where production redirect URLs also have to be added.
- **Deploy:**
  - On Vercel, set the four env vars.
  - Add the production URL to Supabase redirect URLs.
  - Confirm `content/flags` is traced into the serverless bundle (`outputFileTracingIncludes`).
- **Exam result recovery:** if the final exam response is lost, show `CourseOverview.lastExamAttempt` rather than calling `startExamAction` again, which would start a fresh exam after a pass.
- **Contrast drill UI:** `pair[].flag` and `choices[].flag` are identical strings. Hide the labelled pair once the "Which one is X?" step begins.
- **Resuming ignores new options:** `startStudy` resumes an active session even if called with different mode/size. If the UI offers "Practice ahead" while a session is active, end the active one first (`endStudyAction`).
- **Concurrency:** one active session per course is enforced by a DB unique index and `sessions.version`. Two tabs on the same course will see `stale_*` errors in the older tab, which is expected.
