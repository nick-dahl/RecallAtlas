'use server';

import { redirect } from 'next/navigation';
import { enrollAction } from '@/app/actions/course';

export async function enrollAndOpen(slug: string) {
  const result = await enrollAction(slug);
  if (!result.ok) {
    if (result.error === 'unauthorized') redirect('/login?next=/dashboard');
    throw new Error(result.error);
  }
  redirect(`/courses/${slug}`);
}
