import { expect, test, type Page } from '@playwright/test';
import { GREAT_PAINTINGS } from '@/lib/content/great-paintings';
import { answerCorrectly, pendingOnScreen, practiceAhead, waitForNext } from './support/session';
import { admin, createTestUser, graduateEverything, seedLearning, sessionCookies, type TestUser } from './support/supabase';

test.describe.configure({ mode: 'serial' });

let user: TestUser;
const n = GREAT_PAINTINGS.items.length;
/** Set E2E_SCREENSHOTS=<dir> to save one screenshot per screen for a visual review. */
const shots = process.env.E2E_SCREENSHOTS;
const seen = new Set<string>();

async function shot(page: Page, name: string) {
  if (!shots || seen.has(name)) return;
  seen.add(name);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
}

const titleOf = (key: string) => GREAT_PAINTINGS.items.find((i) => i.key === key)!.name;

/** Answers correctly, checking each kind's picture; returns the kind (prompt-format). */
async function answer(page: Page): Promise<string> {
  const pending = await pendingOnScreen(page, user);
  const kind = pending.entry.kind === 'prompt' ? `${pending.entry.promptType}-${pending.format}` : pending.entry.kind;
  await shot(page, `q-${kind}`);
  const question = page.locator('[data-question-id]');
  if (kind.startsWith('image_to_')) {
    // The painting asked about is shown, unlabelled.
    await expect(question.locator('img').first()).toHaveAttribute('alt', '');
  }
  if (kind.startsWith('title_to_image')) {
    // Only the grid's unlabelled options: no painting above the question.
    await expect(question.locator('img:not([data-choice-id] img)')).toHaveCount(0);
    await expect(question.locator('[data-choice-id] img').first()).toHaveAttribute('alt', '');
  }
  await answerCorrectly(page, user, GREAT_PAINTINGS);
  return kind;
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
  await page.locator('article', { hasText: 'Great Paintings' }).getByRole('button', { name: 'Start course' }).click();
  await expect(page).toHaveURL(/\/courses\/great-paintings$/);
  await expect(page.getByText(`0 / ${4 * n} prompts learned`)).toBeVisible();
  const tiles = page.locator('[data-tile]');
  await expect(tiles).toHaveCount(n);
  // Nothing introduced yet: the wall names nothing (Review Focus 4).
  await expect(page.locator('[data-tile] img[alt=""]')).toHaveCount(n);
  await expect(page.getByText('Mona Lisa')).toHaveCount(0);
  expect(await page.locator('[data-tile] img').first().getAttribute('src')).toMatch(/^\/api\/painting-art\/\d+\?size=thumb$/);
  await shot(page, 'course-home-new');

  await page.getByRole('link', { name: 'Start placement' }).click();
  for (let i = 0; i < 3; i++) await answer(page);

  // A deliberate miss: a made-up title.
  const pending = await pendingOnScreen(page, user);
  await page.getByRole('textbox').fill('Atlantis');
  await page.keyboard.press('Enter');
  const feedback = page.getByTestId('feedback');
  await expect(feedback).toHaveAttribute('data-correct', 'false');
  await expect(feedback).toContainText(`it’s ${titleOf(pending.entry.itemKey)}`);
  await shot(page, 'feedback-wrong-title');
  await page.keyboard.press('Enter');
  await waitForNext(page, pending.questionId);

  await page.goto('/courses/great-paintings');
  await page.getByRole('button', { name: 'Skip placement' }).click();
  await expect(page).toHaveURL(/\/courses\/great-paintings\/study$/);
  await page.getByRole('button', { name: /End/ }).click();

  // Two paintings mid-ladder, so one session reaches the typed levels.
  await seedLearning(user.id, GREAT_PAINTINGS, ['night-watch'], 2);
  await seedLearning(user.id, GREAT_PAINTINGS, ['milkmaid'], 3);
  await page.goto('/courses/great-paintings/study?size=40');
  await expect(page.locator('[data-question-id]')).toBeVisible();
  const kinds = new Set<string>();
  for (let i = 0; i < 60 && (await page.locator('[data-question-id]').count()) > 0; i++) kinds.add(await answer(page));
  for (const kind of [
    'intro',
    'image_to_title-mc-text',
    'image_to_artist-mc-text',
    'image_to_movement-mc-text',
    'title_to_image-image-grid',
    'image_to_title-typed',
    'image_to_artist-typed',
  ]) {
    expect([...kinds]).toContain(kind);
  }

  await page.goto('/courses/great-paintings');
  // Introduced paintings are now labelled.
  await expect(page.locator('[data-tile] img:not([alt=""])').first()).toBeVisible();
  await shot(page, 'course-home-progress');
  await page.locator('[data-tile]:not([data-tile="new"]) a').first().click();
  await expect(page).toHaveURL(/\/courses\/great-paintings\/painting\/\d+$/);
  // The first introduced painting, labelled now that it has been met.
  await expect(page.getByRole('heading', { name: 'Mona Lisa' })).toBeVisible();
  await expect(page.getByRole('link', { name: '← Your gallery' })).toBeVisible();
  await shot(page, 'reference-view');

  // Credits are public: no sign-in needed.
  await context.clearCookies();
  await page.goto('/credits/paintings');
  await expect(page.getByRole('heading', { name: 'Painting image credits' })).toBeVisible();
  await shot(page, 'credits');
});

test('pass the final exam, then a practice-ahead check', async ({ page, context }) => {
  test.setTimeout(900_000);
  await context.addCookies(await sessionCookies(user));
  await graduateEverything(user.id, GREAT_PAINTINGS);

  await page.goto('/courses/great-paintings');
  await page.getByRole('link', { name: 'Take the final exam' }).click();
  for (let i = 0; i < n; i++) await answer(page);
  await expect(page.getByText('Passed')).toBeVisible();
  await expect(page.getByText(`${n}/${n}`)).toBeVisible();
  await shot(page, 'exam-passed');

  await page.getByRole('link', { name: 'Back to course' }).click();
  expect(await practiceAhead(page, user, GREAT_PAINTINGS)).toBe(20);
});
