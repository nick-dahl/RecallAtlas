# Accounts: sign-up with a password, confirm by email: design spec

**Date:** 2026-10-08
**Status:** Design agreed in a Q&A with the user. The written spec is pending the user's review.
**Parent spec:** `2026-10-01-recall-atlas-design.md` (decision 21, "magic links only", is superseded here).

## 1. Summary

A visitor can create an account on the landing page with their own email and password, start studying immediately, and sign in again later from any device. The account confirms its email in the background: a confirmation email goes out at sign-up, and a banner asks for it until it is done. Studying is never blocked.

This also fixes today's bug: a new email's link fails when opened in a different browser or device from the one that requested it. Every emailed link (confirmation, sign-in link, password reset) will work wherever it is opened.

## 2. Decisions

| # | Decision | Choice |
|---|---|---|
| A1 | Confirmation | Confirm by email, but the account works immediately (confirm later, with a banner) |
| A2 | Email-link sign-in | Kept, as a secondary option on the sign-in page |
| A3 | Where sign-up happens | A form in the landing page hero |
| A4 | Password rule | At least 8 characters. No other rules and no strength meter |
| A5 | Admin-only password rule | Removed: everyone signs in with a password |
| A6 | Existing accounts without a password | Use "Forgot password?" to set one. No migration |
| A7 | Out of scope | Account settings page (change email, delete account), social logins, password strength meter |

## 3. Diagnosis of the current bug

