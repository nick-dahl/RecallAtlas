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
