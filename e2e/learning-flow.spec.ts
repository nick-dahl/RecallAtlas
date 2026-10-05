import { expect, test } from '@playwright/test';
import { answerCorrectly, currentQuestionId, waitForNext } from './support/session';
import { admin, createTestUser, graduateEverything, sessionCookies, type TestUser } from './support/supabase';

test.describe.configure({ mode: 'serial' });

let user: TestUser;

test.beforeAll(async () => {
  user = await createTestUser();
});

test.afterAll(async () => {
  await admin.auth.admin.deleteUser(user.id);
});

test('signed-out visitors are sent to sign in', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await expect(page.getByRole('button', { name: /sign-in link/i })).toBeVisible();
});

test('enroll, run placement, skip ahead, and study', async ({ page, context }) => {
  await context.addCookies(await sessionCookies(user));

  await page.goto('/');
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole('button', { name: 'Start course' }).click();
  await expect(page).toHaveURL(/\/courses\/world-flags$/);
  await expect(page.getByText('0 / 394 prompts learned')).toBeVisible();

  await page.getByRole('link', { name: 'Start placement' }).click();
  await answerCorrectly(page, user);

  const id = await currentQuestionId(page);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('feedback')).toHaveAttribute('data-correct', 'false');
  await page.keyboard.press('Enter');
  await waitForNext(page, id);

  await page.goto('/courses/world-flags');
  await page.getByRole('button', { name: 'Skip placement' }).click();
  await expect(page).toHaveURL(/\/courses\/world-flags\/study$/);
  for (let i = 0; i < 8; i++) await answerCorrectly(page, user);
  await expect(page.locator('[data-question-id]')).toBeVisible();

  await page.getByRole('button', { name: /End/ }).click();
  await expect(page).toHaveURL(/\/courses\/world-flags$/);
  await expect(page.getByText(/[1-9]\d* in progress/)).toBeVisible();
});

test('pass the final exam', async ({ page, context }) => {
  test.setTimeout(600_000);
  await context.addCookies(await sessionCookies(user));
  await graduateEverything(user.id);

  await page.goto('/courses/world-flags');
  await page.getByRole('link', { name: 'Take the final exam' }).click();
  for (let i = 0; i < 197; i++) await answerCorrectly(page, user);

  await expect(page.getByText('Passed')).toBeVisible();
  await expect(page.getByText('197/197')).toBeVisible();
  await page.getByRole('link', { name: 'Back to course' }).click();
  await expect(page.getByText('Passed').first()).toBeVisible();
});

// Separate (non-serial) describe: this signs into the developer's REAL account via the
// dev-only shortcut on /login, so it must not run inside the throwaway-user serial block
// above (a failure there would skip it) and must not touch that account's progress — no
// course actions, no /dev-page clicks.
test.describe('dev sign-in', () => {
  test('signs into the developer account and back out', async ({ page }) => {
    await page.goto('/login');
    const devLink = page.getByRole('link', { name: /^Dev sign-in as /i });
    await expect(devLink).toBeVisible();
    await devLink.click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Your atlas' })).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
