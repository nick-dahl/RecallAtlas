import { expect, test } from '@playwright/test';
import { admin } from './support/supabase';

test.describe.configure({ mode: 'serial' });

const email = `signup-${Date.now()}@example.com`;
const password = 'first-password-1';
const newPassword = 'second-password-2';
let userId: string | undefined;

async function findUserId(address: string) {
  for (let page = 1; page < 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const hit = data.users.find((u) => u.email === address);
    if (hit) return hit.id;
    if (data.users.length < 200) return undefined;
  }
}

/** Opens an emailed link without email: the admin API generates the same token hash. */
async function linkFor(type: 'magiclink' | 'recovery') {
  const { data, error } = await admin.auth.admin.generateLink({ type, email });
  if (error) throw error;
  return `/auth/confirm?token_hash=${data.properties.hashed_token}&type=${type === 'magiclink' ? 'email' : 'recovery'}`;
}

test.afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});

test('sign up on the landing page, study at once, confirm from another browser', async ({ page, browser }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByRole('button', { name: 'Create account' }).click();
  // The browser's own minlength check may block submit; the server message covers non-browser clients.
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  userId = await findUserId(email);
  await expect(page.getByTestId('confirm-banner')).toContainText(email);

  // Confirm in a different browser context (no shared cookies): Review Focus 1.
  const other = await browser.newContext();
  const phone = await other.newPage();
  await phone.goto(await linkFor('magiclink'));
  await expect(phone).toHaveURL(/\/dashboard$/);
  await other.close();

  await page.reload();
  await expect(page.getByTestId('confirm-banner')).toHaveCount(0);
});

test('an existing email is told to sign in instead (Review Focus 3)', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill(`  ${email.toUpperCase()} `);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('That email already has an account.')).toBeVisible();
  await page.getByRole('link', { name: 'Sign in instead' }).click();
  await expect(page.getByLabel('Email')).toHaveValue(email);
});

test('sign back in with the password; reset it; sign in with the new one', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole('button', { name: 'Sign out' }).click();

  // The forgot page never says whether an account exists (no email is sent for an unknown address).
  await page.goto('/login/forgot');
  await page.getByLabel('Email').fill(`nobody-${Date.now()}@example.com`);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByText("If that email has an account, we've sent a reset link.")).toBeVisible();

  // The reset link, wherever it's opened, ends on the new-password page (Review Focus 4).
  await page.goto(await linkFor('recovery'));
  await expect(page).toHaveURL(/\/account\/password$/);
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm new password').fill(newPassword);
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page).toHaveURL(/\/dashboard\?notice=password$/);
  await expect(page.getByText('Password updated.')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(newPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('a used link fails gracefully, and the email-link option is still there (Review Focus 2)', async ({ page }) => {
  const link = await linkFor('magiclink');
  await page.goto(link);
  await page.context().clearCookies();
  await page.goto(link);
  await expect(page).toHaveURL(/\/login\?error=link$/);
  await expect(page.getByText('That sign-in link didn’t work. Request a new one.')).toBeVisible();
  await page.getByRole('link', { name: 'Email me a sign-in link instead' }).click();
  await expect(page.getByRole('button', { name: 'Email me a sign-in link' })).toBeVisible();
});
