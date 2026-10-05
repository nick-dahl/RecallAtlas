import { expect, type Page } from '@playwright/test';
import { nameOf, pendingQuestion, type TestUser } from './supabase';

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

/** Answers the on-screen question correctly, looking the answer up server-side. */
export async function answerCorrectly(page: Page, user: TestUser) {
  const id = await currentQuestionId(page);
  let pending = await pendingQuestion(user.id);
  await expect.poll(async () => (pending = await pendingQuestion(user.id))?.questionId).toBe(id);
  const { entry, format, choices } = pending!;

  if (entry.kind === 'intro') {
    await page.keyboard.press('Enter');
  } else if (format === 'typed') {
    await page.getByRole('textbox', { name: 'Country name' }).fill(nameOf(entry.itemKey));
    await page.keyboard.press('Enter');
  } else {
    if (entry.kind === 'contrast') await page.keyboard.press('Enter');
    await page.locator(`[data-choice-id="${choices.find((c) => c.itemKey === entry.itemKey)!.id}"]`).click();
  }
  await waitForNext(page, id);
}
