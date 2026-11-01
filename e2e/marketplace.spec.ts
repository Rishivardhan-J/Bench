import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Needs the emulators running and `npm run seed` applied (see README).

async function signIn(page: Page, email: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  const dialog = page.locator('dialog[open]');
  await dialog.getByLabel('Email').fill(email);
  await dialog.getByLabel('Password').first().fill('password123');
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Messages' })).toBeVisible();
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
}

test.describe('Search', () => {
  test('lists freelancers and has no Generate button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Alex Rivera' })).toBeVisible();
    await expect(page.getByRole('button', { name: /generate/i })).toHaveCount(0);
    await expectNoAxeViolations(page);
  });

  test('opens a profile and asks a signed-out visitor to sign in before connecting', async ({ page }) => {
    await page.goto('/freelancer/f1');
    await expect(page.getByRole('heading', { level: 1, name: 'Alex Rivera' })).toBeVisible();
    await page.getByRole('button', { name: 'Connect' }).click();
    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();
    // Focus starts on the first form field, not the close button.
    await expect(dialog.getByRole('textbox').first()).toBeFocused();
  });

  test('works at phone width without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Alex Rivera' }).locator('visible=true').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});

test.describe('Roles and messaging', () => {
  test('a client can open a conversation and send a message', async ({ page }) => {
    await signIn(page, 'client@bench.test');
    await page.goto('/messages');
    await page.getByRole('link', { name: /Alex Rivera/ }).click();
    const box = page.getByLabel(/Message Alex/);
    await box.fill('Hello from the e2e suite');
    await box.press('Enter');
    await expect(page.getByText('Hello from the e2e suite')).toBeVisible();
  });

  test('a client cannot open freelancer pages', async ({ page }) => {
    await signIn(page, 'client@bench.test');
    await page.goto('/freelancer/profile');
    await expect(page.getByText(/only for freelancer accounts/i)).toBeVisible();
  });

  test('a signed-out visitor is asked to sign in for admin pages', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText('Sign in to continue')).toBeVisible();
  });
});
