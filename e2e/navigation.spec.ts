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
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
}

const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main' }).first();

test.describe('Navigation bar', () => {
  test('marks exactly one item as the current page and moves with navigation', async ({ page }) => {
    await signIn(page, 'client@bench.test');
    for (const [name, url] of [['Shortlists', /\/shortlists$/], ['Projects', /\/projects$/], ['Messages', /\/messages$/]] as const) {
      await mainNav(page).getByRole('link', { name }).click();
      await expect(page).toHaveURL(url);
      await expect(mainNav(page).locator('[aria-current=page]')).toHaveCount(1);
      await expect(mainNav(page).locator('[aria-current=page]')).toHaveText(new RegExp(name));
    }
  });

  test('the sliding highlight lines up with the active link', async ({ page }) => {
    await page.goto('/');
    await mainNav(page).getByRole('link', { name: 'Projects' }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await page.waitForTimeout(400); // let the 150ms slide finish
    const diff = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label=Main]')!;
      const link = nav.querySelector('a[aria-current=page]')!.getBoundingClientRect();
      const pill = nav.querySelector('span[aria-hidden]')!.getBoundingClientRect();
      return [Math.abs(Math.round(link.left - pill.left)), Math.abs(Math.round(link.width - pill.width))];
    });
    expect(diff).toEqual([0, 0]);
  });

  test('the header does not change height while auth loads', async ({ page }) => {
    await signIn(page, 'client@bench.test');
    await page.reload();
    const heights = new Set<number>();
    for (let i = 0; i < 8; i++) {
      heights.add(await page.locator('header').evaluate((h) => Math.round(h.getBoundingClientRect().height)));
      await page.waitForTimeout(80);
    }
    expect(heights.size).toBe(1);
  });

  test('a freelancer sees freelancer links, not client links, after a reload', async ({ page }) => {
    await signIn(page, 'alex.rivera@bench.test');
    await page.reload();
    await expect(mainNav(page).getByRole('link', { name: 'Analytics' })).toBeVisible();
    await expect(mainNav(page).getByRole('link', { name: 'Shortlists' })).toHaveCount(0);
  });

  test('Back returns to the earlier scroll position', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Alex Rivera' }).first()).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(200);
    const before = await page.evaluate(() => scrollY);
    await page.getByRole('link', { name: 'Alex Rivera' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Alex Rivera' })).toBeVisible();
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await page.goBack();
    await expect(page.getByRole('link', { name: 'Alex Rivera' }).first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before - 60);
  });

  test('on a phone the active tab is scrolled into view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await signIn(page, 'alex.rivera@bench.test');
    await page.getByRole('link', { name: 'Analytics' }).click();
    await expect(page).toHaveURL(/\/freelancer\/analytics$/);
    const visible = await page.getByRole('link', { name: 'Analytics' }).evaluate((a) => {
      const r = a.getBoundingClientRect();
      return r.left >= 0 && r.right <= window.innerWidth;
    });
    expect(visible).toBe(true);
  });

  test('has no accessibility violations', async ({ page }) => {
    await signIn(page, 'client@bench.test');
    const results = await new AxeBuilder({ page }).include('header').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  });
});
