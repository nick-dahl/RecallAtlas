# Accounts Implementation Plan (Plan 11)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visitors create an account on the landing page with their own email and password, start studying at once, and sign in again from any device. Email confirmation happens later through a banner, and every emailed link works in any browser.

**Architecture:**
- **Sign-up:** a server action creates the user with the Supabase admin API (already confirmed in Supabase's own terms), signs them in with their password, and sends a magic-link email as our confirmation.
- **Our confirmation record:** `app_metadata.email_verified_at`, which only the server can write. It's set when any emailed link is used: the new token-hash route `/auth/confirm`, or the existing PKCE route `/auth/callback`.
- **Supporting pages:** the sign-in page gains password-for-everyone and "Forgot password?". Email-link sign-in becomes the secondary option. New pages: `/login/forgot` and `/account/password`. A banner on signed-in pages asks for confirmation.

**Tech Stack:** Next.js 16 App Router (server actions, route handlers), `@supabase/ssr` and `@supabase/supabase-js`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-08-accounts-design.md`

## Global Constraints

- **Next.js:** read the relevant guide in `node_modules/next/dist/docs/` before writing routes, pages or server actions (AGENTS.md). `params` and `searchParams` are Promises.
- **Prettier:** do not run it. **Commits:** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, written with `git commit -F`.
- **Never show raw Supabase error text.** Use only the fixed messages in `lib/auth/account.ts`.
- **Passwords:** at least 8 characters, and nothing else is enforced (A4).
- **Fixed messages, word for word:**
  - "Enter a valid email address."
  - "Use at least 8 characters."
  - "That email already has an account."
  - "Couldn't create your account. Please try again in a minute."
  - "Couldn't sign in with that email and password."
  - "If that email has an account, we've sent a reset link."
  - "Please wait a minute before resending."
  - "Passwords don't match."
- **No email-existence leaks:** sign-in and forgot-password never reveal whether an email has an account. Sign-up necessarily does.
- **Post-login destinations:** always go through `safeNext`.
- **Secrets:** `.env.local` holds real secrets. Never print or commit its values.

## Ruling made while planning (record it in the ledger when executing)

- **Users are created with `admin.auth.admin.createUser({ email, password, email_confirm: true })` and then `signInWithPassword`,** instead of the spec's `signUp` with "Confirm email" turned off.
  - **Why:** it works whatever the dashboard setting is, so the user's Supabase setup shrinks to the email templates and the redirect allow-list. "Confirm email" can stay on, and new email-link sign-ins still get a confirmation email.
  - **Cost:** server-side creation bypasses Supabase's sign-up captcha and rate limit. That's acceptable for this app; revisit if bot sign-ups appear.

## Review Focus

1. **A confirmation link opened on another device** (no shared cookies) confirms the account. The banner then disappears in the original browser on its next page load. It reads the user fresh (`getUser`), not the JWT. Covered by an e2e test in Task 6.
2. **Opening the same emailed link twice, or an expired one,** lands on `/login?error=link` with a clear message, never a crash. Covered by the route unit test in Task 2.
3. **Signing up with an email that already exists** (also differently capitalised, with spaces) shows "That email already has an account." and a sign-in link with the email filled in. Covered by an e2e test in Task 6 and a unit test in Task 1.
4. **A password-reset link** always ends on `/account/password`, whatever `next` it carries, and the new password works straight away. Covered by unit and e2e tests (Tasks 2 and 6).
5. **Accounts created before this release** (email-link only, no `email_verified_at`) never see the banner. Covered by a unit test in Task 1.

---

## File structure

| File | Responsibility |
|---|---|
| `lib/auth/account.ts` (+ test) | Pure helpers: validation, error→message mapping, `isEmailConfirmed`, `confirmDestination` |
| `lib/auth/verify.ts` (+ int test) | `markEmailVerified(userId)`, using the admin client |
| `app/auth/confirm/route.ts` (+ test) | Token-hash verification for every emailed link |
| `app/auth/callback/route.ts` (modify) | Also marks the account verified |
| `app/signup-actions.ts`, `components/auth/signup-form.tsx` | Landing-page sign-up |
| `app/page.tsx` (modify) | Hero form in place of the "Start learning" button |
| `app/login/actions.ts`, `login-form.tsx`, `password-form.tsx`, `page.tsx` (modify) | Password sign-in for everyone, with the email link secondary |
| `app/login/forgot/page.tsx`, `forgot-form.tsx` | Request a reset link |
| `app/account/password/page.tsx`, `actions.ts`, `password-form.tsx` | Choose a new password |
| `components/auth/confirm-banner.tsx`, `app/account/resend-action.ts` | The unconfirmed banner and resend |
| `lib/supabase/proxy.ts` (modify) | Protects `/account` |
| `docs/supabase-auth-setup.md` | The user's one-time Supabase steps and email templates |
| `e2e/accounts.spec.ts`, `e2e/learning-flow.spec.ts` (modify) | The full browser journeys |

---

### Task 1: Pure account helpers

**Files:** Create `lib/auth/account.ts` and `lib/auth/account.test.ts`

**Interfaces:**
- **Produces:**
  - `MESSAGES`: the exact strings above, as an object;
  - `PASSWORD_MIN = 8`;
  - `ACCOUNTS_CUTOFF: Date`;
  - `normalizeEmail(raw): string`;
  - `validateCredentials(email, password): string | null`;
  - `signUpErrorMessage(err: { code?: string; status?: number; message?: string }): string`;
  - `isEmailConfirmed(user: { created_at: string; app_metadata?: Record<string, unknown> }, cutoff?: Date): boolean`;
  - `confirmDestination(params: URLSearchParams): string`;
  - `isRateLimited(err): boolean`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { confirmDestination, isEmailConfirmed, isRateLimited, MESSAGES, normalizeEmail, signUpErrorMessage, validateCredentials } from './account';

describe('validateCredentials', () => {
  it('accepts a real email and an 8+ character password', () => {
    expect(validateCredentials('a@b.co', '12345678')).toBeNull();
  });
  it('names the problem in plain words', () => {
    expect(validateCredentials('nope', '12345678')).toBe(MESSAGES.invalidEmail);
    expect(validateCredentials('a@b.co', '1234567')).toBe(MESSAGES.shortPassword);
  });
});

describe('normalizeEmail (Review Focus 3)', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Me@Example.COM ')).toBe('me@example.com');
  });
});

describe('signUpErrorMessage', () => {
  it('maps an existing account, and hides everything else behind one message', () => {
    expect(signUpErrorMessage({ code: 'email_exists', status: 422 })).toBe(MESSAGES.exists);
    expect(signUpErrorMessage({ status: 422, message: 'A user with this email address has already been registered' })).toBe(MESSAGES.exists);
    expect(signUpErrorMessage({ status: 500, message: 'database exploded at row 7' })).toBe(MESSAGES.createFailed);
  });
});

describe('isRateLimited', () => {
  it('recognises Supabase rate limits', () => {
    expect(isRateLimited({ status: 429 })).toBe(true);
    expect(isRateLimited({ code: 'over_email_send_rate_limit' })).toBe(true);
    expect(isRateLimited({ status: 400 })).toBe(false);
  });
});

describe('isEmailConfirmed (Review Focus 5)', () => {
  const cutoff = new Date('2026-10-08T20:00:00Z');
  it('counts accounts created before the cutoff as confirmed', () => {
    expect(isEmailConfirmed({ created_at: '2026-10-01T00:00:00Z' }, cutoff)).toBe(true);
  });
  it('needs our own mark for accounts created after it', () => {
    expect(isEmailConfirmed({ created_at: '2026-10-09T00:00:00Z' }, cutoff)).toBe(false);
    expect(isEmailConfirmed({ created_at: '2026-10-09T00:00:00Z', app_metadata: { email_verified_at: '2026-10-09T01:00:00Z' } }, cutoff)).toBe(true);
  });
});

describe('confirmDestination (Review Focus 4)', () => {
  const p = (q: string) => new URLSearchParams(q);
  it('sends a password reset to the new-password page, whatever it carries', () => {
    expect(confirmDestination(p('type=recovery&next=%2Fcourses%2Fx'))).toBe('/account/password');
  });
  it('follows next, or the next inside a redirect_to, through safeNext', () => {
    expect(confirmDestination(p('type=email&next=%2Fcourses%2Fworld-map'))).toBe('/courses/world-map');
    expect(confirmDestination(p('type=email&redirect_to=https%3A%2F%2Fsite.example%2Fauth%2Fcallback%3Fnext%3D%252Fdashboard'))).toBe('/dashboard');
    expect(confirmDestination(p('type=email&next=https%3A%2F%2Fevil.example'))).toBe('/dashboard');
    expect(confirmDestination(p(''))).toBe('/dashboard');
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run lib/auth/account.test.ts`
Expected: FAIL. The module isn't found.

- [ ] **Step 3: Implement `lib/auth/account.ts`**

```ts
import { safeNext } from './safe-next';

export const PASSWORD_MIN = 8;

/** Accounts created before this release could only sign in through an emailed link, so their inbox is proven. */
export const ACCOUNTS_CUTOFF = new Date('2026-10-08T20:00:00Z');

/** Every message the auth screens show. Never show Supabase's own error text (it can leak internals). */
export const MESSAGES = {
  invalidEmail: 'Enter a valid email address.',
  shortPassword: `Use at least ${PASSWORD_MIN} characters.`,
  exists: 'That email already has an account.',
  createFailed: "Couldn't create your account. Please try again in a minute.",
  signInFailed: "Couldn't sign in with that email and password.",
  resetSent: "If that email has an account, we've sent a reset link.",
  wait: 'Please wait a minute before resending.',
  mismatch: "Passwords don't match.",
  updateFailed: "Couldn't update your password. Please try again in a minute.",
} as const;

type AuthErr = { code?: string; status?: number; message?: string } | null | undefined;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateCredentials(email: string, password: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return MESSAGES.invalidEmail;
  if (password.length < PASSWORD_MIN) return MESSAGES.shortPassword;
  return null;
}

export function signUpErrorMessage(err: AuthErr): string {
  if (err?.code === 'email_exists' || err?.code === 'user_already_exists' || /already (been )?registered/i.test(err?.message ?? '')) {
    return MESSAGES.exists;
  }
  return MESSAGES.createFailed;
}

export function isRateLimited(err: AuthErr): boolean {
  return err?.status === 429 || /rate_limit/.test(err?.code ?? '');
}

export function isEmailConfirmed(
  user: { created_at: string; app_metadata?: Record<string, unknown> },
  cutoff: Date = ACCOUNTS_CUTOFF,
): boolean {
  if (user.app_metadata?.email_verified_at) return true;
  return new Date(user.created_at) < cutoff;
}

/**
 * Where an emailed link lands after verifying. A password reset always goes to the new-password
 * page. Otherwise it's `next`, or the `next` inside the template's `redirect_to` URL. Both go
 * through safeNext.
 */
export function confirmDestination(params: URLSearchParams): string {
  if (params.get('type') === 'recovery') return '/account/password';
  const direct = params.get('next');
  if (direct) return safeNext(direct);
  const redirectTo = params.get('redirect_to');
  if (redirectTo) {
    try {
      return safeNext(new URL(redirectTo).searchParams.get('next'));
    } catch {
      return safeNext(null);
    }
  }
  return safeNext(null);
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run lib/auth/account.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** (message `feat(auth): account helpers`)

---

### Task 2: Verification record and the `/auth/confirm` route

**Files:**
- Create: `lib/auth/verify.ts`, `lib/auth/verify.int.test.ts`, `app/auth/confirm/route.ts`, `app/auth/confirm/route.test.ts`
- Modify: `app/auth/callback/route.ts`, `lib/supabase/proxy.ts`

**Interfaces:**
- **Produces:**
  - `markEmailVerified(userId: string): Promise<void>`, which keeps the first verification date;
  - `verifyEmailLink(supabase, tokenHash, type): Promise<{ userId: string } | null>`, which `route.ts` uses;
  - `GET /auth/confirm`.

- [ ] **Step 1: Write the failing route test** (`app/auth/confirm/route.test.ts`)

Mock `@/lib/supabase/server` and `@/lib/auth/verify` with `vi.mock`, the way existing route tests are written (look for one with `grep -rl "vi.mock('@/lib/supabase/server'" app lib`, and copy its pattern).

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const verifyOtp = vi.fn();
vi.mock('@/lib/supabase/server', () => ({ createSessionClient: async () => ({ auth: { verifyOtp } }) }));
const markEmailVerified = vi.fn();
vi.mock('@/lib/auth/verify', () => ({ markEmailVerified: (id: string) => markEmailVerified(id) }));

import { GET } from './route';

const call = (q: string) => GET(new NextRequest(`http://localhost:3000/auth/confirm?${q}`));

beforeEach(() => {
  verifyOtp.mockReset();
  markEmailVerified.mockReset();
});

describe('GET /auth/confirm', () => {
  it('verifies the token, records the confirmation and follows next', async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const res = await call('token_hash=abc&type=email&next=%2Fcourses%2Fworld-map');
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'email' });
    expect(markEmailVerified).toHaveBeenCalledWith('u1');
    expect(res.headers.get('location')).toBe('http://localhost:3000/courses/world-map');
  });

  it('sends a password reset to the new-password page (Review Focus 4)', async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const res = await call('token_hash=abc&type=recovery&next=%2Fdashboard');
    expect(res.headers.get('location')).toBe('http://localhost:3000/account/password');
  });

  it('turns a used, expired or malformed link into the sign-in page message (Review Focus 2)', async () => {
    verifyOtp.mockResolvedValue({ data: { user: null }, error: { status: 403, code: 'otp_expired' } });
    expect((await call('token_hash=abc&type=email')).headers.get('location')).toBe('http://localhost:3000/login?error=link');
    expect((await call('type=email')).headers.get('location')).toBe('http://localhost:3000/login?error=link');
    expect((await call('token_hash=abc&type=bogus')).headers.get('location')).toBe('http://localhost:3000/login?error=link');
    expect(markEmailVerified).not.toHaveBeenCalled();
  });
});
```

If no existing route test mocks the session client, keep this file. It's self-contained.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run app/auth/confirm/route.test.ts`
Expected: FAIL. The module isn't found.

