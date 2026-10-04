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