- **What Supabase does:** for an email with no account, a sign-in link is issued as a sign-up confirmation. The live site's `/auth/callback` is on the redirect allow-list, so the link returns correctly.
- **Where it breaks:** the callback completes sign-in with `exchangeCodeForSession`, a PKCE exchange. That needs a code verifier cookie stored by the browser that requested the link.
- **Who it hits:** opening the email in another browser or device (a phone, or a mail app's built-in browser) has no verifier. The exchange fails and the learner lands on "That sign-in link didn't work."
- **The fix:** token-hash verification (`verifyOtp({ token_hash, type })`). It needs no browser state.

## 4. Pages and flows

### 4.1 Landing page (`/`)

- **The hero:** the visuals and copy stay. The "Start learning" button is replaced by a sign-up form: email, password (at least 8 characters, with a show/hide toggle), and a **Create account** button. Below it: "Already have an account? **Sign in**" (→ `/login`).
- **On success:**
  - the account is created and signed in;
  - a confirmation email is sent;
  - the learner is redirected to `/dashboard`.
- **Errors, shown inline and in plain words:**
  - an invalid email: "Enter a valid email address."
  - a short password: "Use at least 8 characters."
  - an email that already has an account: "That email already has an account." plus a **Sign in** link prefilled with the email;
  - anything else: "Couldn't create your account. Please try again in a minute." Supabase's raw message is never shown.
- **Signed-in visitors** are still redirected to `/dashboard`.

### 4.2 Sign-in page (`/login`)

- **Main form:** email and password, a **Sign in** button, and a **Forgot password?** link next to the password field.
- **Wrong details:** one message for every failure, "Couldn't sign in with that email and password." It never reveals whether an email has an account.
- **Secondary link:** "Email me a sign-in link instead" shows today's email-link form, which works as before but through the new confirm route (§5).
- **Below the form:** "New here? **Create an account**" (→ `/`).
- **Kept:** the dev sign-in shortcut (development only) and the `?next=` deep-link handling.

### 4.3 Forgot password

- **Request page:** `/login/forgot` has an email field and a **Send reset link** button. It always answers "If that email has an account, we've sent a reset link.", which never confirms whether an account exists.
- **The link** opens `/account/password`, signed in. It asks for a new password, at least 8 characters, entered twice. Saving it goes to `/dashboard` with "Password updated".
- **Accounts without a password:** existing email-link accounts use this flow to set their first password.

### 4.4 Confirmation banner

- **Where:** on `/dashboard` and course pages, for a signed-in account that hasn't confirmed: "Confirm your email: we sent a link to **you@x.com**." plus a **Resend** button. Resending answers "Sent." or "Please wait a minute before resending."
- **Confirming:** clicking the emailed link marks the account confirmed. The banner disappears for good.
- **Studying is never blocked.**

## 5. How it works

- **Sign-up:** a server action calls `supabase.auth.signUp({ email, password })`. The project's "Confirm email" setting is off, so the session starts immediately. Supabase's "user already registered" response maps to the friendly message.
- **Our own confirmation record:** the account is confirmed when its server-only `app_metadata.email_verified_at` is set. The learner can't write `app_metadata`; only the server (secret key) can.
  - **At sign-up,** the server sends the confirmation email with `signInWithOtp` (a magic-link email). Opening it proves the inbox belongs to the learner.
  - **The confirm route** (below) sets `email_verified_at` when a `magiclink` or `email` token verifies for an account that hasn't confirmed yet.
  - **Only password sign-ups are asked to confirm** (review fix: no clock). They're created with `app_metadata.confirm_pending: true`. Older accounts and email-link accounts proved their inbox to get in, so they never see the banner.
- **One route for every emailed link:** `GET /auth/confirm?token_hash=…&type=…&next=…`.
  - **Steps:** it calls `verifyOtp({ token_hash, type })`, then records the confirmation when relevant, then redirects.
  - **Where it redirects:** `type=recovery` goes to `/account/password`. Others go to `next` (safe-listed by the existing `safeNext`), defaulting to `/dashboard`.
  - **A bad or expired token** goes to `/login?error=link`, with the existing wording plus "Request a new one."
- **The old `/auth/callback` (PKCE) stays,** so links already sent keep working.
- **Email templates** (set by the user in Supabase, §6): Magic Link, Reset Password and Confirm Signup all link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…&next={{ .RedirectTo }}`-style URLs. Until they are updated, links use the old PKCE flow and behave as today.
- **Rate limits:** resend and forgot-password rely on Supabase's built-in email rate limits. A rate-limit error maps to the "Please wait a minute" wording.
- **The admin password rule (`lib/auth/admin.ts`)** is no longer used for sign-in. It stays wherever else the admin email is checked, such as the dev tools.

## 6. One-time Supabase setup (manual, by the user)

The plan's hand-off gives exact click-by-click steps:
1. ~~Turn "Confirm email" off.~~ **Not needed** (Plan 11 ruling): accounts are created on the server, already confirmed in Supabase's terms, so the setting can stay as it is.
2. Authentication → Email Templates: replace the **Magic Link**, **Reset Password** and **Confirm Signup** templates with the provided HTML, so their links use `/auth/confirm` with a token hash.
3. Authentication → URL Configuration: make sure `/auth/confirm` on the live site (and `http://localhost:3000/auth/confirm` for development) is on the redirect allow-list.

## 7. Testing

- **Unit tests:**
  - sign-up, sign-in and reset validation, and how each maps errors to messages (no raw Supabase text);
  - `safeNext` handling in the confirm route;
  - which link type marks an account confirmed;
  - the confirmed-or-not rule, including the pre-change accounts;
  - banner visibility.
- **Integration (Supabase):** confirming through a generated magic-link token sets `email_verified_at`, and a recovery token leads to a session that can update the password.
- **End-to-end:**
  - sign up from the landing page and reach the dashboard with the banner;
  - confirm through an admin-generated token-hash link, and the banner is gone;
  - sign out, then sign back in with the password;
  - "forgot password", then the generated recovery link, a new password, sign-out, and sign-in with the new password;
  - the email-link option is reachable from the sign-in page. The e2e test doesn't submit it, because each real send spends Supabase's small hourly email allowance on a bounced test address. The sending action is covered by unit tests instead.
  - existing specs are unaffected, since they create users through the admin API.
- **Email delivery itself** isn't tested end to end. Generated links stand in for real emails.

## 8. Out of scope

- An account settings page (change email, delete account).
- Social logins.
- A password strength meter or breach checks.
- Blocking unconfirmed accounts from anything.