- [ ] **Step 3: Implement**

`lib/auth/verify.ts`:

```ts
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Records that the account's owner opened an emailed link (our confirmation; see lib/auth/account.ts).
 * Only the server can write app_metadata. The first date is kept.
 */
export async function markEmailVerified(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) return;
  if (data.user.app_metadata?.email_verified_at) return;
  await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...data.user.app_metadata, email_verified_at: new Date().toISOString() },
  });
}
```

`app/auth/confirm/route.ts`:

```ts
import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { confirmDestination } from '@/lib/auth/account';
import { markEmailVerified } from '@/lib/auth/verify';
import { createSessionClient } from '@/lib/supabase/server';

const TYPES = new Set<EmailOtpType>(['email', 'magiclink', 'signup', 'recovery', 'invite', 'email_change']);

/**
 * Every emailed link (confirmation, sign-in link, password reset) lands here with a one-time token
 * hash. Unlike the PKCE callback, this needs nothing stored in the requesting browser, so a link
 * works on any device. Opening any of them proves the inbox, so the account is marked confirmed.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  if (tokenHash && type && TYPES.has(type)) {
    const cacheHeaders: Record<string, string> = {};
    const supabase = await createSessionClient((headers) => Object.assign(cacheHeaders, headers));
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error && data.user) {
      await markEmailVerified(data.user.id);
      const response = NextResponse.redirect(`${origin}${confirmDestination(searchParams)}`);
      for (const [key, value] of Object.entries(cacheHeaders)) response.headers.set(key, value);
      return response;
    }
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
```

