'use server';

import { revalidatePath } from 'next/cache';
import { enrollAction, skipPlacementAction } from '@/app/actions/course';

export async function enrollWorldFlags() {
  await enrollAction('world-flags');
  revalidatePath('/dashboard');
}

export async function skipWorldFlagsPlacement() {
  await skipPlacementAction('world-flags');
  revalidatePath('/dashboard');
}
