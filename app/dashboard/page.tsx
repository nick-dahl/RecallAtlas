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