`app/auth/callback/route.ts`: after a successful `exchangeCodeForSession`, mark the account confirmed too. The PKCE link is also emailed proof.

```ts
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.user) await markEmailVerified(data.user.id);
```

(Import `markEmailVerified`.)

`lib/supabase/proxy.ts`: add `'/account'` to `PROTECTED_PREFIXES`.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run app/auth/confirm/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Write and run the integration test** (`lib/auth/verify.int.test.ts`)

```ts
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isEmailConfirmed } from './account';
import { markEmailVerified } from './verify';
import { createAdminClient } from '@/lib/supabase/admin';

describe('markEmailVerified on Supabase', () => {
  it('sets email_verified_at once and keeps the first date', async () => {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.createUser({ email: `verify-${randomUUID()}@example.com`, password: randomUUID(), email_confirm: true });
    const id = data.user!.id;
    try {
      expect(isEmailConfirmed(data.user!)).toBe(false);
      await markEmailVerified(id);
      const first = (await admin.auth.admin.getUserById(id)).data.user!;
      expect(isEmailConfirmed(first)).toBe(true);
      await markEmailVerified(id);
      const again = (await admin.auth.admin.getUserById(id)).data.user!;
      expect(again.app_metadata.email_verified_at).toBe(first.app_metadata.email_verified_at);
    } finally {
      await admin.auth.admin.deleteUser(id);
    }
  });
});
```

