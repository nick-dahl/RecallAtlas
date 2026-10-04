'use server';

import { redirect } from 'next/navigation';
import { skipPlacementAction } from '@/app/actions/course';

export async function skipPlacementAndStudy(slug: string) {
  const result = await skipPlacementAction(slug);
  if (!result.ok && result.error === 'unauthorized') redirect(`/login?next=/courses/${slug}`);
  redirect(`/courses/${slug}/study`);
}
