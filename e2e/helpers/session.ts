import { Page } from '@playwright/test';

export async function seedAdminSession(
  page: Page,
  tokens = { access: 'mock-access', refresh: 'mock-refresh' },
) {
  await page.addInitScript(({ access, refresh }) => {
    localStorage.setItem('calimero_access_token', access);
    localStorage.setItem('calimero_refresh_token', refresh);
  }, tokens);
}