Run: `npx vitest run --config vitest.integration.config.mts lib/auth/verify.int.test.ts`
Expected: PASS. Check that the integration config's include pattern covers `lib/**/*.int.test.ts`.

- [ ] **Step 6: Commit** (message `feat(auth): token-hash confirm route and our own confirmation record`)

---

### Task 3: Sign-up on the landing page

**Files:**
- Create: `app/signup-actions.ts`, `components/auth/signup-form.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- **Consumes:** Task 1's `MESSAGES`, `normalizeEmail`, `validateCredentials` and `signUpErrorMessage`.
- **Produces:**
  - `signUp(prev: SignUpState, form: FormData): Promise<SignUpState>`, which redirects to `/dashboard` on success;
  - `type SignUpState = { status: 'idle' | 'error'; message?: string; exists?: boolean; email?: string }`.

- [ ] **Step 1: Implement the action** (`app/signup-actions.ts`)

```ts
'use server';

import { redirect } from 'next/navigation';
import { MESSAGES, normalizeEmail, signUpErrorMessage, validateCredentials } from '@/lib/auth/account';
import { siteUrl } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSessionClient } from '@/lib/supabase/server';

export interface SignUpState {
  status: 'idle' | 'error';
  message?: string;
  /** The email already has an account: offer a prefilled sign-in. */
  exists?: boolean;
  email?: string;
}

