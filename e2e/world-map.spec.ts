import { expect, test, type Page } from '@playwright/test';
import { WORLD_MAP } from '@/lib/content/world-map';
import {
  answerCorrectly,
  clickCountry,
  frameData,
  keyboardClickCountry,
  pendingOnScreen,
  practiceAhead,
  waitForNext,
} from './support/session';
import { admin, createTestUser, graduateEverything, nameOf, sessionCookies, type TestUser } from './support/supabase';

test.describe.configure({ mode: 'serial' });

let user: TestUser;
/** Set E2E_SCREENSHOTS=<dir> to save one screenshot per screen for a visual review. */
const shots = process.env.E2E_SCREENSHOTS;
const seen = new Set<string>();

async function shot(page: Page, name: string) {
  if (!shots || seen.has(name)) return;
  seen.add(name);
  await page.waitForTimeout(500); // let ink-in and rise animations settle
  await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
}

/** Answers correctly, screenshotting the first question of each kind. */
async function answer(page: Page) {
  const pending = await pendingOnScreen(page, user);
  const kind = pending.entry.kind === 'prompt' ? `${pending.entry.promptType}-${pending.format}` : pending.entry.kind;
  await shot(page, `q-${kind}`);
  await answerCorrectly(page, user, WORLD_MAP);
}

test.beforeAll(async () => {
  user = await createTestUser();
});

test.afterAll(async () => {
  await admin.auth.admin.deleteUser(user.id);
});

test('enroll, place by clicking (with one miss), skip ahead, and study', async ({ page, context }) => {
  test.setTimeout(300_000);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Learn the world/ })).toBeVisible();
  await shot(page, 'landing');
  await context.addCookies(await sessionCookies(user));

  await page.goto('/dashboard');
  await shot(page, 'dashboard');
  await page.locator('article', { hasText: 'World Map' }).getByRole('button', { name: 'Start course' }).click();
  await expect(page).toHaveURL(/\/courses\/world-map$/);
  await expect(page.getByText('0 / 416 prompts learned')).toBeVisible();
  await expect(page.locator('[data-tile]')).toHaveCount(WORLD_MAP.items.length);
  await shot(page, 'course-home-new');

  await page.getByRole('link', { name: 'Start placement' }).click();

  // Keyboard only: walk the crosshair to the first country and press Enter.
  const first = await pendingOnScreen(page, user);
  await shot(page, 'q-find-map-click');
  await keyboardClickCountry(page, first, first.entry.itemKey, () => shot(page, 'keyboard-crosshair'));
  await expect(page.getByTestId('feedback')).toHaveAttribute('data-correct', 'true');
  await waitForNext(page, first.questionId);
  for (let i = 0; i < 2; i++) await answer(page);

  // A deliberate wrong click: a neighbour of the asked country.
  const pending = await pendingOnScreen(page, user);
  const shown = frameData(pending.frame!).countries;
  const neighbour = WORLD_MAP.items
    .find((i) => i.key === pending.entry.itemKey)!
    .lookalikes.find((k) => shown[k] && !shown[k].sliver && !shown[k].marker)!;
  await clickCountry(page, pending, neighbour);
  const feedback = page.getByTestId('feedback');
  await expect(feedback).toHaveAttribute('data-correct', 'false');
  await expect(feedback).toContainText(`${nameOf(pending.entry.itemKey, WORLD_MAP)} is the one outlined in green`);
  await shot(page, 'feedback-wrong-click');
  await page.keyboard.press('Enter');
  await waitForNext(page, pending.questionId);

  await page.goto('/courses/world-map');
  await page.getByRole('button', { name: 'Skip placement' }).click();
  await expect(page).toHaveURL(/\/courses\/world-map\/study$/);
  for (let i = 0; i < 12; i++) await answer(page);
  await expect(page.locator('[data-question-id]')).toBeVisible();

  await page.getByRole('button', { name: /End/ }).click();
  await expect(page).toHaveURL(/\/courses\/world-map$/);
  await expect(page.getByText(/[1-9]\d* in progress/)).toBeVisible();
  await shot(page, 'course-home-progress');
});

test('pass the final exam by clicking and typing', async ({ page, context }) => {
  test.setTimeout(900_000);
  await context.addCookies(await sessionCookies(user));
  await graduateEverything(user.id, WORLD_MAP);

  await page.goto('/courses/world-map');
  await page.getByRole('link', { name: 'Take the final exam' }).click();
  for (let i = 0; i < WORLD_MAP.items.length; i++) await answer(page);

  await expect(page.getByText('Passed')).toBeVisible();
  await expect(page.getByText(`${WORLD_MAP.items.length}/${WORLD_MAP.items.length}`)).toBeVisible();
  await shot(page, 'exam-passed');
  await page.getByRole('link', { name: 'Back to course' }).click();
  await expect(page.locator('[data-tile="review"], [data-tile="strong"]')).toHaveCount(WORLD_MAP.items.length);
  await shot(page, 'course-home-passed');

  expect(await practiceAhead(page, user, WORLD_MAP)).toBe(20);
});
