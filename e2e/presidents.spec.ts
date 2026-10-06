import { expect, test, type Page } from '@playwright/test';
import { US_PRESIDENTS } from '@/lib/content/us-presidents';
import { answerCorrectly, pendingOnScreen, practiceAhead, waitForNext } from './support/session';
import { admin, createTestUser, graduateEverything, nameOf, seedLearning, sessionCookies, type TestUser } from './support/supabase';

test.describe.configure({ mode: 'serial' });

let user: TestUser;
/** Set E2E_SCREENSHOTS=<dir> to save one screenshot per screen for a visual review. */
const shots = process.env.E2E_SCREENSHOTS;
const seen = new Set<string>();

async function shot(page: Page, name: string) {
  if (!shots || seen.has(name)) return;
  seen.add(name);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
}

/** Answers correctly, screenshotting the first question of each kind; returns its format. */
async function answer(page: Page): Promise<string> {
  const pending = await pendingOnScreen(page, user);
  const kind = pending.entry.kind === 'prompt' ? `${pending.entry.promptType}-${pending.format}` : pending.entry.kind;
  await shot(page, `q-${kind}`);
  await answerCorrectly(page, user, US_PRESIDENTS);
  return pending.format;
}

test.beforeAll(async () => {
  user = await createTestUser();
});

test.afterAll(async () => {
  await admin.auth.admin.deleteUser(user.id);
});

test('enroll, place by typing (with one miss), and study every question type', async ({ page, context }) => {
  test.setTimeout(300_000);
  await context.addCookies(await sessionCookies(user));

  await page.goto('/dashboard');
  await page.locator('article', { hasText: 'US Presidents' }).getByRole('button', { name: 'Start course' }).click();
  await expect(page).toHaveURL(/\/courses\/us-presidents$/);
  await expect(page.getByText('0 / 270 prompts learned')).toBeVisible();
  await expect(page.locator('[data-tile]')).toHaveCount(45);
  await shot(page, 'course-home-new');

  await page.getByRole('link', { name: 'Start placement' }).click();
  for (let i = 0; i < 3; i++) await answer(page);

  // A deliberate miss: the wrong president's name.
  const pending = await pendingOnScreen(page, user);
  await page.getByRole('textbox').fill('Abraham Lincoln');
  await page.keyboard.press('Enter');
  const feedback = page.getByTestId('feedback');
  await expect(feedback).toHaveAttribute('data-correct', 'false');
  await expect(feedback).toContainText(nameOf(pending.entry.itemKey, US_PRESIDENTS));
  await shot(page, 'feedback-wrong-name');
  await page.keyboard.press('Enter');
  await waitForNext(page, pending.questionId);

  await page.goto('/courses/us-presidents');
  await page.getByRole('button', { name: 'Skip placement' }).click();
  await expect(page).toHaveURL(/\/courses\/us-presidents\/study$/);
  await page.getByRole('button', { name: /End/ }).click();

  // Put two presidents mid-ladder so one session reaches level-2 and level-3 formats too.
  await seedLearning(user.id, US_PRESIDENTS, ['monroe'], 2);
  await seedLearning(user.id, US_PRESIDENTS, ['jq-adams'], 3);
  await page.goto('/courses/us-presidents/study?size=40');
  await expect(page.locator('[data-question-id]')).toBeVisible();
  const formats = new Set<string>();
  for (let i = 0; i < 60 && (await page.locator('[data-question-id]').count()) > 0; i++) formats.add(await answer(page));
  for (const f of ['intro', 'mc-text', 'image-grid', 'typed', 'gap-typed', 'order']) expect([...formats]).toContain(f);
});

test('pass the final exam, then a practice-ahead check', async ({ page, context }) => {
  test.setTimeout(900_000);
  await context.addCookies(await sessionCookies(user));
  await graduateEverything(user.id, US_PRESIDENTS);

  await page.goto('/courses/us-presidents');
  await page.getByRole('link', { name: 'Take the final exam' }).click();
  for (let i = 0; i < US_PRESIDENTS.items.length; i++) await answer(page);
  await expect(page.getByText('Passed')).toBeVisible();
  await expect(page.getByText('45/45')).toBeVisible();
  await shot(page, 'exam-passed');

  await page.getByRole('link', { name: 'Back to course' }).click();
  await shot(page, 'course-home-passed');
  expect(await practiceAhead(page, user, US_PRESIDENTS)).toBe(20);
});