/**
 * Creates the account (already confirmed in Supabase's terms, so it works whatever the dashboard's
 * "Confirm email" setting), signs it in, and sends our confirmation: a sign-in link whose use marks
 * the account confirmed (lib/auth/verify.ts). A failed send isn't fatal; the banner can resend.
 */
export async function signUp(_previous: SignUpState, formData: FormData): Promise<SignUpState> {
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const password = String(formData.get('password') ?? '');
  const invalid = validateCredentials(email, password);
  if (invalid) return { status: 'error', message: invalid, email };

  const { error: createError } = await createAdminClient().auth.admin.createUser({ email, password, email_confirm: true });
  if (createError) {
    const message = signUpErrorMessage(createError);
    if (message !== MESSAGES.exists) console.error('signUp createUser failed:', createError.status, createError.code);
    return { status: 'error', message, exists: message === MESSAGES.exists, email };
  }

  const supabase = await createSessionClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    console.error('signUp sign-in failed:', signInError.status, signInError.code);
    return { status: 'error', message: MESSAGES.createFailed, email };
  }
  const { error: sendError } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${siteUrl()}/auth/callback?next=%2Fdashboard` },
  });
  if (sendError) console.error('signUp confirmation send failed:', sendError.status, sendError.code);
  redirect('/dashboard');
}
```

- [ ] **Step 2: The form** (`components/auth/signup-form.tsx`)

```tsx
'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { signUp, type SignUpState } from '@/app/signup-actions';
import { buttonClass } from '@/components/ui/button';
import { PASSWORD_MIN } from '@/lib/auth/account';

const FIELD = 'w-full rounded-2xl bg-raised px-4 py-3 outline-none ring-2 ring-rule transition focus:ring-accent';

/** The landing page's sign-up: email, password, Create account. */
export function SignUpForm() {
  const [state, action, pending] = useActionState<SignUpState, FormData>(signUp, { status: 'idle' });
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="flex max-w-sm flex-col gap-3" aria-label="Create an account">
      <label htmlFor="signup-email" className="text-sm font-medium">Email</label>
      <input id="signup-email" name="email" type="email" required autoComplete="email" defaultValue={state.email} className={FIELD} />
      <label htmlFor="signup-password" className="text-sm font-medium">Password</label>
      <div className="relative">
        <input id="signup-password" name="password" type={show ? 'text' : 'password'} required minLength={PASSWORD_MIN} autoComplete="new-password" className={`${FIELD} pr-16`} />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft hover:text-ink" aria-pressed={show}>
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
      <p className="text-xs text-ink-soft">At least {PASSWORD_MIN} characters.</p>
      <button type="submit" disabled={pending} className={buttonClass('primary', 'px-7 py-3 text-base')}>
        {pending ? 'Creating your account…' : 'Create account'}
      </button>
      {state.status === 'error' && (
        <p role="alert" className="text-sm text-bad">
          {state.message}{' '}
          {state.exists && (
            <Link href={`/login?email=${encodeURIComponent(state.email ?? '')}`} className="underline">
              Sign in instead
            </Link>
          )}
        </p>
      )}
      <p className="text-sm text-ink-soft">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-ink underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 3: The landing page** (`app/page.tsx`)

Replace the `<Link href="/login" …>Start learning</Link>` with `<SignUpForm />` (importing it). Remove the now-unused imports (`Link`, `buttonClass`, if nothing else uses them).

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm test`
Expected: clean. The browser journey is tested in Task 6.

- [ ] **Step 5: Commit** (message `feat(auth): sign up with a password on the landing page`)

---

### Task 4: Sign-in for everyone, forgot password, new password

**Files:**
- Modify: `app/login/actions.ts`, `app/login/password-form.tsx`, `app/login/login-form.tsx`, `app/login/page.tsx`
- Create:
  - `app/login/forgot/page.tsx` and `app/login/forgot/forgot-form.tsx`;
  - `app/account/password/page.tsx`, `app/account/password/actions.ts` and `app/account/password/password-form.tsx`.

**Interfaces:**
- **Produces:**
  - `signInWithPassword(prev, form)` (renamed from `signInWithAdminPassword`);
  - `requestPasswordReset(prev, form): Promise<{ status: 'idle' | 'sent' | 'error'; message?: string }>`;
  - `updatePassword(prev, form)`, which redirects to `/dashboard?notice=password`.

