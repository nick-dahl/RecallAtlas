import { expect, test, type Page } from '@playwright/test';
import { WORLD_CAPITALS } from '@/lib/content/world-capitals';
import { answerCorrectly, pendingOnScreen, practiceAhead, waitForNext } from './support/session';
import { admin, createTestUser, graduateEverything, seedLearning, sessionCookies, type TestUser } from './support/supabase';

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

/** Answers correctly, checking each kind's picture; returns the kind (prompt-format). */
async function answer(page: Page): Promise<string> {
  const pending = await pendingOnScreen(page, user);
  const kind = pending.entry.kind === 'prompt' ? `${pending.entry.promptType}-${pending.format}` : pending.entry.kind;
  await shot(page, `q-${kind}`);
  // Country → capital shows a locator map; capital → country must not (it would give the answer).
  if (kind.startsWith('country_to_capital')) await expect(page.locator('[data-map-frame]')).toBeVisible();
  if (kind.startsWith('capital_to_country')) await expect(page.locator('[data-map-frame]')).toHaveCount(0);
  await answerCorrectly(page, user, WORLD_CAPITALS);
  return kind;
}

const capitalOf = (key: string) => WORLD_CAPITALS.items.find((i) => i.key === key)!.answers!.capital.text;
const nameOf = (key: string) => WORLD_CAPITALS.items.find((i) => i.key === key)!.name;

test.beforeAll(async () => {
  user = await createTestUser();
});

test.afterAll(async () => {
  await admin.auth.admin.deleteUser(user.id);
});

test('enroll, place by typing (with one miss), and study both directions', async ({ page, context }) => {
  test.setTimeout(300_000);
  await context.addCookies(await sessionCookies(user));

  await page.goto('/dashboard');
  await page.locator('article', { hasText: 'World Capitals' }).getByRole('button', { name: 'Start course' }).click();
  await expect(page).toHaveURL(/\/courses\/world-capitals$/);
  await expect(page.getByText('0 / 394 prompts learned')).toBeVisible();
  const cards = page.locator('[data-tile]');
  await expect(cards).toHaveCount(197);
  // Nothing introduced yet: every capital is hidden.
  await expect(cards.filter({ hasText: '?' })).toHaveCount(197);
  await shot(page, 'course-home-new');

  await page.getByRole('link', { name: 'Start placement' }).click();
  for (let i = 0; i < 3; i++) await answer(page);

  // A deliberate miss: a made-up capital.
  const pending = await pendingOnScreen(page, user);
  await page.getByRole('textbox').fill('Atlantis');
  await page.keyboard.press('Enter');
  const feedback = page.getByTestId('feedback');
  await expect(feedback).toHaveAttribute('data-correct', 'false');
  await expect(feedback).toContainText(`the capital of ${nameOf(pending.entry.itemKey)} is ${capitalOf(pending.entry.itemKey)}`);
  await shot(page, 'feedback-wrong-capital');
  await page.keyboard.press('Enter');
  await waitForNext(page, pending.questionId);

  await page.goto('/courses/world-capitals');
  await page.getByRole('button', { name: 'Skip placement' }).click();
  await expect(page).toHaveURL(/\/courses\/world-capitals\/study$/);
  await page.getByRole('button', { name: /End/ }).click();

  // Two countries mid-ladder, so one session reaches the typed levels in both directions.
  await seedLearning(user.id, WORLD_CAPITALS, ['FR'], 2);
  await seedLearning(user.id, WORLD_CAPITALS, ['DE'], 3);
  await page.goto('/courses/world-capitals/study?size=40');
  await expect(page.locator('[data-question-id]')).toBeVisible();
  const kinds = new Set<string>();
  for (let i = 0; i < 60 && (await page.locator('[data-question-id]').count()) > 0; i++) kinds.add(await answer(page));
  for (const kind of [
    'intro',
    'country_to_capital-mc-text',
    'capital_to_country-mc-text',
    'country_to_capital-typed',
    'capital_to_country-typed',
  ]) {
    expect([...kinds]).toContain(kind);
  }

  await page.goto('/courses/world-capitals');
  // Introduced countries now show their capitals.
  await expect(cards.filter({ hasNotText: '?' }).first()).toBeVisible();
  await shot(page, 'course-home-progress');
});

test('pass the final exam, then a practice-ahead check', async ({ page, context }) => {
  test.setTimeout(900_000);
  await context.addCookies(await sessionCookies(user));
  await graduateEverything(user.id, WORLD_CAPITALS);

  await page.goto('/courses/world-capitals');
  await page.getByRole('link', { name: 'Take the final exam' }).click();
  for (let i = 0; i < WORLD_CAPITALS.items.length; i++) await answer(page);
  await expect(page.getByText('Passed')).toBeVisible();
  await expect(page.getByText('197/197')).toBeVisible();
  await shot(page, 'exam-passed');

  await page.getByRole('link', { name: 'Back to course' }).click();
  expect(await practiceAhead(page, user, WORLD_CAPITALS)).toBe(20);
});
