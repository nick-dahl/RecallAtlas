import fs from 'node:fs';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';
import { WORLD_FLAGS } from '@/lib/content/world-flags';
import { CURSOR_STEP, CURSOR_STEP_COARSE } from '@/components/map/geometry';
import type { CourseDef } from '@/lib/engine';
import type { FrameData } from '@/lib/map/types';
import { itemOf, pendingQuestion, type PendingRow, type TestUser } from './supabase';

export async function currentQuestionId(page: Page): Promise<string> {
  const stage = page.locator('[data-question-id]');
  await expect(stage).toBeVisible();
  return (await stage.getAttribute('data-question-id'))!;
}

/** Waits until the stage shows a different question, or the session ends. */
export async function waitForNext(page: Page, previousId: string) {
  await expect
    .poll(async () => {
      const stage = page.locator('[data-question-id]');
      if ((await stage.count()) === 0) return 'ended';
      return (await stage.getAttribute('data-question-id')) === previousId ? 'same' : 'next';
    })
    .not.toBe('same');
}

/** The server-side pending question for what is on screen (tests only). */
export async function pendingOnScreen(page: Page, user: TestUser): Promise<PendingRow> {
  const id = await currentQuestionId(page);
  let pending = await pendingQuestion(user.id);
  await expect.poll(async () => (pending = await pendingQuestion(user.id))?.questionId).toBe(id);
  return pending!;
}

const frames = new Map<string, FrameData>();
export function frameData(id: string): FrameData {
  if (!frames.has(id)) {
    frames.set(id, JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content', 'maps', `${id}.hit.json`), 'utf8')));
  }
  return frames.get(id)!;
}

/** Clicks the middle of `key` on the on-screen map, scaling the hit-data point to the map's box. */
export async function clickCountry(page: Page, pending: PendingRow, key: string) {
  const frame = frameData(pending.frame!);
  const [x, y] = frame.countries[key].label;
  // A locator click scrolls the map into view first; a raw mouse click below the fold does nothing.
  const map = page.locator('[data-map-frame]');
  await map.scrollIntoViewIfNeeded();
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: (x / frame.width) * box.width, y: (y / frame.height) * box.height } });
}

/**
 * Answers a map-click question with the keyboard only: arrow keys (Shift for coarse steps) walk
 * the crosshair from the centre to `key`'s interior point, then Enter clicks there.
 */
export async function keyboardClickCountry(
  page: Page,
  pending: PendingRow,
  key: string,
  beforeEnter?: () => Promise<void>,
) {
  const frame = frameData(pending.frame!);
  const [lx, ly] = frame.countries[key].label;
  const aspect = frame.width / frame.height;
  const map = page.locator('[data-map-frame]');
  await expect(map).toBeFocused();
  const walk = async (delta: number, scale: number, plus: string, minus: string) => {
    const coarse = Math.trunc(delta / (CURSOR_STEP_COARSE * scale));
    const fine = Math.round((delta - coarse * CURSOR_STEP_COARSE * scale) / (CURSOR_STEP * scale));
    for (let i = 0; i < Math.abs(coarse); i++) await page.keyboard.press(`Shift+${coarse > 0 ? plus : minus}`);
    for (let i = 0; i < Math.abs(fine); i++) await page.keyboard.press(fine > 0 ? plus : minus);
  };
  await walk(lx / frame.width - 0.5, 1, 'ArrowRight', 'ArrowLeft');
  await walk(ly / frame.height - 0.5, aspect, 'ArrowDown', 'ArrowUp');
  await expect(page.locator('[data-crosshair]')).toBeVisible();
  await beforeEnter?.();
  await page.keyboard.press('Enter');
}

/** Answers the on-screen question correctly, looking the answer up server-side. */
export async function answerCorrectly(page: Page, user: TestUser, course: CourseDef = WORLD_FLAGS) {
  const pending = await pendingOnScreen(page, user);
  const { entry, format, choices, questionId } = pending;

  if (entry.kind === 'intro') {
    await page.keyboard.press('Enter');
  } else if (format === 'typed' || format === 'gap-typed') {
    const field = course.promptTypes.find((p) => p.id === entry.promptType)?.answerField ?? 'name';
    const item = itemOf(entry.itemKey, course);
    await page.getByRole('textbox').fill(field === 'name' ? item.name : item.answers![field].text);
    await page.keyboard.press('Enter');
  } else if (format === 'map-click') {
    await clickCountry(page, pending, entry.itemKey);
  } else if (format === 'order') {
    // Tap the cards earliest first; the last tap submits.
    const first = (key: string) => itemOf(key, course).sequence![0];
    for (const c of [...choices].sort((a, b) => first(a.itemKey) - first(b.itemKey))) {
      await page.locator(`[data-choice-id="${c.id}"]`).click();
    }
  } else {
    if (entry.kind === 'contrast') await page.keyboard.press('Enter');
    await page.locator(`[data-choice-id="${choices.find((c) => c.itemKey === entry.itemKey)!.id}"]`).click();
  }
  await waitForNext(page, questionId);
}

/** Runs a practice-ahead check from the course page to its end screen. */
export async function practiceAhead(page: Page, user: TestUser, course: CourseDef = WORLD_FLAGS) {
  await page.getByRole('link', { name: 'Practice ahead' }).first().click();
  await expect(page).toHaveURL(/mode=practice-ahead/);
  const asked = new Set<string>();
  while ((await page.locator('[data-question-id]').count()) > 0 || asked.size === 0) {
    const pending = await pendingOnScreen(page, user);
    expect(asked.has(pending.entry.itemKey), 'practice ahead repeated an item').toBe(false);
    asked.add(pending.entry.itemKey);
    await answerCorrectly(page, user, course);
  }
  await expect(page.getByText('Check complete')).toBeVisible();
  await expect(page.getByText(`You remembered all ${asked.size}.`)).toBeVisible();
  return asked.size;
}