- [ ] **Step 1: Write the failing message test** (append to `lib/auth/account.test.ts`)

```ts
describe('password confirmation', () => {
  it('checks the two entries match before length', () => {
    expect(newPasswordError('abcdefgh', 'abcdefgx')).toBe(MESSAGES.mismatch);
    expect(newPasswordError('short', 'short')).toBe(MESSAGES.shortPassword);
    expect(newPasswordError('abcdefgh', 'abcdefgh')).toBeNull();
  });
});
```

(Add `newPasswordError` to the import line.)

Run: `npx vitest run lib/auth/account.test.ts`
Expected: FAIL. `newPasswordError` isn't exported.

- [ ] **Step 2: Implement `newPasswordError`** in `lib/auth/account.ts`

```ts
export function newPasswordError(password: string, confirm: string): string | null {
  if (password !== confirm) return MESSAGES.mismatch;
  if (password.length < PASSWORD_MIN) return MESSAGES.shortPassword;
  return null;
}
```

Run: `npx vitest run lib/auth/account.test.ts`
Expected: PASS.

- [ ] **Step 3: Sign-in actions** (`app/login/actions.ts`)
  - **Remove** `isAdminEmail` and the admin restriction.
  - **Rename** `signInWithAdminPassword` to `signInWithPassword`. It normalises the email and uses `MESSAGES.signInFailed` for every failure.
  - **`sendMagicLink`** keeps its behaviour, but passes `emailRedirectTo: ${siteUrl()}/auth/callback?next=…`, which is unchanged. The new templates read `{{ .RedirectTo }}` from it (Task 6 doc).
  - **Add `requestPasswordReset`:**

