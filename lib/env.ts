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

/**
 * The app's own origin, for building absolute links (e.g. magic-link redirects) that must
 * not depend on a request's `Origin`/`Host` header, which a client can spoof.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, '');
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3000';
  return required('NEXT_PUBLIC_SITE_URL');
}
