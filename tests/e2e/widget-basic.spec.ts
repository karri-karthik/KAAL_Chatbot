import { test, expect } from '@playwright/test';

test('widget loads and shows greeting + options', async ({ page }) => {
  await page.goto('/');

  const launcher = page.getByRole('button', { name: /open chat/i });
  await expect(launcher).toBeVisible();

  await launcher.click();

  await expect(page.getByText(/Kaal Chatbot/i)).toBeVisible();
  await expect(page.getByText(/I'm Kaal, your AI assistant/i)).toBeVisible();

  await expect(page.getByRole('button', { name: /What can Kaal do/i })).toBeVisible();
});

