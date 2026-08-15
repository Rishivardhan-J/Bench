import { test, expect } from '@playwright/test';

test.describe('Shortlist flow', () => {
  test('Search, filter, and shortlist with auth interruption', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('/');
    
    // 2. See SearchPage elements
    await expect(page.locator('text=Generate shortlist')).toBeVisible();
    
    // 3. Open a freelancer detail view (assuming Alex Rivera is first)
    // Results table loads async initially, wait for it
    await expect(page.locator('text=Alex Rivera')).toBeVisible();
    await page.click('text=Alex Rivera');

    // 4. Detail view loads
    await expect(page.locator('text=Back to results')).toBeVisible();
    await expect(page.locator('h1', { hasText: 'Alex Rivera' })).toBeVisible();

    // 5. Click Save to shortlist (triggers sign in)
    await page.getByLabel('Save to shortlist').click();

    // 6. Auth modal appears
    await expect(page.locator('text=Sign in to Bench')).toBeVisible();

    // We can't easily mock Firebase Auth in a real E2E without setup, 
    // but we can verify the modal appears and traps focus.
    
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toBeFocused();
    
    // Fill dummy details just to trigger error state as a check that the form works
    await emailInput.fill('test@test.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    
    // The request will fail against emulator without an account, showing an error
    await expect(page.locator('text=Invalid email or password')).toBeVisible({ timeout: 10000 });
  });
});
