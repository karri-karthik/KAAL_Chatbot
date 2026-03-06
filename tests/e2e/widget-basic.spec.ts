import { test, expect } from '@playwright/test';

test('widget loads and shows greeting + options', async ({ page }) => {
  await page.goto('/');

  const launcher = page.getByRole('button', { name: /open chat/i });
  await expect(launcher).toBeVisible();

  await launcher.click();

  await expect(page.getByText(/Chat with our AI/i)).toBeVisible();
  await expect(page.getByText(/How can I help you today/i)).toBeVisible();

  await expect(page.getByRole('button', { name: /Explore what you can do/i })).toBeVisible();
});

