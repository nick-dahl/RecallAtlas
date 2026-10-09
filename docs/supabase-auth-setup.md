# Supabase setup for accounts (one-time)

This makes every emailed link (confirmation, sign-in link, password reset) work on any device or browser. It takes about five minutes in the Supabase dashboard. Until it's done, links still work, but only when opened in the browser that requested them.

You don't need to change the **"Confirm email"** setting: password sign-ups don't depend on it.

## 1. Redirect URLs

**Authentication → URL Configuration → Redirect URLs.** Make sure both of these are listed:

- `https://recall-atlas-gamma.vercel.app/**`
- `http://localhost:3000/**`

## 2. Email templates

**Authentication → Email Templates.** For each template below, replace the subject and body with the text given, then save.

### Magic Link

This is also the confirmation email sent when someone signs up.

- **Subject:** `Your Recall Atlas link`
- **Body:**

```html
<h2>Recall Atlas</h2>
<p>Use this link to confirm your email and sign in:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}">Confirm and sign in</a></p>
<p>If you didn't ask for this, you can ignore this email.</p>
```

### Reset Password

- **Subject:** `Reset your Recall Atlas password`
- **Body:**

```html
<h2>Reset your password</h2>
<p>Follow this link to choose a new password:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Choose a new password</a></p>
<p>If you didn't ask for this, you can ignore this email. Your password won't change.</p>
```

### Confirm Signup

This is used when someone asks for a sign-in link for an email that has no account yet.

- **Subject:** `Welcome to Recall Atlas`
- **Body:**

```html
<h2>Welcome to Recall Atlas</h2>
<p>Use this link to confirm your email and sign in:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&redirect_to={{ .RedirectTo }}">Confirm and sign in</a></p>
```

## 3. Email sending (check this)

**Authentication → Emails → SMTP Settings.**

Supabase's built-in email only reaches addresses on your project's team, and it allows very few emails per hour. If people outside the team will sign up, set up a custom SMTP provider (for example Resend or Postmark). Otherwise their confirmation and reset emails won't arrive.

Signing up and studying still work without email. Only confirmation and password reset need it.

## 4. Check it worked

1. On the live site, create an account with an address you can read.
2. Open the confirmation email **on a different device** (for example your phone) and click the link.
3. Reload the dashboard on the first device: the "Confirm your email" banner should be gone.
