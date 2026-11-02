import { expect, test, type Page } from '@playwright/test';

// Needs the API server running and `npm run seed` applied (see README).
const ORIGIN = 'http://localhost:5173';

async function signIn(page: Page, email: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  const dialog = page.locator('dialog[open]');
  await dialog.getByLabel('Email').fill(email);
  await dialog.getByLabel('Password').first().fill('password123');
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
}

test.describe('Shared shortlists', () => {
  test('a client shares a read-only link that works signed out and stops when revoked', async ({ page, browser }) => {
    const name = `Finalists ${Date.now()}`;
    await signIn(page, 'client@bench.test');
    const created = await page.request.post('/api/shortlists', { data: { name, freelancerId: 'f1' }, headers: { origin: ORIGIN } });
    expect(created.ok()).toBe(true);
    await page.request.patch(`/api/shortlists/${(await created.json()).id}/items/f1`, { data: { note: 'Secret note about pricing' }, headers: { origin: ORIGIN } });

    await page.goto('/shortlists');
    await page.getByRole('combobox', { name: 'List' }).selectOption({ label: `${name} (1)` });
    await page.getByRole('button', { name: `Manage ${name}` }).click();
    await page.getByRole('menuitem', { name: 'Share read-only link' }).click();
    const link = await page.getByLabel('Read-only link').inputValue();
    expect(link).toContain('/s/');

    const visitor = await browser.newContext();
    const guest = await visitor.newPage();
    await guest.goto(link);
    await expect(guest.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(guest.getByRole('link', { name: 'Alex Rivera' })).toBeVisible();
    await expect(guest.getByText('Secret note')).toHaveCount(0);

    await page.getByRole('button', { name: 'Stop sharing' }).click();
    await guest.reload();
    await expect(guest.getByText('This link is no longer available')).toBeVisible();
    await visitor.close();
  });
});

test.describe('Declining with a reason', () => {
  test('a freelancer declines, recommends someone, and the client is told', async ({ page, browser }) => {
    const clientCtx = await browser.newContext();
    const clientPage = await clientCtx.newPage();
    await signIn(clientPage, 'client@bench.test');

    await signIn(page, 'samira.jones@bench.test');
    await page.goto('/freelancer/requests');
    await expect(page.getByText('Jordan Lee')).toBeVisible();
    await page.getByRole('button', { name: 'Decline' }).click();
    const dialog = page.locator('dialog[open]');
    await dialog.getByLabel("The budget doesn't fit").check();
    await dialog.getByLabel('Recommend someone (optional)').fill('Alex');
    await dialog.getByRole('button', { name: /Alex Rivera/ }).click();
    await dialog.getByRole('button', { name: 'Decline request' }).click();
    await expect(page.getByText('Declined.')).toBeVisible();

    // The client hears about it live, without reloading.
    await clientPage.goto('/notifications');
    await expect(clientPage.getByText(/can't take this on/)).toBeVisible();
    await clientCtx.close();
  });
});
