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
