import 'server-only';
import type { CourseDef } from '@/lib/engine';
import { createSupabaseStore } from '@/lib/db/supabase-store';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ServiceContext } from '@/lib/study/context';
import { getMapSupport, getPresenter } from '@/lib/study/presenters';
import { cryptoRng, newId } from './random';

export function createServiceContext(userId: string, course: CourseDef): ServiceContext {
  return {
    store: createSupabaseStore(createAdminClient(), userId),
    course,
    presenter: getPresenter(course),
    maps: getMapSupport(course),
    now: new Date(),
    rng: cryptoRng(),
    newId,
  };
}