```ts
export interface ResetState { status: 'idle' | 'sent' | 'error'; message?: string }

/** Always the same answer, so the form never reveals whether an email has an account. */
export async function requestPasswordReset(_previous: ResetState, formData: FormData): Promise<ResetState> {
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  if (validateCredentials(email, 'x'.repeat(PASSWORD_MIN))) return { status: 'error', message: MESSAGES.invalidEmail };
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=%2Faccount%2Fpassword`,
  });
  if (isRateLimited(error)) return { status: 'error', message: MESSAGES.wait };
  if (error) console.error('requestPasswordReset failed:', error.status, error.code);
  return { status: 'sent', message: MESSAGES.resetSent };
}
```

- [ ] **Step 4: The sign-in page** (`app/login/page.tsx`, `password-form.tsx`, `login-form.tsx`)
  - **Default view:** `PasswordForm`. Change its ids from `admin-*` to `signin-*`. It uses `signInWithPassword`, pre-fills `email` from `?email=`, and has a "Forgot password?" link (→ `/login/forgot`) beside the Password label.
  - **`?method=link`:** shows `LoginForm`, today's email-link form. The switch link reads "Email me a sign-in link instead" / "Sign in with a password".
  - **Copy:** the intro under "Sign in" becomes "Welcome back." for the password view, and keeps today's email-link text for the link view. Delete "Password sign-in is for the site admin."
  - **Below the form:** "New here? Create an account" (→ `/`).
  - **`?error=link`:** keeps its message, "That sign-in link didn't work. Request a new one."
  - **`?method=password`** (old bookmarks) is treated as the default view.

- [ ] **Step 5: The forgot-password page** (`app/login/forgot/page.tsx` and `forgot-form.tsx`)
  - The page has the heading "Reset your password", one sentence ("We'll email you a link to choose a new password."), and `ForgotForm`.
  - `ForgotForm` uses `requestPasswordReset`, shows `state.message` in a `bg-good-soft` box once sent, and has a "Back to sign in" link. Copy the field styling from `password-form.tsx`.

- [ ] **Step 6: The new-password page** (`app/account/password/*`)
  - **`page.tsx`:** calls `requireUserId()`. It shows the heading "Choose a new password", then `NewPasswordForm`.
  - **`NewPasswordForm`:** two fields, "New password" and "Confirm new password" (both `autoComplete="new-password"`), and a "Save password" button.
  - **`actions.ts`:**

```ts
'use server';

import { redirect } from 'next/navigation';
import { MESSAGES, newPasswordError } from '@/lib/auth/account';
import { createSessionClient } from '@/lib/supabase/server';

export async function updatePassword(_previous: { message?: string }, formData: FormData): Promise<{ message?: string }> {
  const password = String(formData.get('password') ?? '');
  const invalid = newPasswordError(password, String(formData.get('confirm') ?? ''));
  if (invalid) return { message: invalid };
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error('updatePassword failed:', error.status, error.code);
    return { message: MESSAGES.updateFailed };
  }
  redirect('/dashboard?notice=password');
}
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm run lint && npm test`
Expected: clean.

- [ ] **Step 8: Commit** (message `feat(auth): password sign-in for everyone, forgot and new password`)

---

### Task 5: The confirmation banner and resend

**Files:**
- Create: `components/auth/confirm-banner.tsx`, `components/auth/resend-button.tsx`, `app/account/resend-action.ts`
- Modify: `app/dashboard/page.tsx`, `app/courses/[slug]/page.tsx`

**Interfaces:**
- **Consumes:** `isEmailConfirmed`, `isRateLimited`, `MESSAGES`.
- **Produces:**
  - `<ConfirmBanner />`, an async server component that renders nothing when the account is confirmed or nobody is signed in;
  - `resendConfirmation(prev): Promise<{ message?: string }>`.

- [ ] **Step 1: The resend action** (`app/account/resend-action.ts`)

```ts
'use server';

import { isRateLimited, MESSAGES } from '@/lib/auth/account';
import { siteUrl } from '@/lib/env';
import { createSessionClient } from '@/lib/supabase/server';

export async function resendConfirmation(_previous: { message?: string }): Promise<{ message?: string }> {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) return {};
  const { error } = await supabase.auth.signInWithOtp({
    email: data.user.email,
    options: { shouldCreateUser: false, emailRedirectTo: `${siteUrl()}/auth/callback?next=%2Fdashboard` },
  });
  if (isRateLimited(error)) return { message: MESSAGES.wait };
  if (error) console.error('resendConfirmation failed:', error.status, error.code);
  return { message: 'Sent.' };
}
```

- [ ] **Step 2: The banner** (`components/auth/confirm-banner.tsx`)

It reads the user with `getUser()`, which is fresh from Supabase, not from the JWT. A confirmation made on another device therefore shows up on the next page load (Review Focus 1).

```tsx
import { isEmailConfirmed } from '@/lib/auth/account';
import { createSessionClient } from '@/lib/supabase/server';
import { ResendButton } from './resend-button';

/** Asks an unconfirmed account to confirm its email. Never blocks anything. */
export async function ConfirmBanner() {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.email || isEmailConfirmed(user)) return null;
  return (
    <div data-testid="confirm-banner" role="status" className="mx-auto mb-6 flex max-w-5xl flex-wrap items-center gap-3 rounded-2xl bg-raised px-4 py-3 text-sm ring-1 ring-rule">
      <span>
        Confirm your email: we sent a link to <strong>{user.email}</strong>.
      </span>
      <ResendButton />
    </div>
  );
}
```

`components/auth/resend-button.tsx` is a client component using `useActionState(resendConfirmation, {})`. It renders a small `buttonClass('secondary')` "Resend" button, then `state.message` beside it.

- [ ] **Step 3: Place it**
  - `<ConfirmBanner />` goes directly under `<SiteHeader />`, inside the page wrapper of `app/dashboard/page.tsx` and `app/courses/[slug]/page.tsx`.
  - The dashboard also reads `searchParams.notice`. When it is `'password'`, it shows a `bg-good-soft` line: "Password updated."

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm test`
Expected: clean.

- [ ] **Step 5: Commit** (message `feat(auth): confirm-your-email banner with resend`)

---

### Task 6: Setup guide, browser journeys, verification

**Files:**
- Create: `docs/supabase-auth-setup.md`, `e2e/accounts.spec.ts`
- Modify: `e2e/learning-flow.spec.ts`

- [ ] **Step 1: The setup guide** (`docs/supabase-auth-setup.md`)

Exact steps for the user:
1. **Redirect URLs:** Authentication → URL Configuration → Redirect URLs. Ensure `https://recall-atlas-gamma.vercel.app/**` and `http://localhost:3000/**` are listed.
2. **Email templates:** Authentication → Email Templates. Replace each template's link with these exact `href`s, keeping simple copy:
   - **Magic Link** (also our confirmation email): subject "Your Recall Atlas link", body "Use this link to confirm your email and sign in." Link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}`.
   - **Reset Password:** subject "Reset your Recall Atlas password". Link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`.
   - **Confirm Signup** (used when someone requests a sign-in link for a new email): link `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&redirect_to={{ .RedirectTo }}`.
3. **Email sending:** check Authentication → SMTP. With Supabase's built-in email, messages only reach the project team's addresses and are heavily rate-limited. For real users, set up a custom SMTP provider (e.g. Resend, Postmark).
4. **"Confirm email"** (Providers → Email) can stay as it is. Password sign-ups don't depend on it.
5. **Until step 2 is done,** links use the older flow: they work when opened in the browser that requested them.

- [ ] **Step 2: Rewrite the admin password e2e** (`e2e/learning-flow.spec.ts`)

Replace "admin password sign-in works for ADMIN_EMAIL only" with "password sign-in works for any account". It:
1. creates a throwaway user (`createTestUser`);
2. signs in at `/login` with a wrong password and expects "Couldn't sign in with that email and password.";
3. signs in with the right password and expects `/dashboard`;
4. signs out;
5. deletes the user.

No env skip is needed.

- [ ] **Step 3: The journeys** (`e2e/accounts.spec.ts`)

```ts
import { expect, test } from '@playwright/test';
import { admin } from './support/supabase';

test.describe.configure({ mode: 'serial' });

const email = `signup-${Date.now()}@example.com`;
const password = 'first-password-1';
const newPassword = 'second-password-2';
let userId: string | undefined;

async function findUserId(address: string) {
  for (let page = 1; page < 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const hit = data.users.find((u) => u.email === address);
    if (hit) return hit.id;
    if (data.users.length < 200) return undefined;
  }
}

/** Opens an emailed link without email: the admin API generates the same token hash. */
async function linkFor(type: 'magiclink' | 'recovery') {
  const { data, error } = await admin.auth.admin.generateLink({ type, email });
  if (error) throw error;
  return `/auth/confirm?token_hash=${data.properties.hashed_token}&type=${type === 'magiclink' ? 'email' : 'recovery'}`;
}

test.afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});

test('sign up on the landing page, study at once, confirm from another browser', async ({ page, browser }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByRole('button', { name: 'Create account' }).click();
  // The browser's own minlength check may block submit; the server message covers non-browser clients.
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  userId = await findUserId(email);
  await expect(page.getByTestId('confirm-banner')).toContainText(email);

  // Confirm in a different browser context (no shared cookies): Review Focus 1.
  const other = await browser.newContext();
  const phone = await other.newPage();
  await phone.goto(await linkFor('magiclink'));
  await expect(phone).toHaveURL(/\/dashboard$/);
  await other.close();

  await page.reload();
  await expect(page.getByTestId('confirm-banner')).toHaveCount(0);
});

test('an existing email is told to sign in instead (Review Focus 3)', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill(`  ${email.toUpperCase()} `);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toContainText('That email already has an account.');
  await page.getByRole('link', { name: 'Sign in instead' }).click();
  await expect(page.getByLabel('Email')).toHaveValue(email);
});

test('sign back in with the password; reset it; sign in with the new one', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole('button', { name: 'Sign out' }).click();

  // The forgot page never says whether an account exists (no email is sent for an unknown address).
  await page.goto('/login/forgot');
  await page.getByLabel('Email').fill(`nobody-${Date.now()}@example.com`);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByText("If that email has an account, we've sent a reset link.")).toBeVisible();

  // The reset link, wherever it's opened, ends on the new-password page (Review Focus 4).
  await page.goto(await linkFor('recovery'));
  await expect(page).toHaveURL(/\/account\/password$/);
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm new password').fill(newPassword);
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page).toHaveURL(/\/dashboard\?notice=password$/);
  await expect(page.getByText('Password updated.')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(newPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('a used link fails gracefully, and the email-link option is still there (Review Focus 2)', async ({ page }) => {
  const link = await linkFor('magiclink');
  await page.goto(link);
  await page.context().clearCookies();
  await page.goto(link);
  await expect(page).toHaveURL(/\/login\?error=link$/);
  await expect(page.getByText('That sign-in link didn’t work. Request a new one.')).toBeVisible();
  await page.getByRole('link', { name: 'Email me a sign-in link instead' }).click();
  await expect(page.getByRole('button', { name: 'Email me a sign-in link' })).toBeVisible();
});
```

Run: `npx playwright test e2e/accounts.spec.ts e2e/learning-flow.spec.ts > <scratchpad>/e2e-accounts.log 2>&1`
Expected: all pass, with the deployment-only test skipped. Then run the full suite alone. It's expected to pass, except for the known machine-clock stalls, which are rerun.

The sign-up test sends one real confirmation email (to an `@example.com` address) per run. Supabase may refuse it (rate limit, or built-in SMTP's team-only rule). That's logged, not fatal, by design.

- [ ] **Step 4: Full verification**

Run: `npm test && npm run test:integration && npm run typecheck && npm run lint && npm run build`
Expected: all clean. Remove `.next` before the browser run, because a build leaves it stale for the dev server.

- [ ] **Step 5: Commit** (message `test(auth): account journeys; docs: Supabase setup`)
